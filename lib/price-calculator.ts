import { FPLBootstrap, FPLElement, FPLElementType, FPLTeam, PriceAnalysis, PriceStatus, placeholderTeam } from './types';

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
 * Calculates price change trends, prediction score, and alert status for FPL players
 * based on net transfer volume, ownership percentage, and injury flags.
 */
export function analyzePlayerPrice(
  element: FPLElement,
  bootstrap: FPLBootstrap,
  lookups: Lookups = buildLookups(bootstrap)
): PriceAnalysis {
  const team = lookups.teams.get(element.team) || { ...FALLBACK_TEAM, id: element.team };
  const elementType = lookups.types.get(element.element_type) || {
    ...FALLBACK_TYPE,
    id: element.element_type,
  };

  const currentCost = element.now_cost / 10;
  const netTransfers = element.transfers_in_event - element.transfers_out_event;
  const ownership = parseFloat(element.selected_by_percent) || 1.0;

  // Transfer threshold formula estimate:
  // In FPL, price rise target is roughly proportional to ownership and active base
  // High net transfers in / out relative to ownership drives changes.
  const baselineThreshold = Math.max(25000, ownership * 12000);
  let rawScore = (netTransfers / baselineThreshold) * 100;

  // Injured or suspended players are sold off faster than transfers alone show.
  // Applied before rounding, so the score stays a whole number in the UI.
  if (element.status !== 'a' && rawScore < 0) {
    rawScore *= 1.25;
  }

  const changeScore = Math.min(100, Math.max(-100, Math.round(rawScore)));

  // Thresholds on the capped -100..100 score.
  let status: PriceStatus = 'stable';
  if (changeScore >= 75) status = 'rising_soon';
  else if (changeScore >= 35) status = 'likely_riser';
  else if (changeScore <= -75) status = 'falling_soon';
  else if (changeScore <= -35) status = 'likely_faller';

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
    selectedByPercent: ownership,
    status,
    changeScore,
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
