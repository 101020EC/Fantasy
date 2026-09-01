/**
 * Price changes, derived from the daily market snapshots we already capture.
 *
 * Nothing here fetches anything. The whole feature is a read of `market/{date}`
 * documents that the snapshot cron has been writing since day one — two
 * consecutive days bracket exactly one of FPL's nightly price windows.
 *
 * The timing, in Bangkok, is what makes this work and is easy to get wrong:
 *
 *   08:00        snapshot for day D  — the last state BEFORE prices move
 *   08:30-09:30  FPL changes prices  — "day D's change"
 *   next 08:00   snapshot for day D+1 — the first state AFTER
 *
 * So `diffSnapshots(market/D, market/D+1)` yields day D's change, and a document
 * keyed by D+1 describes something that happened on **D**. `changedOn` carries
 * that; never infer the date from the document id.
 *
 * Everything is in tenths of a million, the unit FPL uses (75 = £7.5m). Prices
 * are converted for display only: 0.1 + 0.1 !== 0.2 in binary floating point,
 * and these values get summed.
 */

/** The shape a `market/{date}` document has, reduced to what is read here. */
export interface SnapshotLike {
  date: string;
  gameweek: number | null;
  fields: string[];
  players: Record<string, (string | number | null)[]>;
}

export interface PriceChange {
  /** FPL element id. */
  id: number;
  /** Tenths of a million, before. */
  from: number;
  /** Tenths of a million, after. */
  to: number;
  /** Signed, in tenths. +1 is a £0.1m rise. */
  delta: number;
}

export interface PriceChangeDay {
  /** Document id: the date of the LATER snapshot. */
  date: string;
  /** The date whose overnight window produced these changes. */
  changedOn: string;
  /** The earlier snapshot this was diffed against. */
  previousDate: string;
  /**
   * True when the two snapshots are not consecutive days. The changes are then
   * the sum of more than one night and must not be presented as one.
   */
  spansGap: boolean;
  computedAt: string;
  gameweek: number | null;
  /** Players present in both snapshots — the population the counts are over. */
  comparedPlayers: number;
  risesCount: number;
  fallsCount: number;
  /** Only players who actually moved, biggest absolute move first. */
  changes: PriceChange[];
  skipped: {
    /** In the new snapshot but not the old. A signing is not a rise from £0. */
    newPlayers: number[];
    /** In the old snapshot but not the new. A departure is not a crash. */
    missingPlayers: number[];
  };
  /**
   * Threshold samples the app used to fit its own prediction from. FPL now
   * publishes its predictions directly, so nothing writes or reads these any
   * more; the field stays declared because historical documents still carry it
   * and dropping it from the type would make them fail to parse.
   */
  observations?: unknown[];
}

/** Reads one field for one player, by name rather than by position.
 *
 * `fields` travels with every snapshot precisely so the list can grow without
 * invalidating older documents. Hard-coding an index would break every
 * historical snapshot the day a field is added. */
export function snapshotValue(
  snapshot: SnapshotLike,
  elementId: number | string,
  field: string
): string | number | null {
  const i = snapshot.fields.indexOf(field);
  if (i === -1) return null;
  return snapshot.players[String(elementId)]?.[i] ?? null;
}

function num(value: string | number | null): number | null {
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Whether two ISO dates are one calendar day apart. */
function isConsecutive(earlier: string, later: string): boolean {
  const a = Date.parse(`${earlier}T00:00:00Z`);
  const b = Date.parse(`${later}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return b - a === 86_400_000;
}

/**
 * The changes between two snapshots. Pure: same inputs, same output, no I/O.
 *
 * `prev` must be the older of the two; passing them the wrong way round would
 * report every rise as a fall, so it is checked rather than assumed.
 */
export function diffSnapshots(
  prev: SnapshotLike,
  curr: SnapshotLike,
  now: Date = new Date()
): PriceChangeDay {
  if (prev.date >= curr.date) {
    throw new Error(
      `diffSnapshots expects prev before curr, got ${prev.date} and ${curr.date}`
    );
  }

  const changes: PriceChange[] = [];
  const newPlayers: number[] = [];
  const missingPlayers: number[] = [];
  let comparedPlayers = 0;

  for (const key of Object.keys(curr.players)) {
    const id = Number(key);
    const to = num(snapshotValue(curr, key, 'now_cost'));
    if (to === null) continue;

    const from = num(snapshotValue(prev, key, 'now_cost'));
    if (from === null) {
      // Arrived between the two captures — a transfer-listed addition, or a
      // player the earlier snapshot simply did not carry. Either way there is
      // no previous price, so there is no change to report.
      newPlayers.push(id);
      continue;
    }

    comparedPlayers += 1;
    if (to !== from) changes.push({ id, from, to, delta: to - from });
  }

  for (const key of Object.keys(prev.players)) {
    if (!(key in curr.players)) missingPlayers.push(Number(key));
  }

  // Biggest mover first; a rise ahead of a fall of the same size, so the two
  // groups stay contiguous when the list is rendered in order.
  changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.delta - a.delta);

  return {
    date: curr.date,
    changedOn: prev.date,
    previousDate: prev.date,
    spansGap: !isConsecutive(prev.date, curr.date),
    computedAt: now.toISOString(),
    gameweek: curr.gameweek ?? null,
    comparedPlayers,
    risesCount: changes.filter((c) => c.delta > 0).length,
    fallsCount: changes.filter((c) => c.delta < 0).length,
    changes,
    skipped: { newPlayers, missingPlayers },
  };
}

/**
 * Changes between the newest stored snapshot and live FPL data.
 *
 * The alert runs at 06:00 Bangkok and the newest stored diff is computed at
 * 08:00, so an alert that read a precomputed document would report a change
 * that happened the morning BEFORE last - about 45 hours old. Comparing the
 * live bootstrap against the most recent snapshot instead gives yesterday
 * morning's change, roughly 21 hours old, which is the freshest answer this
 * schedule can produce.
 *
 * Returns the same shape as `diffSnapshots` so both feed one renderer.
 */
export function diffAgainstLive(
  prev: SnapshotLike,
  elements: { id: number; now_cost: number }[],
  now: Date = new Date()
): PriceChangeDay {
  const changes: PriceChange[] = [];
  const newPlayers: number[] = [];
  const seen = new Set<string>();
  let comparedPlayers = 0;

  for (const el of elements) {
    const key = String(el.id);
    seen.add(key);
    const from = num(snapshotValue(prev, key, 'now_cost'));
    if (from === null) {
      newPlayers.push(el.id);
      continue;
    }
    comparedPlayers += 1;
    if (el.now_cost !== from) {
      changes.push({ id: el.id, from, to: el.now_cost, delta: el.now_cost - from });
    }
  }

  const missingPlayers = Object.keys(prev.players)
    .filter((k) => !seen.has(k))
    .map(Number);

  changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.delta - a.delta);

  const date = now.toISOString().slice(0, 10);
  return {
    date,
    changedOn: prev.date,
    previousDate: prev.date,
    spansGap: !isConsecutive(prev.date, date),
    computedAt: now.toISOString(),
    gameweek: prev.gameweek ?? null,
    comparedPlayers,
    risesCount: changes.filter((c) => c.delta > 0).length,
    fallsCount: changes.filter((c) => c.delta < 0).length,
    changes,
    skipped: { newPlayers, missingPlayers },
  };
}
