import { fetchFPLEntry, fetchFPLPicks, fetchFPLTransfers, fetchFPLHistory } from './fpl-api';
import { row } from './analyst';
import {
  EliteCohort,
  EliteDerivedGameweek,
  EliteGameweekSnapshot,
  EliteManager,
  EliteManagerGameweek,
  ELITE_DERIVED_FIELDS,
} from './types';

/**
 * Elite Cohort — ~20 managers who reached Top 1K in a previous season, tracked
 * forward from this season.
 *
 * Their historical squads cannot be recovered: /entry/{id}/history/ returns only
 * a season name, total and rank for past seasons, and /entry/{id}/event/{gw}/picks/
 * 404s for any season but the current one. Both verified directly. So this
 * dataset starts now and accumulates — there is nothing to backfill beyond the
 * gameweeks of the current season.
 *
 * It is deliberately a parallel dataset: a different root collection, never
 * merged into teams/, and never treated as ground truth.
 *
 * PERISHABLE. If a manager deletes or renames their team, past gameweeks stop
 * being fetchable and cannot be recovered. This is the only part of the plan
 * with a real deadline.
 */

export const COMPUTE_VERSION = 1;

export const ENTRY_FIELDS = [
  'event', 'points', 'total_points', 'rank', 'rank_sort', 'overall_rank',
  'percentile_rank', 'bank', 'value', 'event_transfers', 'event_transfers_cost',
  'points_on_bench',
] as const;

export const PICK_FIELDS = [
  'element', 'position', 'multiplier', 'is_captain', 'is_vice_captain', 'element_type',
] as const;

export const SUB_FIELDS = ['element_in', 'element_out', 'event'] as const;

export const TRANSFER_FIELDS = [
  'element_in', 'element_out', 'element_in_cost', 'element_out_cost', 'time',
] as const;

type Cell = string | number | boolean | null;

/** Flattens a list of objects into one row-major array. Firestore rejects nesting. */
function flatten(items: any[], fields: readonly string[]): Cell[] {
  return items.flatMap((item) => row(item, fields));
}

export function unflatten(values: Cell[], fields: readonly string[]): Record<string, Cell>[] {
  const width = fields.length;
  const out: Record<string, Cell>[] = [];
  for (let i = 0; i + width <= values.length; i += width) {
    const obj: Record<string, Cell> = {};
    fields.forEach((f, j) => (obj[f] = values[i + j]));
    out.push(obj);
  }
  return out;
}

// ── Cohort roster ────────────────────────────────────────────────────────────

export async function buildCohort(
  season: string,
  managerIds: number[],
  qualifications: Record<string, string> = {},
  now: Date = new Date()
): Promise<EliteCohort> {
  const managers: Record<string, EliteManager> = {};

  for (const id of managerIds) {
    const [entry, history] = await Promise.all([
      fetchFPLEntry(id).catch(() => null),
      fetchFPLHistory(id),
    ]);
    if (!entry) continue;
    managers[String(id)] = {
      managerId: id,
      teamName: entry.name ?? '',
      managerName: `${entry.player_first_name ?? ''} ${entry.player_last_name ?? ''}`.trim(),
      region: entry.player_region_name ?? '',
      addedAt: now.toISOString(),
      qualification: qualifications[String(id)] ?? '',
      priorSeasons: (history?.past ?? []).map((p: any) => ({
        season: p.season_name ?? '',
        rank: Number(p.rank) || 0,
        totalPoints: Number(p.total_points) || 0,
      })),
    };
  }

  return {
    season,
    cohortSize: managerIds.length,
    managerIds,
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    notes: 'Elite Cohort Signals — a ~20-manager sample, not a Top 1K population statistic.',
    managers,
  };
}

// ── RAW capture ──────────────────────────────────────────────────────────────

/**
 * One document per gameweek holding all managers, rather than a subcollection
 * per manager. "What did the cohort own in GW5" is the common query and this
 * answers it in ONE read instead of 20; per-manager analysis reads the season
 * in 38 reads either way. Contrast /api/market/player, which scans the whole
 * market collection to draw a single chart (Risk F-3).
 *
 * At ~650 bytes per manager a gameweek is ~13KB — the 1MB document limit leaves
 * room for roughly 1500 managers.
 */
export async function captureEliteGameweek(
  season: string,
  gameweek: number,
  managerIds: number[],
  opts: { delayMs?: number; dataChecked?: boolean } = {}
): Promise<EliteGameweekSnapshot> {
  const delayMs = opts.delayMs ?? 120;
  const managers: Record<string, EliteManagerGameweek> = {};
  const missing: number[] = [];

  for (let i = 0; i < managerIds.length; i++) {
    const id = managerIds[i];
    try {
      const [picks, transfers] = await Promise.all([
        fetchFPLPicks(id, gameweek),
        fetchFPLTransfers(id),
      ]);
      if (!picks?.picks?.length) {
        missing.push(id);
      } else {
        const eh = (picks as any).entry_history ?? {};
        const subs = (picks as any).automatic_subs ?? [];
        managers[String(id)] = {
          entry: row(eh, ENTRY_FIELDS),
          picks: flatten(picks.picks, PICK_FIELDS),
          subs: flatten(subs, SUB_FIELDS),
          transfers: flatten(
            (transfers ?? []).filter((t: any) => Number(t.event) === gameweek),
            TRANSFER_FIELDS
          ),
          activeChip: (picks as any).active_chip ?? null,
        };
      }
    } catch {
      // A deleted team, a rename, or an outage. Recorded, never inferred as
      // "owns nothing" — that would read as a collapse in ownership.
      missing.push(id);
    }
    if (delayMs && i < managerIds.length - 1) await new Promise((r) => setTimeout(r, delayMs));
  }

  return {
    season,
    gameweek,
    capturedAt: new Date().toISOString(),
    // Picks and transfers are final the moment the deadline passes; points and
    // ranks are not. A capture taken between the deadline and FPL's data check
    // is therefore correct about squads and provisional about scores, and says
    // so rather than claiming to be settled.
    dataChecked: opts.dataChecked ?? true,
    cohortSize: managerIds.length,
    availableManagerCount: Object.keys(managers).length,
    missing,
    entryFields: [...ENTRY_FIELDS],
    pickFields: [...PICK_FIELDS],
    subFields: [...SUB_FIELDS],
    transferFields: [...TRANSFER_FIELDS],
    managers,
  };
}

// ── DERIVED signals ──────────────────────────────────────────────────────────

/**
 * Counts per player, plus provenance. Recomputable from the raw snapshot at any
 * time, so this document is a cache and can be deleted and rebuilt.
 *
 * Denominator discipline: `owned`, `captained` and the transfer counts are read
 * against availableManagerCount; `startedXI` and `benched` are read against that
 * player's own `ownerCount`. Mixing the two produces plausible, wrong numbers,
 * so both denominators are stored rather than either being assumed.
 */
export function computeEliteDerived(
  snapshot: EliteGameweekSnapshot,
  now: Date = new Date()
): EliteDerivedGameweek {
  const players: Record<string, number[]> = {};
  const chips: Record<string, number> = {};
  const captainCounts = new Map<number, number>();
  const xis: Set<number>[] = [];

  const idx = (el: number) => {
    const key = String(el);
    players[key] ??= new Array(ELITE_DERIVED_FIELDS.length).fill(0);
    return players[key];
  };
  const F = (name: (typeof ELITE_DERIVED_FIELDS)[number]) => ELITE_DERIVED_FIELDS.indexOf(name);

  for (const mg of Object.values(snapshot.managers)) {
    if (mg.activeChip) chips[mg.activeChip] = (chips[mg.activeChip] ?? 0) + 1;

    const picks = unflatten(mg.picks, PICK_FIELDS);
    const subs = unflatten(mg.subs, SUB_FIELDS);
    const subbedOn = new Set(subs.map((s) => Number(s.element_in)));
    const subbedOff = new Set(subs.map((s) => Number(s.element_out)));

    const xi = new Set<number>();
    for (const p of picks) {
      const el = Number(p.element);
      const mult = Number(p.multiplier);
      const cells = idx(el);
      cells[F('owned')]++;
      cells[F('ownerCount')]++;
      if (p.is_captain) {
        cells[F('captained')]++;
        captainCounts.set(el, (captainCounts.get(el) ?? 0) + 1);
      }
      if (p.is_vice_captain) cells[F('viceCaptained')]++;

      // Did this player actually score for the manager this week.
      //
      // `multiplier` is the authoritative signal, not `position`: it is 0 for a
      // benched player, 1 for a starter, 2 for the captain, 3 under Triple
      // Captain — and 1 for ALL FIFTEEN under Bench Boost, which is how that
      // chip reads back. Position alone would count a bench-boosted substitute
      // as benched in a week he scored, and 16 of the 20 cohort managers played
      // Bench Boost in GW1, so this is not an edge case.
      //
      // automatic_subs are then applied on top. Whether FPL rewrites multiplier
      // after an auto-sub is not observable from a week with no auto-subs, so
      // both conditions are combined: correct either way.
      const started = (mult >= 1 || subbedOn.has(el)) && !subbedOff.has(el);
      if (started) cells[F('startedXI')]++;
      else cells[F('benched')]++;
      if (started) xi.add(el);
    }
    xis.push(xi);

    for (const t of unflatten(mg.transfers, TRANSFER_FIELDS)) {
      if (t.element_in != null) idx(Number(t.element_in))[F('transferredIn')]++;
      if (t.element_out != null) idx(Number(t.element_out))[F('transferredOut')]++;
    }
  }

  const available = snapshot.availableManagerCount;

  // Shannon entropy over the captain distribution: 0 = total consensus, higher
  // = the cohort disagrees. A single number for "is there an obvious captain".
  let captainEntropy = 0;
  if (available > 0) {
    for (const c of captainCounts.values()) {
      const p = c / available;
      if (p > 0) captainEntropy -= p * Math.log2(p);
    }
  }

  let xiOverlapMean = 0;
  let pairs = 0;
  for (let i = 0; i < xis.length; i++) {
    for (let j = i + 1; j < xis.length; j++) {
      let shared = 0;
      for (const el of xis[i]) if (xis[j].has(el)) shared++;
      xiOverlapMean += shared / 11;
      pairs++;
    }
  }
  if (pairs) xiOverlapMean /= pairs;

  const uniqueOwnedCount = Object.values(players).filter(
    (c) => c[F('owned')] === 1
  ).length;

  return {
    season: snapshot.season,
    gameweek: snapshot.gameweek,
    sourceGameweek: snapshot.gameweek,
    generatedAt: now.toISOString(),
    dataChecked: snapshot.dataChecked,
    cohortSize: snapshot.cohortSize,
    availableManagerCount: available,
    missing: snapshot.missing,
    computeVersion: COMPUTE_VERSION,
    fields: [...ELITE_DERIVED_FIELDS],
    players,
    chips,
    consensus: {
      captainEntropy: Number(captainEntropy.toFixed(4)),
      xiOverlapMean: Number(xiOverlapMean.toFixed(4)),
      uniqueOwnedCount,
    },
  };
}
