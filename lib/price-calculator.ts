import {
  FPLBootstrap,
  FPLElement,
  FPLElementType,
  FPLTeam,
  PriceAnalysis,
  PriceStatus,
  placeholderTeam,
} from './types';

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
 * FPL's `likelihood` as one of this app's five states.
 *
 * Only |likelihood| >= 4 is a prediction. FPL's own page colours those two
 * bands and greys everything else out, and the bands are wide: 3 covers
 * 40%-95% of the way to a change, which is a player to watch rather than one
 * that will move tonight. Drawing the line anywhere lower buries the handful of
 * names that matter — on 2026-09-01 it would have marked 167 players as falling
 * when 17 were within reach of the threshold.
 */
export function statusFromLikelihood(likelihood: number): PriceStatus {
  if (likelihood >= 5) return 'rising_soon';
  if (likelihood >= 4) return 'likely_riser';
  if (likelihood <= -5) return 'falling_soon';
  if (likelihood <= -4) return 'likely_faller';
  return 'stable';
}

/**
 * A player's price outlook, read straight from FPL.
 *
 * This used to reverse-engineer FPL's threshold — a fitted constant for rises,
 * an ownership-scaled one for falls, both measured against price changes as we
 * observed them, with net transfers rebased at every change because the game's
 * own counter does not reset there. FPL now publishes the answer in
 * bootstrap-static, so all of that machinery is gone: `price_change_percent` is
 * the same quantity `changeScore` always meant, sourced rather than estimated.
 */
export function analyzePlayerPrice(
  element: FPLElement,
  bootstrap: FPLBootstrap,
  lookupsArg?: Lookups
): PriceAnalysis {
  const lookups = lookupsArg ?? buildLookups(bootstrap);

  const team = lookups.teams.get(element.team) || { ...FALLBACK_TEAM, id: element.team };
  const elementType = lookups.types.get(element.element_type) || {
    ...FALLBACK_TYPE,
    id: element.element_type,
  };

  const currentCost = element.now_cost / 10;
  const ownership = parseFloat(element.selected_by_percent) || 0;
  const netTransfersEvent = element.transfers_in_event - element.transfers_out_event;

  const rawProjections = element.price_change_projections ?? [];
  // A player with no projections and no percentage has no prediction at all.
  // Distinguished from a genuine zero, which means "sitting exactly still".
  const predictionUnavailable =
    rawProjections.length === 0 && element.price_change_percent == null;

  const changeScore = Math.round(Number(element.price_change_percent ?? 0)) || 0;

  const projections = rawProjections
    .slice()
    .sort((a, b) => a.offset - b.offset)
    .map((p) => {
      const likelihood = Number(p.likelihood ?? 0) || 0;
      return {
        percent: Math.round(Number(p.projected_percent ?? 0)) || 0,
        likelihood,
        status: statusFromLikelihood(likelihood),
      };
    });

  // The nearest deadline decides the badge. `price_change_percent` is where the
  // player stands now; the projection is where FPL expects him to be when the
  // change actually happens, which is the question a manager is asking.
  const status: PriceStatus = predictionUnavailable ? 'stable' : projections[0]?.status ?? 'stable';

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
    netTransfers: netTransfersEvent,
    netTransfersEvent,
    selectedByPercent: ownership,
    status,
    changeScore,
    projections,
    predictionUnavailable,
    lockedUntil: element.price_change_locked_until ?? null,
    hourlyRate: element.price_change_hourly_rate ?? 0,
    targetDirection: changeScore < 0 ? 'fall' : 'rise',
    news: element.news,
    chanceOfPlaying: element.chance_of_playing_next_round,
    availability,
  };
}

export function getAllMarketPriceAnalyses(bootstrap: FPLBootstrap): PriceAnalysis[] {
  // Build the lookups once rather than scanning teams and positions per player.
  const lookups = buildLookups(bootstrap);
  return bootstrap.elements.map((el) => analyzePlayerPrice(el, bootstrap, lookups));
}

/**
 * When prices next move, from FPL rather than from a constant in this repo.
 * The window used to be written into the page as "01:30 - 02:30 UTC"; FPL now
 * publishes 23:00Z, and the hardcoded string had no way of noticing.
 */
export function nextPriceDeadline(bootstrap: FPLBootstrap): string | null {
  return bootstrap.game_config?.settings?.price_change_deadlines?.[0] ?? null;
}
