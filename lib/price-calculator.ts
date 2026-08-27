import { FPLBootstrap, FPLElement, FPLElementType, FPLTeam, PriceAnalysis, PriceStatus, placeholderTeam } from './types';
import { TransferBaseline } from './price-changes';
import { isFitted, PriceThresholds, thresholdFor } from './price-thresholds';

const FALLBACK_TEAM: FPLTeam = placeholderTeam();
const FALLBACK_TYPE: FPLElementType = {
  id: 0,
  plural_name: 'Players',
  plural_name_short: 'PLY',
  singular_name: 'Player',
  singular_name_short: 'PLY',
};

interface Lookups {
  teams: Map<number, FPLTeam>;
  types: Map<number, FPLElementType>;
}

function buildLookups(bootstrap: FPLBootstrap): Lookups {
  return {
    teams: new Map(bootstrap.teams.map((t) => [t.id, t])),
    types: new Map(bootstrap.element_types.map((t) => [t.id, t])),
  };
}

/**
 * Context the caller can supply to make the score accurate. Both are optional
 * and both degrade to the old behaviour when absent, so a page that has not
 * loaded Firestore still renders a sensible table.
 */
export interface PriceContext {
  /** Where each player's counter was last reset, from findTransferBaselines(). */
  baselines?: Map<number, TransferBaseline> | null;
  /** Thresholds fitted from observed changes, if any have been observed. */
  thresholds?: PriceThresholds | null;
  lookups?: Lookups;
}

/**
 * `rising_soon` / `falling_soon` at 100% of the threshold, the trending tiers
 * at half of it. 100 is the real line — a player at 100% is expected to move in
 * tonight's window — so the tiers are anchored to it rather than to an
 * arbitrary point on a clamped index.
 */
const TONIGHT = 100;
const TRENDING = 50;

/** Beyond this the exact figure stops meaning anything; only the sign does. */
const SCORE_CAP = 300;

/**
 * Progress toward a price change, as a percentage of FPL's threshold.
 *
 * Two things make this different from a naive net-transfers score, and both
 * were wrong before:
 *
 * 1. **The counter resets at every price change.** `transfers_in_event` resets
 *    only at the gameweek rollover, so a player who rose on Monday carried the
 *    transfers that caused the rise for the rest of the week and stayed pinned
 *    at the top of the table. `baselines` subtracts them.
 * 2. **The threshold is measurable.** It used to be a formula nobody had ever
 *    checked against a real change. `thresholds` carries one fitted to the
 *    changes we have actually observed, and falls back to that formula while
 *    the sample is too small.
 */
export function analyzePlayerPrice(
  element: FPLElement,
  bootstrap: FPLBootstrap,
  context: PriceContext | Lookups = {}
): PriceAnalysis {
  // Callers used to pass a bare Lookups as the third argument. Both shapes are
  // accepted so every existing call site keeps working untouched.
  const ctx: PriceContext =
    'teams' in context && 'types' in context ? { lookups: context as Lookups } : (context as PriceContext);
  const lookups = ctx.lookups ?? buildLookups(bootstrap);

  const team = lookups.teams.get(element.team) || { ...FALLBACK_TEAM, id: element.team };
  const elementType = lookups.types.get(element.element_type) || {
    ...FALLBACK_TYPE,
    id: element.element_type,
  };

  const currentCost = element.now_cost / 10;
  const ownership = parseFloat(element.selected_by_percent) || 1.0;

  const netTransfersEvent = element.transfers_in_event - element.transfers_out_event;

  // Absent baselines mean "we have no snapshot history yet", which is the same
  // answer as "this player has not changed price this gameweek": zero. That is
  // correct for most of the table for most of a gameweek, so the fix is useful
  // from the first day even with no stored history at all.
  const baseline = ctx.baselines?.get(element.id) ?? null;
  const netTransfers =
    element.transfers_in_event -
    (baseline?.transfersIn ?? 0) -
    (element.transfers_out_event - (baseline?.transfersOut ?? 0));

  // Rises and falls do not share a threshold shape: anyone can buy a player, so
  // a rise is measured against the whole manager base, while only an owner can
  // sell, so a fall is measured against that player's ownership. Measured
  // against livefpl, a single ownership-proportional divisor reported 26 players
  // rising tonight where one was rising.
  const direction: 'rise' | 'fall' = netTransfers >= 0 ? 'rise' : 'fall';
  const threshold = thresholdFor(
    ownership,
    direction,
    ctx.thresholds,
    bootstrap.total_players
  );
  let rawScore = (netTransfers / threshold) * 100;

  // Injured or suspended players are sold off faster than transfers alone show.
  // Applied before rounding, so the score stays a whole number in the UI.
  if (element.status !== 'a' && rawScore < 0) {
    rawScore *= 1.25;
  }

  const changeScore = Math.round(Math.min(SCORE_CAP, Math.max(-SCORE_CAP, rawScore)));

  let status: PriceStatus = 'stable';
  if (changeScore >= TONIGHT) status = 'rising_soon';
  else if (changeScore >= TRENDING) status = 'likely_riser';
  else if (changeScore <= -TONIGHT) status = 'falling_soon';
  else if (changeScore <= -TRENDING) status = 'likely_faller';

  let availability: PriceAnalysis['availability'] = 'available';
  if (element.status === 'd') availability = 'doubtful';
  else if (element.status === 'i') availability = 'injured';
  else if (element.status === 's') availability = 'suspended';
  else if (element.status === 'u') availability = 'unavailable';

  return {
    elementId: element.id,
    webName: element.web_name,
    fullName: `${element.first_name} ${element.second_name}`,
    team,
    elementType,
    currentCost,
    costChangeEvent: element.cost_change_event / 10,
    transfersInEvent: element.transfers_in_event,
    transfersOutEvent: element.transfers_out_event,
    netTransfers,
    netTransfersEvent,
    baselineSince: baseline?.since ?? null,
    selectedByPercent: ownership,
    status,
    changeScore,
    targetEstimated: !isFitted(direction, ctx.thresholds),
    targetDirection: direction,
    news: element.news,
    chanceOfPlaying: element.chance_of_playing_next_round,
    availability,
  };
}

export function getAllMarketPriceAnalyses(
  bootstrap: FPLBootstrap,
  context: Omit<PriceContext, 'lookups'> = {}
): PriceAnalysis[] {
  // Build the lookups once rather than scanning teams and positions per player.
  const lookups = buildLookups(bootstrap);
  return bootstrap.elements.map((el) =>
    analyzePlayerPrice(el, bootstrap, { ...context, lookups })
  );
}
