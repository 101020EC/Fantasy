import { FPLElementType, FPLTeam, PriceAnalysis } from './types';

/**
 * The market table's row, and the exact list of fields that reach the client.
 *
 * This lives in lib/ rather than beside the table because the table is a
 * `'use client'` module: a *value* exported from one and imported by a server
 * component comes back as a client reference, not the array — TypeScript is
 * happy and the page throws "is not iterable" at runtime. Types cross that
 * boundary; constants do not.
 *
 * Why it exists at all: `PriceAnalysis` embeds the whole `FPLTeam` and
 * `FPLElementType` object per row and carries baselines, raw transfer counts
 * and threshold provenance the table never reads. Across 616 players that was
 * 648KB, of which 394KB was twenty clubs and four positions repeated.
 */
export const MARKET_ROW_FIELDS = [
  'elementId',
  'webName',
  'fullName',
  'currentCost',
  'selectedByPercent',
  'netTransfers',
  'status',
  'changeScore',
  'news',
  'chanceOfPlaying',
] as const;

export type MarketRow = Pick<PriceAnalysis, (typeof MARKET_ROW_FIELDS)[number]> & {
  teamId: number;
  typeId: number;
};

/** Lookups sent once instead of once per player. */
export interface MarketLookups {
  teams: FPLTeam[];
  types: FPLElementType[];
}

export function toMarketRow(a: PriceAnalysis): MarketRow {
  const row = { teamId: a.team.id, typeId: a.elementType.id } as MarketRow;
  for (const f of MARKET_ROW_FIELDS) (row as Record<string, unknown>)[f] = a[f];
  return row;
}

/**
 * The wire format: one positional array per player instead of an object.
 *
 * Twelve field names, quoted and repeated 616 times, cost more than the values
 * they label — roughly 90KB of the 171KB the page was shipping. The same
 * reasoning already governs `market/{date}` in Firestore; this applies it to the
 * RSC payload.
 *
 * The order lives here and nowhere else, and both directions are derived from
 * the same constant, so a field cannot be added to one and forgotten in the
 * other.
 */
export const MARKET_CELL_ORDER = [...MARKET_ROW_FIELDS, 'teamId', 'typeId'] as const;

export type MarketCell = string | number | null;

export function toMarketCells(row: MarketRow): MarketCell[] {
  return MARKET_CELL_ORDER.map((f) => (row as Record<string, MarketCell>)[f] ?? null);
}

export function fromMarketCells(cells: MarketCell[]): MarketRow {
  const row = {} as Record<string, MarketCell>;
  MARKET_CELL_ORDER.forEach((f, i) => {
    row[f] = cells[i];
  });
  return row as unknown as MarketRow;
}
