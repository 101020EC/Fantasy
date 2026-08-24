import { assertNoLookahead } from './lookahead';
import { SeasonFixtures } from './fixtures-store';
import { factorFor } from './calibration';
import {
  Calibration,
  FeatureSet,
  FPLScoring,
  FPLTeam,
  GameweekForecast,
  LookaheadError,
  PlayerForecast,
} from './types';

/**
 * Deterministic expected-points model.
 *
 * Deliberately not an LLM and not, yet, a trained model. It is reproducible,
 * free, unit-testable and backtestable, and a trained model can replace the
 * internals later behind the same signature. An LLM asked for xPts produces
 * numbers that cannot be validated, reproduced, or improved on evidence — so
 * the language model's job is to explain these numbers, never to generate them.
 */

export const COMPUTE_VERSION = 3;

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
  /** Fixture adjustment is clamped here — no single matchup should dominate. */
  fixtureAdjustmentRange: [0.65, 1.55] as [number, number],

  /** Goals a team concedes when nothing is known, for the clean-sheet prior. */
  defaultConceded: 1.35,
};

/**
 * Fixture difficulty, from FPL's own per-team FDR on each fixture.
 *
 * This replaces the team `strength_attack_*` / `strength_defence_*` splits the
 * model was originally built on. FPL ships those as **0 for all 20 clubs** in
 * 2026/27 and moved `strength_overall_home/away` to a 1-5 scale, so the old
 * normalisation against ~1100 collapsed every matchup to the same clamped
 * value: away at the champions scored identically to a home tie against the
 * bottom club, and the flat 0.65 applied to expected goals conceded inflated
 * clean sheets for every defender in the league.
 *
 * FDR is coarser than a strength split — one number per team per fixture
 * rather than separate attack and defence ratings — but it is real, it is
 * published per venue, and it moves. Baseline is 3, so an average fixture
 * leaves the projection untouched.
 *
 * These multipliers are UNFITTED, like the rest of PRIORS. The first backtest
 * with enough gameweeks should replace them with fitted values.
 */
const FDR_ATTACK: Record<number, number> = { 1: 1.25, 2: 1.14, 3: 1.0, 4: 0.87, 5: 0.74 };
const FDR_CONCEDE: Record<number, number> = { 1: 0.72, 2: 0.85, 3: 1.0, 4: 1.18, 5: 1.38 };
const DEFAULT_DIFFICULTY = 3;

/**
 * Home advantage on top of FDR. FPL's rating already differs by venue (Coventry
 * rate Arsenal 4 at home and 5 away), but only in whole steps, so it cannot
 * express the roughly two-tenths-of-a-goal edge playing at home is worth. Kept
 * small precisely because part of the effect is already in the FDR.
 */
const HOME_ATTACK = 1.06;
const HOME_CONCEDE = 0.94;

export interface ForecastContext {
  fixtures: SeasonFixtures | null;
  /**
   * Unused since the move to FDR — FPL zeroed every attack/defence strength
   * split for 2026/27. Kept on the interface so callers stay unchanged and so
   * the model can go back to strength splits if FPL starts publishing them
   * again, which would be the better signal.
   */
  teams?: FPLTeam[];
  /** FPL's live scoring table. Falls back to the 2026/27 rules when absent. */
  scoring?: FPLScoring;
  /**
   * Corrections fitted from realised results. Absent, or fitted on nothing,
   * leaves every projection exactly as the model produced it — which before
   * roughly GW5 is the honest state rather than a result.
   */
  calibration?: Calibration | null;
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
  /** FPL's difficulty rating for THIS club in this fixture, 1 (easy) to 5. */
  difficulty: number;
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
  const iHomeDiff = F('team_h_difficulty');
  const iAwayDiff = F('team_a_difficulty');

  // A stored fixture set from before difficulty was captured has no such
  // column; reading -1 out of the array would silently yield undefined, so
  // fall back to the neutral rating rather than to a wrong one.
  const rating = (values: (string | number | boolean | null)[], index: number) => {
    const v = index >= 0 ? Number(values[index]) : NaN;
    return Number.isFinite(v) && v >= 1 && v <= 5 ? v : DEFAULT_DIFFICULTY;
  };

  for (const values of Object.values(fixtures.fixtures)) {
    if (Number(values[iEvent]) !== gameweek) continue;
    const home = Number(values[iHome]);
    const away = Number(values[iAway]);
    if (!out.has(home)) out.set(home, []);
    if (!out.has(away)) out.set(away, []);
    out.get(home)!.push({ opponent: away, isHome: true, difficulty: rating(values, iHomeDiff) });
    out.get(away)!.push({ opponent: home, isHome: false, difficulty: rating(values, iAwayDiff) });
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

  // Checked against the calibration actually passed in, not against what the
  // feature set claims about it. A caller could otherwise declare an empty
  // calibration source list and hand over factors fitted on the target week.
  const calibration = context.calibration ?? null;
  const contaminated = (calibration?.sourceGameweeks ?? []).filter((gw) => gw >= fs.targetGameweek);
  if (contaminated.length) {
    throw new LookaheadError(
      `Calibration for GW${fs.targetGameweek} was fitted on GW${contaminated.join(', GW')}, ` +
        `which had not happened when a forecast for GW${fs.targetGameweek} would be useful.`
    );
  }

  const scoring = context.scoring ?? FALLBACK_SCORING;
  const byClub = fixturesForGameweek(context.fixtures, fs.targetGameweek);
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

      // Attacking output is scaled down by a hard fixture and up by an easy
      // one; expected goals conceded moves the other way, which is what
      // actually drives the clean-sheet term for defenders and keepers.
      const fdr = fixture.difficulty;
      const attackAdj = clamp(
        (FDR_ATTACK[fdr] ?? 1) * (fixture.isHome ? HOME_ATTACK : 1 / HOME_ATTACK),
        adjLo, adjHi
      );
      const defenceAdj = clamp(
        (FDR_CONCEDE[fdr] ?? 1) * (fixture.isHome ? HOME_CONCEDE : 1 / HOME_CONCEDE),
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

    // Confidence is about how much is known, not about how high the score is.
    //
    // Two independent kinds of evidence, and the better one counts: gameweeks
    // played this season, and a full prior season. Counting only this season
    // reported zero confidence for every player before a gameweek was
    // finalised — including a striker with 2953 minutes and 239 points behind
    // him, who is not an unknown quantity.
    const historyDepth = Math.min(1, (fs.sources.playerStats.length || 0) / 6);
    const priorDepth = b.has_season_prior ? 0.45 : 0;
    const evidence = Math.max(historyDepth, priorDepth);
    const availabilityCertainty = availability >= 0.99 || availability <= 0.01 ? 1 : 0.6;
    const confidence = clamp(
      clubFixtures.length === 0 ? 1 : evidence * availabilityCertainty * (hasHistory ? 1 : 0.15),
      0, 1
    );

    // A spread, not a distribution: wide when little is known, and wider for a
    // double gameweek where there is simply more variance to have.
    const spread = xPts * (0.45 + 0.4 * (1 - confidence)) + 0.8 * clubFixtures.length;

    // Calibration is applied last, to the points only.
    //
    // Deliberately NOT to minutesProb: minutes that were over-predicted are
    // already corrected through start_rate and appearance_rate, which are
    // rebuilt from playerStats every week. Scaling them again here would
    // double-count the same evidence and then feed the doubled error back into
    // the next fit.
    const factor = factorFor(calibration, player.elementId, position);
    const adjusted = xPts * factor;

    predictions[String(player.elementId)] = {
      xPts: Number(adjusted.toFixed(2)),
      floor: Number(Math.max(0, adjusted - spread * factor).toFixed(2)),
      ceiling: Number((adjusted + spread * factor).toFixed(2)),
      minutesProb: Number(Math.min(1, totalMinutes / 90).toFixed(3)),
      confidence: Number(confidence.toFixed(3)),
      rawXPts: Number(xPts.toFixed(2)),
      calibrationFactor: Number(factor.toFixed(4)),
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
