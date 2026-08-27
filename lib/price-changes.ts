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
   * Threshold samples for the players who moved, attached by the cron so the
   * fitter only ever has to read this collection. Absent on documents written
   * before the fitter existed, and on any day with no usable baselines.
   */
  observations?: ThresholdObservation[];
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

// ─────────────────────────────────────────────────────────────────────────────
// Transfer baselines
// ─────────────────────────────────────────────────────────────────────────────

export interface TransferBaseline {
  transfersIn: number;
  transfersOut: number;
  /**
   * The snapshot date the baseline was taken from, or null when the baseline is
   * the start of the gameweek (the player has not changed price since).
   */
  since: string | null;
}

/**
 * Where each player's price counter was last reset.
 *
 * FPL resets a player's internal progress counter **every time their price
 * changes**, but the public `transfers_in_event` / `transfers_out_event` fields
 * reset only at the gameweek rollover. So once a player has risen, the
 * transfers that caused the rise keep counting, and any score built on the raw
 * gameweek total stays pinned high for the rest of the week.
 *
 * `cost_change_event` is the tell: it is that player's net price movement this
 * gameweek. The last snapshot at which it held a different value is the last
 * state before the reset, so its transfer counts are the baseline to subtract.
 *
 * Snapshots must be oldest first. A player whose `cost_change_event` never moves
 * across the window gets `since: null` and a zero baseline, which is already
 * correct — the raw fields did reset at the gameweek boundary.
 */
export function findTransferBaselines(
  snapshots: SnapshotLike[]
): Map<number, TransferBaseline> {
  const out = new Map<number, TransferBaseline>();
  if (!snapshots.length) return out;

  const latest = snapshots[snapshots.length - 1];

  for (const key of Object.keys(latest.players)) {
    const id = Number(key);
    const currentChange = num(snapshotValue(latest, key, 'cost_change_event')) ?? 0;
    const currentIn = num(snapshotValue(latest, key, 'transfers_in_event')) ?? 0;
    const currentOut = num(snapshotValue(latest, key, 'transfers_out_event')) ?? 0;

    let baseline: TransferBaseline = { transfersIn: 0, transfersOut: 0, since: null };

    for (let i = snapshots.length - 2; i >= 0; i--) {
      const snap = snapshots[i];

      // A snapshot from a different gameweek is useless as a baseline: both
      // `cost_change_event` and the transfer counters reset at the rollover, so
      // its larger transfer totals would subtract to a negative and read as a
      // collapse that never happened.
      if (snap.gameweek !== latest.gameweek) break;

      const past = num(snapshotValue(snap, key, 'cost_change_event'));
      if (past === null || past === currentChange) continue;

      // This is the last state before the most recent change. Its transfer
      // totals are what FPL had counted at the moment it reset them.
      const inAt = num(snapshotValue(snap, key, 'transfers_in_event')) ?? 0;
      const outAt = num(snapshotValue(snap, key, 'transfers_out_event')) ?? 0;

      // Defensive: a baseline above the current total would mean the counters
      // reset without `cost_change_event` moving, which should not happen. Fall
      // back to the gameweek start rather than emit a negative net.
      if (inAt > currentIn || outAt > currentOut) break;

      baseline = { transfersIn: inAt, transfersOut: outAt, since: snap.date };
      break;
    }

    out.set(id, baseline);
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Threshold observations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One labelled sample of FPL's real price-change threshold.
 *
 * When a player's price moves, the net transfers they had accumulated since
 * their previous change IS the threshold they just crossed, at that ownership.
 * That is the only way to see the number: FPL never publishes it, and it drifts
 * through the season as the active manager count changes.
 *
 * `netAtChange` is measured at the snapshot BEFORE the change, so it is a lower
 * bound - the true crossing happened some time in the following half hour. Good
 * enough to fit a scale factor; not a precise measurement of one player.
 */
export interface ThresholdObservation {
  elementId: number;
  /** selected_by_percent at the moment of the change. */
  ownership: number;
  /** Net transfers accumulated since the previous change, signed. */
  netAtChange: number;
  direction: 'rise' | 'fall';
}

/**
 * Builds threshold samples for the players who moved in `day`.
 *
 * `snapshots` must be oldest first and must END at the snapshot immediately
 * before the change - i.e. `day.previousDate`. Passing the later snapshot would
 * measure transfers accumulated after the reset instead of before it.
 */
export function buildThresholdObservations(
  snapshots: SnapshotLike[],
  day: PriceChangeDay
): ThresholdObservation[] {
  if (!snapshots.length) return [];

  const atChange = snapshots[snapshots.length - 1];
  if (atChange.date !== day.previousDate) {
    throw new Error(
      `observations must end at ${day.previousDate}, got ${atChange.date}`
    );
  }

  // Baselines as they stood BEFORE this night's changes reset them.
  const baselines = findTransferBaselines(snapshots);

  const out: ThresholdObservation[] = [];
  for (const change of day.changes) {
    const base = baselines.get(change.id);
    if (!base) continue;

    const inAt = num(snapshotValue(atChange, change.id, 'transfers_in_event'));
    const outAt = num(snapshotValue(atChange, change.id, 'transfers_out_event'));
    const ownership = num(snapshotValue(atChange, change.id, 'selected_by_percent'));
    if (inAt === null || outAt === null) continue;

    const netAtChange = inAt - base.transfersIn - (outAt - base.transfersOut);

    // A rise needs positive net and a fall needs negative net. Anything else
    // means the baseline is wrong for this player - most likely the change
    // happened during a gap in the snapshots - and a wrong sample is worse than
    // no sample.
    const direction = change.delta > 0 ? 'rise' : 'fall';
    if (direction === 'rise' && netAtChange <= 0) continue;
    if (direction === 'fall' && netAtChange >= 0) continue;

    out.push({
      elementId: change.id,
      ownership: ownership ?? 0,
      netAtChange,
      direction,
    });
  }

  return out;
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
