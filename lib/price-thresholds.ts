import { ThresholdObservation } from './price-changes';

/**
 * How many net transfers FPL requires before a price moves.
 *
 * FPL never publishes this number and it drifts through the season with the
 * active manager count, so the only honest source is the changes we observe:
 * when a player's price moves, the net transfers they had accumulated since
 * their previous change is the threshold they just crossed.
 *
 * This follows the shape lib/calibration.ts already uses for the forecast:
 * shrink hard toward the unfitted formula while the sample is small, clamp the
 * result, and carry notes explaining which of the two is actually in force so
 * the UI can say "estimated" rather than presenting a guess as a measurement.
 */

export const THRESHOLD_COMPUTE_VERSION = 1;

/** Samples before the fit carries its full weight. */
const FULL_WEIGHT_SAMPLES = 20;
/** Below this the fit is not applied at all — a handful of changes is noise. */
const MIN_SAMPLES = 6;
/** The fitted scale cannot move further than this from the formula. */
const SCALE_MIN = 0.4;
const SCALE_MAX = 2.5;

export interface PriceThresholds {
  season: string;
  generatedAt: string;
  computeVersion: number;
  /** priceChanges dates the samples came from. */
  sourceDays: string[];
  /** Multiplier on the fallback formula for rises. 1 = formula unchanged. */
  riseScale: number;
  fallScale: number;
  riseSamples: number;
  fallSamples: number;
  /** False while either side is still running on the unfitted formula. */
  fitted: boolean;
  /** Plain-language reasons, rendered directly in the UI. */
  notes: string[];
}

/**
 * The unfitted estimate, unchanged from the original implementation.
 *
 * Roughly proportional to ownership, with a floor so a barely-owned player does
 * not appear to be one transfer from a price rise. It has never been checked
 * against a real change; that is what the fit above is for.
 */
export function fallbackThreshold(ownership: number): number {
  return Math.max(25_000, (ownership || 1) * 12_000);
}

export function emptyThresholds(season: string, now: Date = new Date()): PriceThresholds {
  return {
    season,
    generatedAt: now.toISOString(),
    computeVersion: THRESHOLD_COMPUTE_VERSION,
    sourceDays: [],
    riseScale: 1,
    fallScale: 1,
    riseSamples: 0,
    fallSamples: 0,
    fitted: false,
    notes: ['No price change has been observed yet, so the unfitted estimate is in use.'],
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Fits one scale factor per direction.
 *
 * The median rather than the mean: one player whose baseline was misplaced by a
 * gap in the snapshots produces an enormous ratio, and a mean would follow it.
 *
 * Rises and falls are fitted separately because they are not the same event —
 * a fall is driven by people leaving a player, often after an injury, and the
 * traffic behaves differently from the traffic into a bandwagon.
 */
export function fitPriceThresholds(
  observations: ThresholdObservation[],
  opts: { season: string; sourceDays: string[]; now?: Date }
): PriceThresholds {
  const now = opts.now ?? new Date();
  const notes: string[] = [];

  const ratiosFor = (direction: 'rise' | 'fall') =>
    observations
      .filter((o) => o.direction === direction)
      .map((o) => Math.abs(o.netAtChange) / fallbackThreshold(o.ownership))
      .filter((r) => Number.isFinite(r) && r > 0);

  const fitOne = (direction: 'rise' | 'fall') => {
    const ratios = ratiosFor(direction);
    if (ratios.length < MIN_SAMPLES) {
      notes.push(
        `${direction === 'rise' ? 'Rises' : 'Falls'}: ${ratios.length} of ${MIN_SAMPLES} samples needed — still using the unfitted estimate.`
      );
      return { scale: 1, n: ratios.length, fitted: false };
    }

    const raw = median(ratios);
    // Shrink toward 1: with 6 samples the fit moves less than a third of the
    // way, with 20 it moves all the way. Without this a quiet week with three
    // odd changes would rewrite the whole table.
    const weight = Math.min(1, ratios.length / FULL_WEIGHT_SAMPLES);
    const scale = clamp(1 + (raw - 1) * weight, SCALE_MIN, SCALE_MAX);

    notes.push(
      `${direction === 'rise' ? 'Rises' : 'Falls'}: fitted from ${ratios.length} observed changes (x${scale.toFixed(2)}).`
    );
    return { scale, n: ratios.length, fitted: true };
  };

  const rise = fitOne('rise');
  const fall = fitOne('fall');

  return {
    season: opts.season,
    generatedAt: now.toISOString(),
    computeVersion: THRESHOLD_COMPUTE_VERSION,
    sourceDays: [...opts.sourceDays].sort(),
    riseScale: rise.scale,
    fallScale: fall.scale,
    riseSamples: rise.n,
    fallSamples: fall.n,
    fitted: rise.fitted && fall.fitted,
    notes,
  };
}

/**
 * The threshold to divide by, for one player in one direction.
 *
 * `thresholds` absent, unfitted, or from a different compute version all fall
 * back to the formula — a stale fit is worse than an honest estimate.
 */
export function thresholdFor(
  ownership: number,
  direction: 'rise' | 'fall',
  thresholds?: PriceThresholds | null
): number {
  const base = fallbackThreshold(ownership);
  if (!thresholds || thresholds.computeVersion !== THRESHOLD_COMPUTE_VERSION) return base;
  const scale = direction === 'rise' ? thresholds.riseScale : thresholds.fallScale;
  return base * (Number.isFinite(scale) && scale > 0 ? scale : 1);
}
