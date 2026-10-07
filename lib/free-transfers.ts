/**
 * How many free transfers a manager has for the next deadline.
 *
 * FPL does not publish the number, but it follows from the public history:
 * the first gameweek is squad selection, then every deadline adds one free
 * transfer up to a bank of five (`game_settings.max_extra_free_transfers` is 4,
 * plus the week's own). Free transfers used in a week come off before the next
 * one is added. A Wildcard or Free Hit week uses none of them — the bank is
 * kept and still grows by one.
 *
 * Transfers already made for the coming deadline are in the transfer list
 * (event = next gameweek) but not yet in the history, so they are taken off
 * at the end.
 *
 * Not modelled: one-off top-ups FPL announces mid-season (as it did for AFCON
 * in 2024/25). After one of those this undercounts until the bank fills —
 * the route still accepts `?freeTransfers=` to override.
 */
export const MAX_BANKED_FREE_TRANSFERS = 5;

export interface HistoryRow {
  event: number;
  event_transfers: number;
  event_transfers_cost: number;
}

export function freeTransfersFor(opts: {
  history: HistoryRow[];
  chips: { name: string; event: number }[];
  nextGameweek: number;
  /** Transfers already made for `nextGameweek`. */
  pendingTransfers?: number;
  maxBanked?: number;
}): number {
  const max = opts.maxBanked ?? MAX_BANKED_FREE_TRANSFERS;
  const rows = [...opts.history].sort((a, b) => a.event - b.event);
  if (!rows.length) return 1;

  const chipWeeks = new Set(
    opts.chips.filter((c) => c.name === 'wildcard' || c.name === 'freehit').map((c) => c.event)
  );

  // The entry's first gameweek is squad selection: no free transfer is spent,
  // and the next deadline starts with one.
  let ft = 1;
  for (const row of rows.slice(1)) {
    if (row.event >= opts.nextGameweek) break;
    if (!chipWeeks.has(row.event)) {
      const paid = Math.round((row.event_transfers_cost || 0) / 4);
      const freeUsed = Math.max(0, (row.event_transfers || 0) - paid);
      ft = Math.max(0, ft - freeUsed);
    }
    ft = Math.min(max, ft + 1);
  }
  return Math.max(0, ft - (opts.pendingTransfers ?? 0));
}
