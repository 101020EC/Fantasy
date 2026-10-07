/**
 * The elite capture-selection rule, kept free of Firebase and the FPL client so
 * it can be tested on its own (tests/elite-capture.test.mjs). Re-exported from
 * elite-cohort.ts, where it is used.
 */

/**
 * Which gameweek to capture next, if any.
 *
 * Two different jobs in one rule, and the order matters:
 *
 * 1. A **finalised** gameweek with no finalised snapshot. This includes a week
 *    already captured provisionally — `storedFinal` counts only data-checked
 *    captures, so the provisional one is deliberately re-captured and overwritten
 *    once FPL settles the scores.
 * 2. Otherwise the **in-flight** gameweek: its deadline has passed, so squads and
 *    transfers are public and frozen, but FPL has not data-checked it. Captured
 *    only if never captured at all, which is what stops this running every night
 *    for the same week.
 *
 * Finalised wins, because a settled capture is worth more than a fresh one and
 * only one runs per night.
 */
export function nextEliteCapture(opts: {
  finalised: number[];
  /** Gameweeks with a data-checked snapshot. */
  storedFinal: number[];
  /** Gameweeks with any snapshot, provisional included. */
  storedAny: number[];
  events: { id: number; data_checked?: boolean; deadline_time: string }[];
  now?: Date;
}): { gameweek: number; dataChecked: boolean } | null {
  const pending = opts.finalised.filter((gw) => !opts.storedFinal.includes(gw));
  if (pending.length) return { gameweek: pending[0], dataChecked: true };

  const now = (opts.now ?? new Date()).getTime();
  const inFlight = opts.events
    .filter((e) => !e.data_checked && Date.parse(e.deadline_time) <= now)
    .map((e) => e.id)
    .sort((a, b) => b - a)[0];

  if (inFlight != null && !opts.storedAny.includes(inFlight)) {
    return { gameweek: inFlight, dataChecked: false };
  }
  return null;
}
