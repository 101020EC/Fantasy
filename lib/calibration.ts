import { Calibration } from './types';

/**
 * Fits multiplicative corrections from what actually happened.
 *
 * Pure: every input is passed in, so the whole feedback loop is testable
 * without a database and can be refitted whenever a definition changes.
 *
 * The temptation this module exists to resist is "actual came in under
 * forecast, so cut the forecast". Done directly that is wrong twice over.
 * First it double-counts: lib/feature-builder.ts already rebuilds xG, xA,
 * minutes and start rate from playerStats every week, so a player whose
 * underlying numbers fall away is already projected lower without any help.
 * Second it chases noise: one gameweek of points is violently random — a
 * forward with 0.8 expected goals can return 2 points or 13 — and reacting to
 * a single week's realised total is how a model ends up permanently fighting
 * the last war.
 *
 * What the engine genuinely cannot see is systematic bias, and there are two
 * kinds. A whole position projected high (the unfitted constants in
 * forecast-engine's PRIORS are the cause, and the effect is measurable within a
 * few gameweeks once hundreds of players are pooled). And a single player who
 * persistently converts fewer points than his inputs imply — a poor finisher, a
 * defender who never places in the bonus top three. That second one is real but
 * thin, so it is shrunk hard and gated behind a minimum amount of evidence.
 */

export const COMPUTE_VERSION = 1;

/** Finalised gameweeks to fit on. Long enough to pool, short enough to move. */
export const CALIBRATION_WINDOW = 6;

/**
 * Gameweeks before a position factor is trusted at full weight. Below this it is
 * blended toward 1, so an early run of luck cannot rewrite the whole table.
 */
export const MIN_POSITION_GAMEWEEKS = 3;
export const POSITION_CLAMP: [number, number] = [0.6, 1.6];

/** A player needs this many scored gameweeks before he gets his own factor. */
export const MIN_PLAYER_GAMEWEEKS = 5;
/**
 * And this many forecast points in total. Without it a fringe player forecast at
 * 0.4 points five times over, who then scored once, produces a factor of 5.
 */
export const MIN_PLAYER_PREDICTED = 15;
/**
 * Shrinkage strength for a player factor, in multiples of his own evidence.
 *
 * At K = 2 a player needs twice as much evidence as the prior carries before his
 * factor moves even halfway to his raw ratio. Deliberately heavy: this is the
 * noisiest term in the whole model and the one most likely to look insightful
 * while being nothing.
 */
export const PLAYER_SHRINKAGE_K = 2;
export const PLAYER_CLAMP: [number, number] = [0.75, 1.3];

const clamp = (v: number, [lo, hi]: [number, number]) => Math.max(lo, Math.min(hi, v));

/** One player's forecast and outcome in one scored gameweek. */
export interface CalibrationObservation {
  gameweek: number;
  elementId: number;
  elementType: number;
  /** What was forecast BEFORE calibration — fitting on a corrected number would compound. */
  predicted: number;
  actual: number;
}

interface Tally {
  predicted: number;
  actual: number;
  gameweeks: Set<number>;
}

const emptyTally = (): Tally => ({ predicted: 0, actual: 0, gameweeks: new Set() });

/**
 * Ratios, not differences.
 *
 * xPts is a rate, so a difference punishes a bench player projected at 0.5 and a
 * captain projected at 8 by the same absolute amount, and the correction it
 * implies is meaningless for both. A ratio scales with the size of the claim.
 */
function ratio(actual: number, predicted: number): number | null {
  return predicted > 0 ? actual / predicted : null;
}

export function fitCalibration(
  season: string,
  observations: CalibrationObservation[],
  now: Date = new Date()
): Calibration {
  const notes: string[] = [];

  // Only the most recent window. A correction fitted on August is not the one
  // February needs, and the engine's own inputs have moved on by then anyway.
  const allGameweeks = [...new Set(observations.map((o) => o.gameweek))].sort((a, b) => a - b);
  const window = allGameweeks.slice(-CALIBRATION_WINDOW);
  const inWindow = new Set(window);
  const used = observations.filter((o) => inWindow.has(o.gameweek));

  const positionFactor: Record<string, number> = {};
  const playerFactor: Record<string, number> = {};

  if (!window.length) {
    notes.push('No finalised gameweek has been scored yet, so nothing is corrected.');
    return {
      season,
      sourceGameweeks: [],
      generatedAt: now.toISOString(),
      computeVersion: COMPUTE_VERSION,
      positionFactor,
      playerFactor,
      notes,
    };
  }

  const byPosition = new Map<number, Tally>();
  const byPlayer = new Map<number, Tally>();

  for (const o of used) {
    for (const [map, key] of [
      [byPosition, o.elementType] as const,
      [byPlayer, o.elementId] as const,
    ]) {
      let t = map.get(key);
      if (!t) map.set(key, (t = emptyTally()));
      t.predicted += o.predicted;
      t.actual += o.actual;
      t.gameweeks.add(o.gameweek);
    }
  }

  // ── Positions: pooled over hundreds of players, so it can be trusted early ──
  const weight = Math.min(1, window.length / MIN_POSITION_GAMEWEEKS);
  for (const [position, t] of byPosition) {
    const raw = ratio(t.actual, t.predicted);
    if (raw === null) continue;
    // Blend toward 1 rather than toward the raw ratio: with two gameweeks in
    // hand the honest correction is a small one, not a confident one.
    positionFactor[String(position)] = Number(
      clamp(1 + (raw - 1) * weight, POSITION_CLAMP).toFixed(4)
    );
  }
  if (window.length < MIN_POSITION_GAMEWEEKS) {
    notes.push(
      `Position factors are damped: ${window.length} of ${MIN_POSITION_GAMEWEEKS} gameweeks ` +
        `needed for full weight.`
    );
  }

  // ── Players: thin evidence, heavy shrinkage, tight clamp ──────────────────
  let qualified = 0;
  for (const [elementId, t] of byPlayer) {
    if (t.gameweeks.size < MIN_PLAYER_GAMEWEEKS) continue;
    if (t.predicted < MIN_PLAYER_PREDICTED) continue;
    const shrunk =
      (t.actual + PLAYER_SHRINKAGE_K * t.predicted) / (t.predicted * (1 + PLAYER_SHRINKAGE_K));
    playerFactor[String(elementId)] = Number(clamp(shrunk, PLAYER_CLAMP).toFixed(4));
    qualified += 1;
  }
  if (!qualified) {
    notes.push(
      `No player has both ${MIN_PLAYER_GAMEWEEKS} scored gameweeks and ` +
        `${MIN_PLAYER_PREDICTED} forecast points yet, so no per-player correction applies.`
    );
  }

  return {
    season,
    sourceGameweeks: window,
    generatedAt: now.toISOString(),
    computeVersion: COMPUTE_VERSION,
    positionFactor,
    playerFactor,
    notes,
  };
}

/**
 * The factor to apply to one player, or exactly 1 when nothing is known.
 *
 * Returning 1 rather than undefined keeps the caller arithmetic simple, but the
 * caller must still distinguish "1 because it was fitted at 1" from "1 because
 * nothing was fitted" when it explains itself to a reader — which is what
 * Calibration.sourceGameweeks and .notes are for.
 */
export function factorFor(
  calibration: Calibration | null,
  elementId: number,
  elementType: number
): number {
  if (!calibration) return 1;
  const position = calibration.positionFactor[String(elementType)] ?? 1;
  const player = calibration.playerFactor[String(elementId)] ?? 1;
  return position * player;
}
