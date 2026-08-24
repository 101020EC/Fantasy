import {
  decodeFixtures,
  PLAYER_STAT_FIELDS,
  PlayerPriors,
  PlayerStatsGameweek,
} from './player-stats';
import { SeasonFixtures } from './fixtures-store';
import { assertNoLookahead } from './lookahead';
import {
  EliteDerivedGameweek,
  EliteSignals,
  FeatureSet,
  FPLBootstrap,
  PlayerFeatures,
} from './types';

/**
 * Turns stored history into the feature rows a forecast consumes.
 *
 * Pure by design — every input is passed in, nothing is read from Firestore
 * here. That makes the whole feature definition testable without a database,
 * and it is why trend features live in this layer rather than in the stored
 * derived documents: changing a definition later needs a recompute, never a
 * migration or a re-capture.
 */

/** Rolling windows, in gameweeks. Short reacts, long is stable. */
export const SHORT_WINDOW = 3;
export const LONG_WINDOW = 6;

/**
 * Shrinkage strength, in 90-minute blocks of imaginary prior evidence.
 *
 * A per-90 rate from one match is noise wearing the costume of a measurement.
 * In GW1 a Brighton defender recorded 1.47 xG in 77 minutes — arithmetically a
 * rate of 1.72 per 90, which at 6 points a goal projects over ten points from
 * shots alone. He is not a 1.72-xG-per-90 player; he had one big game.
 *
 * So every rate is blended toward its position's league-wide baseline:
 *
 *     shrunk = (observed_total + baseline_per90 * K) / (n90 + K)
 *
 * With K = 5 a player needs about five full matches before his own numbers
 * outweigh the prior, and the correction fades automatically as the season
 * accumulates — by GW20 it barely moves anything.
 *
 * UNFITTED. The right value is the one that minimises backtest error, which
 * cannot be known until there are gameweeks to score against.
 */
export const SHRINKAGE_90S = 5;
/** Availability rates need far less help; they are bounded and less volatile. */
export const RATE_SHRINKAGE_GWS = 2;

export interface FeatureInputs {
  season: string;
  targetGameweek: number;
  targetDeadline: string | null;
  bootstrap: FPLBootstrap;
  /** gameweek -> stored stats. Only gameweeks before the target may be present. */
  playerStats: Map<number, PlayerStatsGameweek>;
  fixtures: SeasonFixtures | null;
  /** The market snapshot used, and the date it was captured. */
  market: { date: string; players: Record<string, (string | number | null)[]>; fields: string[] } | null;
  /** gameweek -> derived elite signals. Only used when includeElite. */
  eliteDerived: Map<number, EliteDerivedGameweek>;
  /** Last completed season per player, the preferred shrinkage target. */
  priors: PlayerPriors | null;
}

export interface BuildOptions {
  /**
   * Elite signals are a hypothesis under test, not part of the product, so the
   * default is off in the signature as well as at every call site.
   */
  includeElite?: boolean;
  /** A source gameweek older than this many weeks is dropped rather than trusted. */
  maxEliteLag?: number;
}

type Cell = string | number | boolean | null;

interface Totals {
  gameweeks: number;
  appearances: number;
  starts: number;
  minutes: number;
  points: number;
  goals: number;
  assists: number;
  xG: number;
  xA: number;
  xGC: number;
  bps: number;
  bonus: number;
  saves: number;
  defcon: number;
  cleanSheets: number;
  conceded: number;
}

const EMPTY: Totals = {
  gameweeks: 0, appearances: 0, starts: 0, minutes: 0, points: 0, goals: 0,
  assists: 0, xG: 0, xA: 0, xGC: 0, bps: 0, bonus: 0, saves: 0, defcon: 0,
  cleanSheets: 0, conceded: 0,
};

const num = (v: Cell) => Number(v) || 0;

/**
 * Sums a player's fixtures over the most recent `window` stored gameweeks.
 *
 * Both fixtures of a double gameweek are included — decodeFixtures returns one
 * row per fixture, which is exactly why player stats are stored per fixture
 * rather than per gameweek.
 */
function totalsOver(
  elementId: number,
  stats: PlayerStatsGameweek[],
  window: number
): Totals {
  const recent = stats.slice(-window);
  const t: Totals = { ...EMPTY };

  for (const doc of recent) {
    const values = doc.players[String(elementId)];
    if (!values) continue; // blank gameweek, or not in the game yet
    t.gameweeks++;
    for (const f of decodeFixtures(values, doc.fields)) {
      const mins = num(f.minutes);
      if (mins > 0) t.appearances++;
      t.starts += num(f.starts);
      t.minutes += mins;
      t.points += num(f.total_points);
      t.goals += num(f.goals_scored);
      t.assists += num(f.assists);
      t.xG += num(f.expected_goals);
      t.xA += num(f.expected_assists);
      t.xGC += num(f.expected_goals_conceded);
      t.bps += num(f.bps);
      t.bonus += num(f.bonus);
      t.saves += num(f.saves);
      t.defcon += num(f.defensive_contribution);
      t.cleanSheets += num(f.clean_sheets);
      t.conceded += num(f.goals_conceded);
    }
  }
  return t;
}

const per90 = (value: number, minutes: number) => (minutes > 0 ? (value / minutes) * 90 : 0);

/**
 * League-wide per-90 rates by position, computed from the same window the
 * features use. Derived from the data rather than hardcoded, so it stays
 * correct across rule changes and across seasons with different scoring.
 */
export interface PositionBaselines {
  [elementType: number]: {
    xg90: number; xa90: number; xgc90: number; bps90: number; bonus90: number;
    defcon90: number; saves90: number; startRate: number; appearanceRate: number;
  };
}

function computeBaselines(
  bootstrap: FPLBootstrap,
  stats: PlayerStatsGameweek[]
): PositionBaselines {
  const acc = new Map<number, { t: Totals; players: number }>();
  for (const el of bootstrap.elements) {
    const t = totalsOver(el.id, stats, LONG_WINDOW);
    if (t.minutes <= 0) continue; // players who never played tell us nothing
    const cur = acc.get(el.element_type) ?? { t: { ...EMPTY }, players: 0 };
    for (const k of Object.keys(EMPTY) as (keyof Totals)[]) cur.t[k] += t[k];
    cur.players++;
    acc.set(el.element_type, cur);
  }

  const out: PositionBaselines = {};
  for (const [pos, { t }] of acc) {
    out[pos] = {
      xg90: per90(t.xG, t.minutes),
      xa90: per90(t.xA, t.minutes),
      xgc90: per90(t.xGC, t.minutes),
      bps90: per90(t.bps, t.minutes),
      bonus90: per90(t.bonus, t.minutes),
      defcon90: per90(t.defcon, t.minutes),
      saves90: per90(t.saves, t.minutes),
      startRate: t.appearances ? t.starts / t.appearances : 0.5,
      appearanceRate: t.gameweeks ? t.appearances / t.gameweeks : 0.5,
    };
  }
  return out;
}

/**
 * Blends an observed count toward a prior rate. Returns a per-90 rate.
 * `total` is the raw count (xG, bps, ...), `minutes` how long it took.
 */
/**
 * Per-90 rates from a player's own last completed season, when there is one.
 *
 * Preferred over the position baseline as a shrinkage target: it is the
 * difference between "we assume he is an average forward" and "we assume he is
 * the player he was last year", and only one of those is a defensible prior for
 * a striker who scored 27 goals.
 *
 * Returns null for a new signing, a promoted player, or a youth debutant — the
 * cases where the position baseline genuinely is the best available guess.
 */
function priorRatesFor(
  elementId: number,
  priors: PlayerPriors | null
): {
  xg90: number; xa90: number; xgc90: number; bps90: number; bonus90: number;
  defcon90: number; saves90: number; startRate: number; appearanceRate: number;
} | null {
  if (!priors) return null;
  const values = priors.players[String(elementId)];
  if (!values) return null;
  const get = (name: string) => {
    const i = priors.fields.indexOf(name);
    return i === -1 ? 0 : Number(values[i]) || 0;
  };
  const minutes = get('minutes');
  // Under roughly five full matches last season the sample is as thin as the
  // one it would be correcting, so it is not used.
  if (minutes < 450) return null;
  const starts = get('starts');

  /**
   * How large a role the player had last season, as a share of a 38-game one.
   *
   * `starts / (minutes / 90)` was wrong and wrong in a damaging direction: for
   * a fringe defender with 8 starts and 900 minutes it returns 0.8, implying a
   * nailed starter, when the honest figure is closer to 0.2. Every squad player
   * inherited a near-certain start, which is why defenders as a group projected
   * at 1.7x FPL's own numbers.
   *
   * Substitute appearances are not reported, so they are inferred from the
   * minutes a start does not account for.
   */
  const SEASON_GAMEWEEKS = 38;
  const MINUTES_PER_START = 85;
  const MINUTES_PER_SUB = 22;
  const subAppearances = Math.max(0, (minutes - starts * MINUTES_PER_START) / MINUTES_PER_SUB);
  const appearances = starts + subAppearances;

  return {
    xg90: per90(get('expected_goals'), minutes),
    xa90: per90(get('expected_assists'), minutes),
    xgc90: per90(get('expected_goals_conceded'), minutes),
    bps90: per90(get('bps'), minutes),
    bonus90: per90(get('bonus'), minutes),
    defcon90: per90(get('defensive_contribution'), minutes),
    saves90: per90(get('saves'), minutes),
    startRate: appearances > 0 ? Math.min(1, starts / appearances) : 0.5,
    appearanceRate: Math.min(1, appearances / SEASON_GAMEWEEKS),
  };
}

function shrunk90(total: number, minutes: number, prior: number, k = SHRINKAGE_90S): number {
  const n90 = minutes / 90;
  return (total + prior * k) / (n90 + k);
}

/** The same idea for a bounded rate measured in gameweeks rather than minutes. */
function shrunkRate(hits: number, trials: number, prior: number, k = RATE_SHRINKAGE_GWS): number {
  return (hits + prior * k) / (trials + k);
}

/**
 * Elite Cohort Signals for one player.
 *
 * Percentages are computed here from stored counts and the denominator recorded
 * alongside them, never read as stored percentages — with ~20 managers a stored
 * percentage silently misreports the moment availability changes.
 *
 * Every value is `number | null`, and null means "not computable", never zero.
 * A gap in capture and "no elite manager owns this player" are different facts.
 */
function eliteSignalsFor(
  elementId: number,
  ordered: EliteDerivedGameweek[],
  generalOwnershipPct: number | null
): EliteSignals {
  const at = (offset: number) => ordered[ordered.length - 1 - offset] ?? null;

  const pctOf = (doc: EliteDerivedGameweek | null, field: string): number | null => {
    if (!doc || doc.availableManagerCount <= 0) return null;
    const i = doc.fields.indexOf(field);
    if (i === -1) return null;
    const count = doc.players[String(elementId)]?.[i] ?? 0;
    return (count / doc.availableManagerCount) * 100;
  };

  const n = at(0);
  const n1 = at(1);
  const n3 = at(3);

  // Differences are percentage POINTS, never ratios: (new - old) / old divides
  // by zero exactly when a player goes from no elite owners to some, which is
  // the transition the signal exists to catch.
  const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);

  const own = pctOf(n, 'owned');
  const cap = pctOf(n, 'captained');
  const eeo = own === null || cap === null ? null : own + cap;

  const eeoAt = (doc: EliteDerivedGameweek | null) => {
    const o = pctOf(doc, 'owned');
    const c = pctOf(doc, 'captained');
    return o === null || c === null ? null : o + c;
  };
  const deltaEo = eeo === null || generalOwnershipPct === null ? null : eeo - generalOwnershipPct;
  const prevEeo = eeoAt(n1);
  const deltaEoPrev =
    prevEeo === null || generalOwnershipPct === null ? null : prevEeo - generalOwnershipPct;

  const chipVolatility =
    n && n.availableManagerCount > 0
      ? ((n.chips.freehit ?? 0) + (n.chips.wildcard ?? 0)) / n.availableManagerCount
      : null;

  return {
    elite_ownership_pct: own,
    elite_ownership_change_1gw: diff(own, pctOf(n1, 'owned')),
    elite_ownership_change_3gw: diff(own, pctOf(n3, 'owned')),
    elite_captain_pct: cap,
    elite_captain_change_1gw: diff(cap, pctOf(n1, 'captained')),
    elite_transfer_in_rate: pctOf(n, 'transferredIn'),
    elite_transfer_out_rate: pctOf(n, 'transferredOut'),
    delta_eo: deltaEo,
    delta_eo_change_1gw: diff(deltaEo, deltaEoPrev),
    chipVolatility,
  };
}

export function buildFeatures(inputs: FeatureInputs, opts: BuildOptions = {}): FeatureSet {
  const includeElite = opts.includeElite ?? false;
  const maxEliteLag = opts.maxEliteLag ?? 2;
  const T = inputs.targetGameweek;

  // Only gameweeks strictly before the target, in order. Filtering here rather
  // than trusting the caller means assertNoLookahead should never fire — it is
  // the backstop, not the mechanism.
  const statGameweeks = [...inputs.playerStats.keys()].filter((gw) => gw < T).sort((a, b) => a - b);
  const orderedStats = statGameweeks.map((gw) => inputs.playerStats.get(gw)!);

  const eliteGameweeks = [...inputs.eliteDerived.keys()].filter((gw) => gw < T).sort((a, b) => a - b);
  const orderedElite = eliteGameweeks.map((gw) => inputs.eliteDerived.get(gw)!);

  const qualityFlags: string[] = [];
  if (!orderedStats.length) qualityFlags.push('no_player_history');
  else if (orderedStats.length < LONG_WINDOW) qualityFlags.push('short_player_history');
  if (!inputs.fixtures) qualityFlags.push('no_fixtures');
  if (!inputs.market) qualityFlags.push('no_market_snapshot');

  let usedElite = orderedElite;
  if (includeElite) {
    const latest = eliteGameweeks[eliteGameweeks.length - 1];
    if (latest === undefined) {
      qualityFlags.push('no_elite_data');
      usedElite = [];
    } else {
      // The lag is recorded, not hidden. A forecast for GW8 built on GW6
      // because GW7's capture failed is still usable; one built on GW3 is not.
      if (T - latest > maxEliteLag) {
        qualityFlags.push('stale_elite_data');
        usedElite = [];
      }
      const last = inputs.eliteDerived.get(latest)!;
      if (last.availableManagerCount < last.cohortSize * 0.75) {
        qualityFlags.push('low_cohort_availability');
      }
      const volatility =
        last.availableManagerCount > 0
          ? ((last.chips.freehit ?? 0) + (last.chips.wildcard ?? 0)) / last.availableManagerCount
          : 0;
      // Free Hit and Wildcard produce a one-week squad that reverts, so the
      // change features describe a chip rather than a trend.
      if (volatility > 0.25) qualityFlags.push('high_chip_volatility');
    }
  }

  const marketCell = (id: number, field: string): Cell | null => {
    if (!inputs.market) return null;
    const i = inputs.market.fields.indexOf(field);
    if (i === -1) return null;
    return inputs.market.players[String(id)]?.[i] ?? null;
  };
  const marketIndex = (id: number, field: string): number | null => {
    const v = marketCell(id, field);
    return v === null || v === '' ? null : Number(v);
  };

  /**
   * Probability the player is available at all, from FPL's own reporting.
   *
   * `status` and `chance_of_playing_next_round` disagree often enough that both
   * matter: a doubtful player with an explicit 75% is more informative than the
   * status letter, while an injured player with a null chance is not a coin
   * flip. Resolved here so the engine never has to parse a status code.
   */
  const availabilityOf = (id: number): number | null => {
    const status = marketCell(id, 'status');
    const chance = marketIndex(id, 'chance_of_playing_next_round');
    if (status === null) return null;
    if (chance !== null) return chance / 100;
    switch (String(status)) {
      case 'a': return 1;      // available
      case 'd': return 0.5;    // doubtful, no percentage given
      case 'i': return 0;      // injured
      case 's': return 0;      // suspended
      case 'u': return 0;      // unavailable
      case 'n': return 0;      // not in the squad
      default:  return 1;
    }
  };

  const baselines = computeBaselines(inputs.bootstrap, orderedStats);

  if (!inputs.priors) qualityFlags.push('no_prior_season');

  const players: PlayerFeatures[] = inputs.bootstrap.elements.map((el) => {
    const positionPrior = baselines[el.element_type];
    const seasonPrior = priorRatesFor(el.id, inputs.priors);
    // The player's own last season when it exists, his position's average when
    // it does not.
    const prior = seasonPrior
      ? { ...positionPrior, ...seasonPrior }
      : positionPrior;
    const long = totalsOver(el.id, orderedStats, LONG_WINDOW);
    const short = totalsOver(el.id, orderedStats, SHORT_WINDOW);

    const hasHistory = long.minutes > 0 || Boolean(seasonPrior);
    const base: Record<string, number | null> = {
      element_type: el.element_type,
      team: el.team,
      now_cost: el.now_cost,

      // Rolling rates. null rather than 0 when a player has never played:
      // "no data" and "does nothing" must not look the same to the model.
      minutes_per_gw_long: long.gameweeks ? long.minutes / long.gameweeks : null,
      minutes_per_gw_short: short.gameweeks ? short.minutes / short.gameweeks : null,
      start_rate: prior && long.gameweeks
        ? shrunkRate(long.starts, long.appearances, prior.startRate)
        : null,
      appearance_rate: prior && long.gameweeks
        ? shrunkRate(long.appearances, long.gameweeks, prior.appearanceRate)
        : null,

      // Shrunk toward the position baseline. The raw rates are kept alongside
      // so a backtest can measure whether the shrinkage helps or hurts.
      xg90: hasHistory && prior ? shrunk90(long.xG, long.minutes, prior.xg90) : null,
      xa90: hasHistory && prior ? shrunk90(long.xA, long.minutes, prior.xa90) : null,
      xgi90: hasHistory && prior
        ? shrunk90(long.xG + long.xA, long.minutes, prior.xg90 + prior.xa90)
        : null,
      xgc90: hasHistory && prior ? shrunk90(long.xGC, long.minutes, prior.xgc90) : null,
      bps90: hasHistory && prior ? shrunk90(long.bps, long.minutes, prior.bps90) : null,
      // Predicted from bonus actually won, not converted from bps.
      //
      // bps is a ranking stat every player accrues in every match; bonus is 6
      // points per match shared by three of roughly twenty-eight players, so
      // the population average is about 0.2 per appearance. Mapping bps to
      // bonus linearly hands that 0.2 to everyone as 0.6-0.8, and it lands
      // hardest on defenders, whose bps is inflated by clean sheets — which is
      // exactly where the overestimate showed up (DEF ran 1.75x FPL's own
      // projection, FWD only 1.29x).
      bonus90: hasHistory && prior ? shrunk90(long.bonus, long.minutes, prior.bonus90) : null,
      bonus_per_gw: long.gameweeks ? long.bonus / long.gameweeks : null,
      saves90: hasHistory && prior ? shrunk90(long.saves, long.minutes, prior.saves90) : null,
      defcon90: hasHistory && prior ? shrunk90(long.defcon, long.minutes, prior.defcon90) : null,

      xg90_raw: hasHistory ? per90(long.xG, long.minutes) : null,
      xa90_raw: hasHistory ? per90(long.xA, long.minutes) : null,
      minutes_played: long.minutes,
      /** 1 when shrunk toward the player's own last season, 0 toward his position. */
      has_season_prior: seasonPrior ? 1 : 0,
      points_per_gw_long: long.gameweeks ? long.points / long.gameweeks : null,
      points_per_gw_short: short.gameweeks ? short.points / short.gameweeks : null,

      // Availability, from the market snapshot rather than history.
      availability: availabilityOf(el.id),
      chance_of_playing: marketIndex(el.id, 'chance_of_playing_next_round'),
      selected_by_percent: marketIndex(el.id, 'selected_by_percent'),
      form: marketIndex(el.id, 'form'),
      ep_next: marketIndex(el.id, 'ep_next'),
      transfers_in_event: marketIndex(el.id, 'transfers_in_event'),
      transfers_out_event: marketIndex(el.id, 'transfers_out_event'),
    };

    const out: PlayerFeatures = { elementId: el.id, base };
    if (includeElite) {
      out.elite = eliteSignalsFor(el.id, usedElite, base.selected_by_percent);
    }
    return out;
  });

  const fs: FeatureSet = {
    season: inputs.season,
    targetGameweek: T,
    targetDeadline: inputs.targetDeadline,
    includeElite,
    sources: {
      playerStats: statGameweeks,
      elite: includeElite ? usedElite.map((d) => d.gameweek) : [],
      market: inputs.market ? [inputs.market.date] : [],
      fixtures: inputs.season,
    },
    qualityFlags,
    players,
  };

  // Gate one of two. The second is at the start of forecast().
  assertNoLookahead(fs);
  return fs;
}

export { PLAYER_STAT_FIELDS };
