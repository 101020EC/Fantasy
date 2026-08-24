import { FPLBootstrap, FPLEvent } from './types';

/**
 * Shared plumbing for the analyst extension (player stats, elite cohort,
 * forecasts). Everything new is gated and namespaced here so the existing app
 * — team pages, market, prices, Telegram, archive — is unaffected whether the
 * feature is on or off.
 */

/**
 * Master switch. Default OFF, including in production.
 *
 * Every analyst route and every analyst step inside the shared cron checks
 * this first. Turning it off returns the app to its previous behaviour exactly,
 * without reverting code — one environment variable and a redeploy.
 */
export const ANALYST_ENABLED = process.env.ANALYST_ENABLED === 'true';

export const ANALYST_DISABLED_MESSAGE =
  'The analyst features are disabled. Set ANALYST_ENABLED=true to turn them on.';

/**
 * Season key used as a path segment: eliteCohort/2026-27/…
 *
 * Risk F-7: nothing in the existing schema records a season, so gw_1 of the
 * next season would overwrite this one. Every new collection carries it in the
 * path instead of a field, which makes the collision impossible rather than
 * merely unlikely.
 *
 * Derived from the earliest deadline rather than the wall clock, because a
 * capture running in July sits between two seasons.
 */
export function seasonKey(bootstrap: FPLBootstrap): string {
  const deadlines = bootstrap.events
    .map((e) => e.deadline_time)
    .filter(Boolean)
    .sort();
  const start = deadlines[0] ? new Date(deadlines[0]).getUTCFullYear() : new Date().getUTCFullYear();
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/**
 * Gameweeks FPL has finalised.
 *
 * `data_checked` is the only trustworthy signal. A live gameweek still moves —
 * during GW1 the history endpoint said 94 while the league table said 93 — so
 * lib/league-history.ts already refuses to rebuild a week until this flips, and
 * every analyst capture uses the same gate. Risk F-2 is /api/archive not doing so.
 */
export function finalisedEvents(bootstrap: FPLBootstrap): FPLEvent[] {
  return bootstrap.events.filter((e) => e.data_checked);
}

export function currentEvent(bootstrap: FPLBootstrap): FPLEvent | undefined {
  return bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
}

/** `gw_7`, matching the ids the existing teams/ and leagues/ subcollections use. */
export function gwDocId(gameweek: number): string {
  return `gw_${gameweek}`;
}

type Cell = string | number | boolean | null;

/**
 * Positional-array encoding, lifted from lib/market-snapshot.ts.
 *
 * Firestore rejects an array of arrays outright, and repeating field names for
 * every player costs roughly four times the storage. A map of positional arrays
 * is the compact layout it does accept; `fields` is stored alongside so an old
 * document stays readable after this list changes.
 */
export function row(source: object, fields: readonly string[]): Cell[] {
  return fields.map((f) => {
    const value = (source as any)[f];
    // Firestore rejects undefined; null is a real "not reported".
    return value === undefined ? null : value;
  });
}

/** Reads a positional array back using the `fields` stored with its document. */
export function cell<T = Cell>(values: Cell[], fields: string[], name: string): T | null {
  const i = fields.indexOf(name);
  return i === -1 ? null : ((values[i] ?? null) as T | null);
}
