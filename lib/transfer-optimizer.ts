import { GameweekForecast, FPLBootstrap, PriceAnalysis } from './types';

/**
 * Suggests transfers by expected points gained over a horizon.
 *
 * Deliberately not a full squad solver. Rebuilding fifteen players from scratch
 * is a nice optimisation problem and the wrong answer to the question actually
 * being asked, which is "what should I do this week" — a manager has one or two
 * free transfers, and a suggestion that requires a wildcard is noise.
 *
 * So this evaluates single swaps under FPL's real constraints, ranks them by
 * net gain after any hit, and stops there.
 */

export const SQUAD_LIMIT_PER_CLUB = 3;
export const TRANSFER_HIT_COST = 4;

export interface SquadPlayer {
  elementId: number;
  /** What the manager can sell for, in tenths. FPL returns half the profit. */
  sellingPrice: number;
}

export interface Candidate {
  elementId: number;
  name: string;
  team: number;
  teamShort: string;
  position: number;
  cost: number;
  xPts: number;
  minutesProb: number;
  /** How much the model actually knows about him. Low means unassessed. */
  confidence: number;
}

export interface TransferSuggestion {
  out: Candidate;
  in: Candidate;
  /** Expected points gained over the horizon, before any transfer cost. */
  gain: number;
  /** After deducting a hit, when the swap needs one. */
  netGain: number;
  costsHit: boolean;
  /** Money left in the bank afterwards, in £m. */
  bankAfter: number;
  reason: string;
}

/**
 * Below this the model has no usable evidence about a player — no prior season
 * and no minutes this one. His projection is zero because nothing is known,
 * which is not the same as expecting nothing.
 */
export const ASSESSED_CONFIDENCE = 0.1;

export interface OptimiseInputs {
  bootstrap: FPLBootstrap;
  /** One forecast per gameweek in the horizon, nearest first. */
  forecasts: GameweekForecast[];
  squad: SquadPlayer[];
  /** In tenths of £m, as FPL reports it. */
  bank: number;
  freeTransfers: number;
  /** Optional price-change context, so timing can be mentioned. */
  priceAnalyses?: Map<number, PriceAnalysis>;
}

/** Expected points across the whole horizon, not just the next gameweek. */
function horizonPoints(forecasts: GameweekForecast[], elementId: number): number {
  return forecasts.reduce(
    (sum, fc) => sum + (fc.predictions[String(elementId)]?.xPts ?? 0),
    0
  );
}

export function optimiseTransfers(
  inputs: OptimiseInputs,
  opts: { limit?: number; minGain?: number } = {}
): {
  suggestions: TransferSuggestion[];
  /** Squad players the model has no evidence about, reported rather than sold. */
  unassessed: Candidate[];
  horizon: number;
  note?: string;
} {
  const limit = opts.limit ?? 8;
  const minGain = opts.minGain ?? 0.5;
  const { bootstrap, forecasts, squad, bank, freeTransfers } = inputs;

  if (!forecasts.length) {
    return { suggestions: [], unassessed: [], horizon: 0, note: 'No forecast available.' };
  }

  const elements = new Map(bootstrap.elements.map((e) => [e.id, e]));
  const teamShort = new Map(bootstrap.teams.map((t) => [t.id, t.short_name]));
  const owned = new Set(squad.map((p) => p.elementId));

  const toCandidate = (id: number): Candidate | null => {
    const el = elements.get(id);
    if (!el) return null;
    const p = forecasts[0].predictions[String(id)];
    return {
      elementId: id,
      name: el.web_name,
      team: el.team,
      teamShort: teamShort.get(el.team) ?? '',
      position: el.element_type,
      cost: el.now_cost,
      xPts: horizonPoints(forecasts, id),
      minutesProb: p?.minutesProb ?? 0,
      confidence: p?.confidence ?? 0,
    };
  };

  // Club counts, so a swap cannot break the three-per-club rule.
  const clubCount = new Map<number, number>();
  for (const p of squad) {
    const el = elements.get(p.elementId);
    if (el) clubCount.set(el.team, (clubCount.get(el.team) ?? 0) + 1);
  }

  const replacements = bootstrap.elements
    .filter((el) => !owned.has(el.id))
    .map((el) => toCandidate(el.id))
    .filter((c): c is Candidate => c !== null && c.minutesProb > 0.3);

  const suggestions: TransferSuggestion[] = [];
  const unassessed: Candidate[] = [];

  for (const held of squad) {
    const out = toCandidate(held.elementId);
    if (!out) continue;

    // Never advise selling a player the model cannot assess. A summer signing
    // with no Premier League history projects zero because nothing is known
    // about him, and recommending his sale on that basis would dress up
    // ignorance as analysis — it would top the list every time, since nothing
    // beats replacing a zero.
    if (out.confidence < ASSESSED_CONFIDENCE) {
      unassessed.push(out);
      continue;
    }

    const budget = held.sellingPrice + bank;

    for (const cand of replacements) {
      // FPL only allows a like-for-like swap: the squad must keep 2 GKP,
      // 5 DEF, 5 MID, 3 FWD, so a position change is not a transfer.
      if (cand.position !== out.position) continue;
      if (cand.cost > budget) continue;

      // Three per club, counting the departing player as already gone.
      const after = (clubCount.get(cand.team) ?? 0) + (cand.team === out.team ? 0 : 1);
      if (cand.team !== out.team && after > SQUAD_LIMIT_PER_CLUB) continue;

      const gain = cand.xPts - out.xPts;
      if (gain < minGain) continue;

      const costsHit = freeTransfers < 1;
      const netGain = costsHit ? gain - TRANSFER_HIT_COST : gain;

      const price = inputs.priceAnalyses?.get(cand.elementId);
      const reasons: string[] = [
        `${(gain).toFixed(1)} pts over ${forecasts.length} gameweek${forecasts.length === 1 ? '' : 's'}`,
      ];
      if (cand.minutesProb > out.minutesProb + 0.15) reasons.push('more certain minutes');
      // Price movement changes WHEN to act, never whether the swap is right.
      if (price?.status === 'rising_soon') reasons.push('predicted to rise tonight');
      else if (price?.status === 'likely_riser') reasons.push('trending towards a rise');
      if (price?.status === 'falling_soon') reasons.push('predicted to fall tonight — selling now protects the value');

      suggestions.push({
        out,
        in: cand,
        gain: Number(gain.toFixed(2)),
        netGain: Number(netGain.toFixed(2)),
        costsHit,
        bankAfter: Number(((budget - cand.cost) / 10).toFixed(1)),
        reason: reasons.join('; '),
      });
    }
  }

  suggestions.sort((a, b) => b.netGain - a.netGain);

  // One suggestion per outgoing player: ten variations on selling the same
  // defender is a list of one idea pretending to be ten.
  const seen = new Set<number>();
  const deduped = suggestions.filter((s) => {
    if (seen.has(s.out.elementId)) return false;
    seen.add(s.out.elementId);
    return true;
  });

  const notes: string[] = [];
  if (freeTransfers < 1) notes.push('No free transfer, so every gain is shown after a 4-point hit.');
  if (unassessed.length) {
    notes.push(
      `${unassessed.length} squad player${unassessed.length === 1 ? '' : 's'} could not be assessed and ${unassessed.length === 1 ? 'was' : 'were'} left out of these suggestions: ${unassessed.map((p) => p.name).join(', ')}.`
    );
  }

  return {
    suggestions: deduped.slice(0, limit),
    unassessed,
    horizon: forecasts.length,
    note: notes.join(' ') || undefined,
  };
}
