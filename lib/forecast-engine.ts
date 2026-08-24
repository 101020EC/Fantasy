import { assertNoLookahead } from './lookahead';
import { SeasonFixtures } from './fixtures-store';
import { FeatureSet, FPLScoring, FPLTeam, GameweekForecast, PlayerForecast } from './types';

/**
 * Deterministic expected-points model.
 *
 * Deliberately not an LLM and not, yet, a trained model. It is reproducible,
 * free, unit-testable and backtestable, and a trained model can replace the
 * internals later behind the same signature. An LLM asked for xPts produces
 * numbers that cannot be validated, reproduced, or improved on evidence — so
 * the language model's job is to explain these numbers, never to generate them.
 */

export const COMPUTE_VERSION = 1;

/** element_type -> the key FPL uses in its own scoring table. */
const POSITION_KEY: Record<number, 'GKP' | 'DEF' | 'MID' | 'FWD'> = {
  1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD',
};

/**
 * Fallback only. The live rules come from bootstrap-static's game_config, so
 * these are used solely if FPL stops shipping them — they match the 2026/27
 * table, including goalkeeper goals at 10 and defensive contribution at 2.
 */
const FALLBACK_SCORING: FPLScoring = {
  long_play: 2,
  short_play: 1,
  goals_scored: { GKP: 10, DEF: 6, MID: 5, FWD: 4 },
  clean_sheets: { GKP: 4, DEF: 4, MID: 1, FWD: 0 },
  goals_conceded: { GKP: -1, DEF: -1, MID: 0, FWD: 0 },
  defensive_contribution: { GKP: 0, DEF: 2, MID: 2, FWD: 2 },
  assists: 3, saves: 1, bonus: 1,
  yellow_cards: -1, red_cards: -3, own_goals: -2,
  penalties_saved: 5, penalties_missed: -2,
};

/**
 * The count of defensive actions that earns the points, which FPL does NOT
 * ship: 10 clearances/blocks/interceptions/tackles for a defender, 12 with
 * recoveries added for everyone else.
 */
const DEFCON_THRESHOLD: Record<number, number> = { 2: 10, 3: 12, 4: 12 };
/** Goals conceded costs a point per TWO conceded, not per goal. */
const CONCEDED_PER_POINT = 2;
/** Saves earn a point per THREE saves. */
const SAVES_PER_POINT = 3;

/**
 * Shape constants — UNFITTED PRIORS, not estimates from data.
 *
 * They are stated here rather than buried so that the first backtest can
 * replace them with fitted values. Until then, every number this model produces
 * inherits whatever error they carry, which is the honest reason its accuracy
 * claims mean nothing before roughly GW8-10.
 */
const PRIORS = {
  /** Minutes a starter plays on average, allowing for substitutions. */
  starterMinutes: 82,
  /** Minutes a non-starting appearance tends to be worth. */
  benchAppearanceMinutes: 20,
  /** Probability a starter lasts the 60 minutes that turn 1 appearance point into 2. */
  starterReaches60: 0.88,
  /** League-average team strength, used to normalise the fixture adjustment. */
  averageStrength: 1100,
  /** Fixture adjustment is clamped here — no single matchup should dominate. */
  fixtureAdjustmentRange: [0.65, 1.55] as [number, number],

  /** Goals a team concedes when nothing is known, for the clean-sheet prior. */
  defaultConceded: 1.35,
};

export interface ForecastContext {
  fixtures: SeasonFixtures | null;
  teams: FPLTeam[];
  /** FPL's live scoring table. Falls back to the 2026/27 rules when absent. */
  scoring?: FPLScoring;
}

/** Poisson P(X = 0) — the probability a team concedes nothing. */
const poissonZero = (lambda: number) => Math.exp(-lambda);

/** Poisson P(X >= k), for the defensive-contribution threshold. */
function poissonAtLeast(lambda: number, k: number): number {
  if (lambda <= 0) return 0;
  let cumulative = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i < k; i++) {
    cumulative += term;
    term = (term * lambda) / (i + 1);
  }
  return Math.max(0, Math.min(1, 1 - cumulative));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface TargetFixture {
  opponent: number;
  isHome: boolean;
}

/** Every fixture a club plays in the target gameweek: 0 = blank, 2+ = double. */
function fixturesForGameweek(
  fixtures: SeasonFixtures | null,
  gameweek: number
): Map<number, TargetFixture[]> {
  const out = new Map<number, TargetFixture[]>();
  if (!fixtures) return out;
  const F = (name: string) => fixtures.fields.indexOf(name);
  const iEvent = F('event');
  const iHome = F('team_h');
  const iAway = F('team_a');

  for (const values of Object.values(fixtures.fixtures)) {
    if (Number(values[iEvent]) !== gameweek) continue;
    const home = Number(values[iHome]);
    const away = Number(values[iAway]);
    if (!out.has(home)) out.set(home, []);
    if (!out.has(away)) out.set(away, []);
    out.get(home)!.push({ opponent: away, isHome: true });
    out.get(away)!.push({ opponent: home, isHome: false });
  }
  return out;
}

export function forecast(
  fs: FeatureSet,
  context: ForecastContext,
  now: Date = new Date()
): GameweekForecast {
  // Gate two of two. A caller who hand-assembles a feature set still cannot
  // get a prediction out of contaminated inputs.
  assertNoLookahead(fs);

  const scoring = context.scoring ?? FALLBACK_SCORING;
  const byClub = fixturesForGameweek(context.fixtures, fs.targetGameweek);
  const teams = new Map(context.teams.map((t) => [t.id, t]));
  const [adjLo, adjHi] = PRIORS.fixtureAdjustmentRange;

  const predictions: Record<string, PlayerForecast> = {};

  for (const player of fs.players) {
    const b = player.base;
    const position = Number(b.element_type) || 3;
    const posKey = POSITION_KEY[position] ?? 'MID';
    const club = Number(b.team) || 0;
    const clubFixtures = byClub.get(club) ?? [];

    const availability = b.availability ?? 1;
    const startRate = b.start_rate;
    const appearanceRate = b.appearance_rate;

    // A player with no history is not a player who does nothing — but neither
    // is he forecastable. He gets a zero with low confidence, which the UI
    // shows as unknown rather than as a prediction of nothing.
    const hasHistory = startRate !== null && appearanceRate !== null;

    let xPts = 0;
    let totalMinutes = 0;

    for (const fixture of clubFixtures) {
      const pStart = hasHistory ? availability * (startRate ?? 0) : 0;
      const pAppear = hasHistory ? availability * (appearanceRate ?? 0) : 0;
      const expMinutes =
        pStart * PRIORS.starterMinutes +
        Math.max(0, pAppear - pStart) * PRIORS.benchAppearanceMinutes;
      totalMinutes += expMinutes;

      const me = teams.get(club);
      const opp = teams.get(fixture.opponent);

      // Attack is helped by a weak opponent defence and by playing at home;
      // the reverse for keeping a clean sheet. Both are normalised against the
      // league average so the numbers stay interpretable as multipliers.
      const myAttack = me
        ? fixture.isHome ? me.strength_attack_home : me.strength_attack_away
        : PRIORS.averageStrength;
      const oppDefence = opp
        ? fixture.isHome ? opp.strength_defence_away : opp.strength_defence_home
        : PRIORS.averageStrength;
      const myDefence = me
        ? fixture.isHome ? me.strength_defence_home : me.strength_defence_away
        : PRIORS.averageStrength;
      const oppAttack = opp
        ? fixture.isHome ? opp.strength_attack_away : opp.strength_attack_home
        : PRIORS.averageStrength;

      const attackAdj = clamp(
        (myAttack / PRIORS.averageStrength) * (PRIORS.averageStrength / (oppDefence || PRIORS.averageStrength)),
        adjLo, adjHi
      );
      const defenceAdj = clamp(
        (oppAttack / PRIORS.averageStrength) * (PRIORS.averageStrength / (myDefence || PRIORS.averageStrength)),
        adjLo, adjHi
      );

      const minuteShare = expMinutes / 90;

      // Appearance: 1 point for playing at all, 2 for reaching 60 minutes.
      xPts += pAppear * scoring.short_play +
        pStart * PRIORS.starterReaches60 * (scoring.long_play - scoring.short_play);

      // Attacking returns, from expected goals and assists rather than from
      // goals actually scored — xG is the more stable predictor over a season.
      const xg90 = b.xg90 ?? 0;
      const xa90 = b.xa90 ?? 0;
      xPts += xg90 * minuteShare * attackAdj * scoring.goals_scored[posKey];
      xPts += xa90 * minuteShare * attackAdj * scoring.assists;

      // Clean sheet, and the concession penalty that comes with it.
      const expectedConceded =
        (b.xgc90 !== null && b.xgc90 > 0 ? b.xgc90 : PRIORS.defaultConceded) * defenceAdj;
      const csPoints = scoring.clean_sheets[posKey];
      if (csPoints > 0) {
        // Only players who reach 60 minutes get the clean sheet.
        xPts += poissonZero(expectedConceded) * csPoints * (pStart * PRIORS.starterReaches60);
      }
      const concededPoints = scoring.goals_conceded[posKey];
      if (concededPoints !== 0) {
        // A point per two conceded, prorated by how much of the match he plays.
        xPts += (concededPoints * expectedConceded * minuteShare) / CONCEDED_PER_POINT;
      }

      // Goalkeeper saves: 1 point per 3.
      if (position === 1 && b.saves90 !== null) {
        xPts += (b.saves90 * minuteShare * defenceAdj * scoring.saves) / SAVES_PER_POINT;
      }

      // Defensive contribution: a threshold, so it needs a tail probability
      // rather than an average — a defender averaging 8 CBIT still clears 10
      // often enough to matter, and averaging alone would score that as zero.
      const threshold = DEFCON_THRESHOLD[position];
      const defconPoints = scoring.defensive_contribution[posKey];
      if (threshold && defconPoints && b.defcon90 !== null && b.defcon90 > 0) {
        xPts += poissonAtLeast(b.defcon90 * minuteShare, threshold) * defconPoints;
      }

      // Bonus, predicted from bonus previously won rather than derived from
      // bps. Only three players in a match receive any, so a rate built from
      // bps — which everyone accrues — systematically hands bonus points to
      // players who would never place in the top three.
      if (b.bonus90 !== null) {
        xPts += clamp(b.bonus90 * minuteShare * attackAdj, 0, 3);
      }
    }

    // Confidence is about how much is known, not about how high the score is:
    // history length, availability certainty, and whether a fixture exists.
    const historyDepth = Math.min(1, (fs.sources.playerStats.length || 0) / 6);
    const availabilityCertainty = availability >= 0.99 || availability <= 0.01 ? 1 : 0.6;
    const confidence = clamp(
      clubFixtures.length === 0 ? 1 : historyDepth * availabilityCertainty * (hasHistory ? 1 : 0.15),
      0, 1
    );

    // A spread, not a distribution: wide when little is known, and wider for a
    // double gameweek where there is simply more variance to have.
    const spread = xPts * (0.45 + 0.4 * (1 - confidence)) + 0.8 * clubFixtures.length;

    predictions[String(player.elementId)] = {
      xPts: Number(xPts.toFixed(2)),
      floor: Number(Math.max(0, xPts - spread).toFixed(2)),
      ceiling: Number((xPts + spread).toFixed(2)),
      minutesProb: Number(Math.min(1, totalMinutes / 90).toFixed(3)),
      confidence: Number(confidence.toFixed(3)),
    };
  }

  return {
    season: fs.season,
    gameweek: fs.targetGameweek,
    generatedAt: now.toISOString(),
    model: fs.includeElite ? 'elite' : 'base',
    computeVersion: COMPUTE_VERSION,
    includeElite: fs.includeElite,
    featureSources: fs.sources,
    qualityFlags: fs.qualityFlags,
    predictions,
  };
}
