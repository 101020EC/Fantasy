import { ThresholdObservation } from './price-changes';

/**
 * How many net transfers FPL requires before a price moves.
 *
 * The two directions do not share a shape, and getting that wrong was the
 * original bug. Measured against livefpl's published progress on 2026-08-27,
 * over 17 players spanning 0.0%-43% ownership:
 *
 *   RISES are a CONSTANT.  Ownership spanned 17x; the implied threshold spanned
 *   1.27x (194k-246k, median 216,647 = 2.21% of `total_players`). Mechanically
 *   obvious once seen: **anyone can buy a player**, so the pool that has to move
 *   is every manager in the game, not the ones who already own him.
 *
 *   FALLS scale with OWNERSHIP.  Six of seven clean samples landed within 3% of
 *   ~19,000 net per 1% owned - roughly a fifth of that player's owners. Also
 *   mechanical: **only an owner can sell.**
 *
 * The old single ownership-proportional divisor was therefore the wrong shape
 * for rises and the right shape with the wrong constant for falls. It reported
 * 26 players rising tonight where livefpl reported one.
 *
 * These constants are starting points, not conclusions. Every price change we
 * observe is a direct sample of the threshold it crossed, and `fitPriceThresholds`
 * replaces the defaults as those accumulate.
 */

export const THRESHOLD_COMPUTE_VERSION = 2;

/** Samples before a fit carries its full weight. */
const FULL_WEIGHT_SAMPLES = 20;
/** Below this the fit is not applied at all — a handful of changes is noise. */
const MIN_SAMPLES = 6;

/**
 * Rise threshold as a fraction of the total manager base.
 *
 * Stored as a fraction rather than a raw count so it tracks the player base as
 * it grows through the season instead of ageing into a stale number.
 */
export const DEFAULT_RISE_FRACTION = 0.0221;

/** Fall threshold per 1% of ownership. */
export const DEFAULT_FALL_PER_PCT = 19_071;

/**
 * Minimum fall threshold, regardless of ownership.
 *
 * `selected_by_percent` is rounded to one decimal, so a player reported at
 * "0.0%" has an ownership anywhere in [0, 0.05%] and the divisor becomes mostly
 * rounding error. Without this floor, 74 such players flood the faller list on
 * a few hundred net transfers each. The floor suppresses them; it is a guard
 * against the input's resolution, not a measured quantity, and is labelled as
 * such wherever it surfaces.
 */
export const DEFAULT_FALL_FLOOR = 15_000;

/** Sanity bands, so one strange change cannot distort the table. */
const RISE_FRACTION_BAND: [number, number] = [0.005, 0.06];
const FALL_PER_PCT_BAND: [number, number] = [6_000, 60_000];

/**
 * Fallback manager count, used only when a caller cannot supply
 * `bootstrap.total_players`. Roughly the 2026/27 base.
 */
export const FALLBACK_TOTAL_PLAYERS = 9_800_000;

export interface PriceThresholds {
  season: string;
  generatedAt: string;
  computeVersion: number;
  /** priceChanges dates the samples came from. */
  sourceDays: string[];

  /** Rise threshold = totalPlayers * riseFraction. */
  riseFraction: number;
  /** Fall threshold = max(fallFloor, ownershipPercent * fallPerPercent). */
  fallPerPercent: number;
  fallFloor: number;

  riseSamples: number;
  fallSamples: number;
  /** Per direction, so the UI can trust one and hedge the other. */
  riseFitted: boolean;
  fallFitted: boolean;
  /** True only when BOTH directions rest on observed changes. */
  fitted: boolean;

  /** Plain-language reasons, rendered directly in the UI. */
  notes: string[];
}

export function emptyThresholds(season: string, now: Date = new Date()): PriceThresholds {
  return {
    season,
    generatedAt: now.toISOString(),
    computeVersion: THRESHOLD_COMPUTE_VERSION,
    sourceDays: [],
    riseFraction: DEFAULT_RISE_FRACTION,
    fallPerPercent: DEFAULT_FALL_PER_PCT,
    fallFloor: DEFAULT_FALL_FLOOR,
    riseSamples: 0,
    fallSamples: 0,
    riseFitted: false,
    fallFitted: false,
    fitted: false,
    notes: ['No price change has been observed yet, so the starting estimates are in use.'],
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(value: number, [lo, hi]: [number, number]): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Fits the rise fraction and the fall per-percent from observed changes.
 *
 * The median rather than the mean: one player whose baseline was misplaced by a
 * gap in the snapshots produces an enormous ratio, and a mean would follow it.
 *
 * `fallFloor` is deliberately NOT fitted. It exists to paper over the rounding
 * of `selected_by_percent`, so there is nothing in the data for it to learn
 * from - and a value that looks fitted would invite the reader to trust it.
 */
export function fitPriceThresholds(
  observations: ThresholdObservation[],
  opts: { season: string; sourceDays: string[]; totalPlayers?: number; now?: Date }
): PriceThresholds {
  const now = opts.now ?? new Date();
  const totalPlayers = opts.totalPlayers || FALLBACK_TOTAL_PLAYERS;
  const notes: string[] = [];

  // Rises: the threshold is a flat count, so each sample says what fraction of
  // the manager base had to move.
  const riseSamples = observations
    .filter((o) => o.direction === 'rise')
    .map((o) => Math.abs(o.netAtChange) / totalPlayers)
    .filter((r) => Number.isFinite(r) && r > 0);

  // Falls: the threshold scales with ownership, so each sample says how many
  // net transfers one percent of ownership was worth. Samples below the
  // rounding resolution carry no information and are dropped rather than
  // averaged in.
  const fallSamples = observations
    .filter((o) => o.direction === 'fall' && o.ownership >= 0.5)
    .map((o) => Math.abs(o.netAtChange) / o.ownership)
    .filter((r) => Number.isFinite(r) && r > 0);

  const fitOne = <T extends number>(
    samples: number[],
    fallback: T,
    band: [number, number],
    label: string,
    format: (v: number) => string
  ) => {
    if (samples.length < MIN_SAMPLES) {
      notes.push(
        `${label}: ${samples.length} of ${MIN_SAMPLES} samples needed — still using the starting estimate.`
      );
      return { value: fallback as number, n: samples.length, fitted: false };
    }
    const raw = median(samples);
    // Shrink toward the default: with 6 samples the fit moves less than a third
    // of the way, with 20 it moves all the way. Without this a quiet week with
    // three odd changes would rewrite the whole table.
    const weight = Math.min(1, samples.length / FULL_WEIGHT_SAMPLES);
    const value = clamp(fallback + (raw - fallback) * weight, band);
    notes.push(`${label}: fitted from ${samples.length} observed changes (${format(value)}).`);
    return { value, n: samples.length, fitted: true };
  };

  const rise = fitOne(
    riseSamples,
    DEFAULT_RISE_FRACTION,
    RISE_FRACTION_BAND,
    'Rises',
    (v) => `${(v * 100).toFixed(2)}% of all managers`
  );
  const fall = fitOne(
    fallSamples,
    DEFAULT_FALL_PER_PCT,
    FALL_PER_PCT_BAND,
    'Falls',
    (v) => `${Math.round(v).toLocaleString()} per 1% owned`
  );

  notes.push(
    'Falls are the less certain half: two players at the same ownership can imply very different thresholds, so treat a falling percentage as a direction rather than a measurement.'
  );

  return {
    season: opts.season,
    generatedAt: now.toISOString(),
    computeVersion: THRESHOLD_COMPUTE_VERSION,
    sourceDays: [...opts.sourceDays].sort(),
    riseFraction: rise.value,
    fallPerPercent: fall.value,
    fallFloor: DEFAULT_FALL_FLOOR,
    riseSamples: rise.n,
    fallSamples: fall.n,
    riseFitted: rise.fitted,
    fallFitted: fall.fitted,
    fitted: rise.fitted && fall.fitted,
    notes,
  };
}

/**
 * The threshold to divide by, for one player in one direction.
 *
 * `thresholds` absent, or from a different compute version, falls back to the
 * defaults — a stale fit is worse than an honest starting estimate.
 */
export function thresholdFor(
  ownership: number,
  direction: 'rise' | 'fall',
  thresholds?: PriceThresholds | null,
  totalPlayers?: number
): number {
  const usable =
    thresholds && thresholds.computeVersion === THRESHOLD_COMPUTE_VERSION ? thresholds : null;

  if (direction === 'rise') {
    const fraction = usable?.riseFraction ?? DEFAULT_RISE_FRACTION;
    return (totalPlayers || FALLBACK_TOTAL_PLAYERS) * fraction;
  }

  const perPct = usable?.fallPerPercent ?? DEFAULT_FALL_PER_PCT;
  const floor = usable?.fallFloor ?? DEFAULT_FALL_FLOOR;
  return Math.max(floor, (ownership || 0) * perPct);
}

/** Whether the direction a player is heading rests on observed changes. */
export function isFitted(
  direction: 'rise' | 'fall',
  thresholds?: PriceThresholds | null
): boolean {
  if (!thresholds || thresholds.computeVersion !== THRESHOLD_COMPUTE_VERSION) return false;
  return direction === 'rise' ? thresholds.riseFitted : thresholds.fallFitted;
}
