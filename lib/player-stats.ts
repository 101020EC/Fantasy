import { fetchElementSummary } from './fpl-api';
import { row } from './analyst';
import { FPLBootstrap } from './types';

/**
 * Per-player per-gameweek match stats — the training signal a points model
 * needs, and the one thing the existing schema has none of. market/{date}
 * records what a player *cost*; this records what he *did*.
 *
 * Source: /element-summary/{id}/, which the app never called before. It is
 * retroactive for the whole season, so this is backfillable today rather than
 * something that only accumulates from now on.
 */

/**
 * Risk F-6, and the one decision that is expensive to change later.
 *
 * element-summary.history has one row per FIXTURE, not per gameweek. In a
 * double gameweek a player has two rows with the same `round`, and keying
 * storage by gameweek alone silently drops the second — the points would be
 * wrong for exactly the weeks that decide a season.
 *
 * So a player's entry is a FLAT array holding one block of `fields.length`
 * cells per fixture, concatenated. Firestore rejects an array of arrays, which
 * rules out the obvious nesting; the block count is values.length/fields.length,
 * so nothing extra has to be stored to recover it. A blank gameweek is simply
 * an absent key, which is different from a zero — see decodeFixtures.
 */
export const PLAYER_STAT_FIELDS = [
  'fixture', 'opponent_team', 'was_home', 'kickoff_time',
  'minutes', 'starts', 'total_points',
  'goals_scored', 'assists', 'clean_sheets', 'goals_conceded',
  'own_goals', 'penalties_saved', 'penalties_missed',
  'yellow_cards', 'red_cards', 'saves', 'bonus', 'bps',
  'influence', 'creativity', 'threat', 'ict_index',
  'expected_goals', 'expected_assists', 'expected_goal_involvements',
  'expected_goals_conceded',
  'clearances_blocks_interceptions', 'recoveries', 'tackles', 'defensive_contribution',
  'value', 'selected', 'transfers_in', 'transfers_out', 'transfers_balance',
] as const;

type Cell = string | number | boolean | null;

export interface PlayerStatsGameweek {
  season: string;
  gameweek: number;
  capturedAt: string;
  /** Always true — nothing provisional is written. See lib/analyst.ts. */
  dataChecked: boolean;
  playerCount: number;
  /** Players with more than one fixture this week. Empty in a normal gameweek. */
  doubleGameweekPlayers: number[];
  fields: string[];
  /** element id -> one block of `fields.length` cells per fixture, concatenated */
  players: Record<string, Cell[]>;
}

/** Splits a stored flat array back into one object per fixture. */
export function decodeFixtures(
  values: Cell[],
  fields: string[]
): Record<string, Cell>[] {
  const width = fields.length;
  const out: Record<string, Cell>[] = [];
  for (let i = 0; i + width <= values.length; i += width) {
    const obj: Record<string, Cell> = {};
    fields.forEach((f, j) => (obj[f] = values[i + j]));
    out.push(obj);
  }
  return out;
}

/**
 * Gameweek totals for the counting stats, summed across a double gameweek.
 * Backtest scoring must use this rather than a single fixture row (Addendum 2 §7).
 */
export function gameweekTotal(
  values: Cell[],
  fields: string[],
  field: string
): number {
  return decodeFixtures(values, fields).reduce((sum, f) => sum + (Number(f[field]) || 0), 0);
}

export interface SweepProgress {
  fetched: number;
  failed: number[];
}

/**
 * Fetches element-summary for every player and groups the history by gameweek.
 *
 * Bounded concurrency rather than one-at-a-time or all-at-once: ~600 requests
 * fired together is the kind of traffic that gets an IP blocked, while purely
 * sequential does not fit inside Vercel's 60s function limit. A small window
 * keeps the sweep to roughly 15-20s and stays polite.
 *
 * A player whose request fails is recorded in `failed` and simply absent from
 * the output — never written as zeros, which would be indistinguishable from a
 * real blank gameweek.
 */
export async function sweepPlayerStats(
  bootstrap: FPLBootstrap,
  opts: {
    gameweeks: number[];
    elementIds?: number[];
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<{ byGameweek: Map<number, Record<string, Cell[]>>; progress: SweepProgress }> {
  const wanted = new Set(opts.gameweeks);
  const ids = opts.elementIds ?? bootstrap.elements.map((e) => e.id);
  const concurrency = Math.max(1, opts.concurrency ?? 8);

  const byGameweek = new Map<number, Record<string, Cell[]>>();
  for (const gw of opts.gameweeks) byGameweek.set(gw, {});

  const progress: SweepProgress = { fetched: 0, failed: [] };
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      const summary = await fetchElementSummary(id);
      if (!summary?.history) {
        progress.failed.push(id);
      } else {
        progress.fetched++;
        for (const h of summary.history as any[]) {
          const gw = Number(h.round);
          if (!wanted.has(gw)) continue;
          const bucket = byGameweek.get(gw)!;
          const key = String(id);
          // Append: a second fixture in the same gameweek extends the block.
          bucket[key] = [...(bucket[key] ?? []), ...row(h, PLAYER_STAT_FIELDS)];
        }
      }
      opts.onProgress?.(++done, ids.length);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { byGameweek, progress };
}

export function buildPlayerStatsDoc(
  season: string,
  gameweek: number,
  players: Record<string, Cell[]>,
  now: Date = new Date()
): PlayerStatsGameweek {
  const width = PLAYER_STAT_FIELDS.length;
  const doubles = Object.entries(players)
    .filter(([, v]) => v.length > width)
    .map(([k]) => Number(k));

  return {
    season,
    gameweek,
    capturedAt: now.toISOString(),
    dataChecked: true,
    playerCount: Object.keys(players).length,
    doubleGameweekPlayers: doubles,
    fields: [...PLAYER_STAT_FIELDS],
    players,
  };
}
