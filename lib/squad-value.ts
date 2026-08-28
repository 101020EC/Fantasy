import { FPLElement, FPLPicksResponse } from './types';

/**
 * What FPL would pay you for a player today.
 *
 * A rise is shared: the manager keeps half of it, rounded DOWN in FPL's favour.
 * A fall is not — you take all of it. Summing `now_cost` instead produces a
 * number FPL never displays and overstates the squad every time a price rises,
 * which is most of the time for a squad worth looking at.
 *
 * Everything here is in tenths, as FPL sends it. `Math.floor` on tenths is what
 * makes the halving match: 0.5 of a 0.3 rise is 0.1, not 0.15.
 */
export function sellingPrice(nowCost: number, purchaseCost: number): number {
  if (nowCost <= purchaseCost) return nowCost;
  return purchaseCost + Math.floor((nowCost - purchaseCost) / 2);
}

interface TransferRow {
  element_in: number;
  element_in_cost: number;
  event: number;
  time?: string;
}

/**
 * What each player in the squad was bought for.
 *
 * Two sources, and between them they cover all fifteen:
 *
 * - transferred in at some point — the most recent `element_in_cost` wins,
 *   because a player bought, sold and bought back is held at the newer price;
 * - never transferred — they came with the original squad, so they were bought
 *   at the season-start price, which is `now_cost - cost_change_start`.
 *
 * A player who is missing from both is held at `now_cost`, which makes their
 * selling price exact and their profit zero. That is the conservative direction:
 * it can understate a gain, never invent one.
 */
export function purchaseCosts(
  picks: FPLPicksResponse['picks'] = [],
  elements: FPLElement[],
  transfers: TransferRow[] = []
): Map<number, number> {
  const elementById = new Map(elements.map((el) => [el.id, el]));

  // Newest first, so the first hit for an element is the one that counts.
  const newestFirst = [...transfers].sort(
    (a, b) => (b.event ?? 0) - (a.event ?? 0) || String(b.time ?? '').localeCompare(String(a.time ?? ''))
  );
  const boughtFor = new Map<number, number>();
  for (const t of newestFirst) {
    if (!boughtFor.has(t.element_in)) boughtFor.set(t.element_in, t.element_in_cost);
  }

  const out = new Map<number, number>();
  for (const pick of picks) {
    const element = elementById.get(pick.element);
    if (!element) continue;
    const transferred = boughtFor.get(pick.element);
    out.set(
      pick.element,
      transferred ?? element.now_cost - (element.cost_change_start ?? 0)
    );
  }
  return out;
}

export interface SquadValue {
  /** What the squad would sell for now, in tenths. */
  selling: number;
  /** Sum of purchase prices, in tenths. */
  paid: number;
  /** selling − paid, in tenths. Negative is a real loss. */
  profit: number;
}

export function squadValue(
  picks: FPLPicksResponse['picks'] = [],
  elements: FPLElement[],
  transfers: TransferRow[] = []
): SquadValue {
  const elementById = new Map(elements.map((el) => [el.id, el]));
  const costs = purchaseCosts(picks, elements, transfers);

  let selling = 0;
  let paid = 0;
  for (const pick of picks) {
    const element = elementById.get(pick.element);
    if (!element) continue;
    const purchase = costs.get(pick.element) ?? element.now_cost;
    selling += sellingPrice(element.now_cost, purchase);
    paid += purchase;
  }
  return { selling, paid, profit: selling - paid };
}
