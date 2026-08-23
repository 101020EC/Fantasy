import { FPLBootstrap, FPLElement, PriceAnalysis, PriceStatus } from './types';

/**
 * Calculates price change trends, prediction score, and alert status for FPL players
 * based on net transfer volume, ownership percentage, and injury flags.
 */
export function analyzePlayerPrice(
  element: FPLElement,
  bootstrap: FPLBootstrap
): PriceAnalysis {
  const team = bootstrap.teams.find((t) => t.id === element.team) || {
    id: element.team,
    name: 'Unknown',
    short_name: 'UNK',
    code: 0,
    strength: 3,
  };

  const elementType = bootstrap.element_types.find((t) => t.id === element.element_type) || {
    id: element.element_type,
    plural_name: 'Players',
    plural_name_short: 'PLY',
    singular_name: 'Player',
    singular_name_short: 'PLY',
  };

  const currentCost = element.now_cost / 10;
  const netTransfers = element.transfers_in_event - element.transfers_out_event;
  const ownership = parseFloat(element.selected_by_percent) || 1.0;

  // Transfer threshold formula estimate:
  // In FPL, price rise target is roughly proportional to ownership and active base
  // High net transfers in / out relative to ownership drives changes.
  const baselineThreshold = Math.max(25000, ownership * 12000);
  let rawScore = (netTransfers / baselineThreshold) * 100;

  // Cap score between -100 and +100
  let changeScore = Math.min(100, Math.max(-100, Math.round(rawScore)));

  // If player is injured/suspended, transfer out velocity is intensified
  if (element.status !== 'a') {
    if (changeScore < 0) {
      changeScore = Math.max(-100, changeScore * 1.25);
    }
  }

  let status: PriceStatus = 'stable';
  let urgencyLabel = 'ราคาคงที่';

  if (changeScore >= 75) {
    status = 'rising_soon';
    urgencyLabel = '🚀 เสี่ยงราคาขึ้นคืนนี้!';
  } else if (changeScore >= 35) {
    status = 'likely_riser';
    urgencyLabel = '🟢 แนวโน้มราคาขึ้น';
  } else if (changeScore <= -75) {
    status = 'falling_soon';
    urgencyLabel = '⚠️ เสี่ยงราคาตกคืนนี้!';
  } else if (changeScore <= -35) {
    status = 'likely_faller';
    urgencyLabel = '🟠 แนวโน้มราคาลง';
  } else {
    status = 'stable';
    urgencyLabel = '⚪ ราคาปกติ';
  }

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
    urgencyLabel,
    news: element.news,
    availability,
  };
}

export function getAllMarketPriceAnalyses(bootstrap: FPLBootstrap): PriceAnalysis[] {
  return bootstrap.elements.map((el) => analyzePlayerPrice(el, bootstrap));
}
