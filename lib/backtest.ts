import { decodeFixtures, PlayerStatsGameweek } from './player-stats';
import { GameweekAccuracy, GameweekForecast, ModelScore } from './types';

/**
 * Scores forecasts against what actually happened.
 *
 * Pure: everything is passed in, so the metrics can be tested without a
 * database and recomputed later if a definition changes.
 */

export const COMPUTE_VERSION = 2;

/**
 * Ranks with ties averaged.
 *
 * Naive ranking breaks badly here: on a blank gameweek hundreds of players
 * share a projection of exactly 0, and assigning them arbitrary distinct ranks
 * invents an ordering that the model never expressed, which then shows up as
 * correlation that is not there.
 */
function rankAverage(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].v === order[i].v) j++;
    const shared = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k].i] = shared;
    i = j + 1;
  }
  return ranks;
}

/** Spearman's rho, computed as Pearson on averaged ranks so ties are handled. */
export function spearman(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2) return 0;
  const ra = rankAverage(a);
  const rb = rankAverage(b);
  const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = ra[i] - ma;
    const y = rb[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

/** Share of the actual top N that the predicted top N also contains. */
function topNHit(predicted: number[], actual: number[], ids: number[], n: number): number {
  const topOf = (values: number[]) =>
    new Set(
      ids
        .map((id, i) => ({ id, v: values[i] }))
        .sort((x, y) => y.v - x.v)
        .slice(0, n)
        .map((r) => r.id)
    );
  const p = topOf(predicted);
  const a = topOf(actual);
  let shared = 0;
  for (const id of a) if (p.has(id)) shared++;
  return shared / Math.min(n, ids.length || 1);
}

/**
 * How close counts as right, in points.
 *
 * A percentage has no meaning for a continuous prediction until a tolerance is
 * named, so the tolerance is named here and travels with the field name into the
 * UI. Two points is roughly the gap between a clean sheet and not.
 */
export const TOLERANCE = 2;
/**
 * The projection above which a player is one you would actually consider. The
 * unrestricted hit rate is dominated by the hundreds of players correctly
 * projected near zero, which is true but not an achievement.
 */
export const CONSIDERED_THRESHOLD = 3;

export function scoreModel(
  ids: number[],
  predicted: number[],
  actual: number[]
): ModelScore {
  const n = ids.length;
  if (n === 0) {
    return {
      mae: 0, rmse: 0, spearman: 0, top10Hit: 0, top20Hit: 0,
      within2: 0, within2Considered: 0, nConsidered: 0, bias: 0,
      n: 0, computeVersion: COMPUTE_VERSION,
    };
  }
  let absolute = 0;
  let squared = 0;
  let signed = 0;
  let within = 0;
  let consideredWithin = 0;
  let considered = 0;
  for (let i = 0; i < n; i++) {
    const d = predicted[i] - actual[i];
    absolute += Math.abs(d);
    squared += d * d;
    signed += d;
    const close = Math.abs(d) <= TOLERANCE;
    if (close) within += 1;
    if (predicted[i] >= CONSIDERED_THRESHOLD) {
      considered += 1;
      if (close) consideredWithin += 1;
    }
  }
  return {
    mae: Number((absolute / n).toFixed(4)),
    rmse: Number(Math.sqrt(squared / n).toFixed(4)),
    spearman: Number(spearman(predicted, actual).toFixed(4)),
    top10Hit: Number(topNHit(predicted, actual, ids, 10).toFixed(4)),
    top20Hit: Number(topNHit(predicted, actual, ids, 20).toFixed(4)),
    within2: Number((within / n).toFixed(4)),
    // Zero considered players is not 100% accuracy on an empty set; it is no
    // measurement, and the companion nConsidered is what says so.
    within2Considered: considered ? Number((consideredWithin / considered).toFixed(4)) : 0,
    nConsidered: considered,
    bias: Number((signed / n).toFixed(4)),
    n,
    computeVersion: COMPUTE_VERSION,
  };
}

/**
 * Points a player actually scored in a gameweek, summed across fixtures.
 *
 * A double gameweek has two rows and both count, which is the entire reason
 * player stats are stored per fixture. An absent key means the player did not
 * feature, which really is zero points — unlike an absent gameweek document,
 * which means the data is missing and must not be scored at all.
 */
export function actualPoints(stats: PlayerStatsGameweek, elementId: number): number {
  const values = stats.players[String(elementId)];
  if (!values) return 0;
  return decodeFixtures(values, stats.fields).reduce(
    (sum, f) => sum + (Number(f.total_points) || 0),
    0
  );
}

export interface ScoreInputs {
  season: string;
  gameweek: number;
  stats: PlayerStatsGameweek;
  /** model name -> the forecast to score. Every model uses the same population. */
  forecasts: Record<string, GameweekForecast>;
  /** FPL's own projection from the market snapshot taken before the deadline. */
  epNext: Record<string, number> | null;
  /** Points each reachable elite manager scored, for the human benchmark. */
  eliteManagerPoints?: number[];
  eliteAvailableManagerCount?: number;
}

/**
 * The population every model is scored on.
 *
 * Fixed ex ante and identical across models — not "players who played", which
 * is chosen using the result and would quietly reward a model for the games it
 * happened to get right. It is defined from the base forecast, which every run
 * produces, so adding an elite variant cannot change who gets scored.
 *
 * Elite features are null for unowned players, so a population derived from the
 * elite model would silently differ from the base one. That is an easy mistake
 * and it makes the comparison meaningless, which is why it is stated in the
 * stored document as `population` rather than left implicit.
 */
export const POPULATION = 'base_forecast_minutes_prob_gte_0.1';
const MIN_MINUTES_PROB = 0.1;

export function scoreGameweek(inputs: ScoreInputs, now: Date = new Date()): GameweekAccuracy {
  const base = inputs.forecasts.base;
  if (!base) throw new Error('A base forecast is required to define the scoring population');

  const ids = Object.entries(base.predictions)
    .filter(([, p]) => p.minutesProb >= MIN_MINUTES_PROB)
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);

  const actual = ids.map((id) => actualPoints(inputs.stats, id));

  const models: GameweekAccuracy['models'] = {};
  let publishedCoverage: number | undefined;
  for (const [name, fc] of Object.entries(inputs.forecasts)) {
    const predicted = ids.map((id) => fc.predictions[String(id)]?.xPts ?? 0);
    models[name as keyof GameweekAccuracy['models']] = scoreModel(ids, predicted, actual);
    // A player the stored forecast never mentioned is scored as 0, because the
    // population is fixed ex ante and cannot shrink to suit one model. That is
    // only fair if the document was in fact complete, so how complete it was
    // gets recorded rather than assumed.
    if (name === 'as_published') {
      const covered = ids.filter((id) => fc.predictions[String(id)] !== undefined).length;
      publishedCoverage = ids.length ? Number((covered / ids.length).toFixed(4)) : 0;
    }
  }
  if (inputs.epNext) {
    const predicted = ids.map((id) => inputs.epNext![String(id)] ?? 0);
    models.ep_next = scoreModel(ids, predicted, actual);
  }

  // Manager-level, unlike everything above. Reported alongside but never on
  // the same axis: "how well do we project a player" and "how well would
  // following the cohort have done" are different questions.
  let eliteActual: GameweekAccuracy['eliteActual'] = null;
  const pts = inputs.eliteManagerPoints ?? [];
  if (pts.length) {
    const sorted = [...pts].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    eliteActual = {
      mean: Number((sorted.reduce((s, v) => s + v, 0) / sorted.length).toFixed(2)),
      // Median as well as mean, because with twenty managers one Triple
      // Captain haul drags the mean several points and the gap between them
      // is itself information about how much of elite performance is variance.
      median:
        sorted.length % 2 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2)),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      availableManagerCount: inputs.eliteAvailableManagerCount ?? sorted.length,
    };
  }

  return {
    season: inputs.season,
    gameweek: inputs.gameweek,
    scoredAt: now.toISOString(),
    population: POPULATION,
    n: ids.length,
    models,
    publishedCoverage,
    eliteActual,
  };
}

/**
 * Whether elite features have earned a place in the numbers.
 *
 * The criteria are fixed here, in advance of any result, because deciding what
 * counts as an improvement after seeing the numbers is how a 20-manager sample
 * talks you into anything.
 */
export const PROMOTION = {
  minGameweeks: 8,
  /** No single gameweek may supply more than this share of the total gain. */
  maxSingleGameweekShare: 1 / 3,
};

export function evaluatePromotion(history: GameweekAccuracy[]): {
  eligible: boolean;
  reason: string;
  gameweeks: number;
  maeGain: number;
  spearmanGain: number;
} {
  const paired = history.filter((h) => h.models.base && h.models.elite);
  const gameweeks = paired.length;

  const maeGains = paired.map((h) => h.models.base!.mae - h.models.elite!.mae);
  const spearmanGains = paired.map((h) => h.models.elite!.spearman - h.models.base!.spearman);
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const maeGain = sum(maeGains);
  const spearmanGain = sum(spearmanGains);

  if (gameweeks < PROMOTION.minGameweeks) {
    return {
      eligible: false,
      reason: `Needs ${PROMOTION.minGameweeks} scored gameweeks with both models; has ${gameweeks}.`,
      gameweeks, maeGain, spearmanGain,
    };
  }
  if (maeGain <= 0 || spearmanGain <= 0) {
    return {
      eligible: false,
      reason: 'Elite features must improve both error and ranking; at least one got worse.',
      gameweeks, maeGain, spearmanGain,
    };
  }
  const largest = Math.max(...maeGains);
  if (largest > maeGain * PROMOTION.maxSingleGameweekShare) {
    return {
      eligible: false,
      reason: 'One gameweek supplies most of the improvement, which is noise rather than signal.',
      gameweeks, maeGain, spearmanGain,
    };
  }
  return {
    eligible: true,
    reason: `Elite features beat base on error and ranking across ${gameweeks} gameweeks.`,
    gameweeks, maeGain, spearmanGain,
  };
}
