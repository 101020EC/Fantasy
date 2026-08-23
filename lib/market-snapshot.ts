import { FPLBootstrap } from './types';

/**
 * Daily market snapshot.
 *
 * The FPL API only ever reports the present: `transfers_in_event` resets every
 * gameweek and `now_cost` is overwritten at each nightly price change, with no
 * endpoint to ask what either was yesterday. Anything not captured on the day
 * is gone, so this runs on a schedule and stores it.
 *
 * Shape: a map keyed by player id whose values are positional arrays. Field
 * names repeated 600 times would cost four times the data (160KB vs 40KB), and
 * Firestore rejects an array of arrays outright — a map of arrays is the one
 * compact layout it accepts. `fields` travels with each document so a snapshot
 * stays readable even if this file's field list changes later.
 */

export const SNAPSHOT_FIELDS = [
  'now_cost',
  'cost_change_event',
  'transfers_in_event',
  'transfers_out_event',
  'selected_by_percent',
  'form',
  'event_points',
  'total_points',
  'status',
  'chance_of_playing_next_round',
  'ep_this',
  'ep_next',
  'news',
] as const;

export const ROSTER_FIELDS = [
  'web_name',
  'first_name',
  'second_name',
  'team',
  'team_code',
  'element_type',
] as const;

export const TEAM_FIELDS = ['name', 'short_name', 'code'] as const;

type Cell = string | number | null;

export interface MarketSnapshot {
  date: string;
  capturedAt: string;
  gameweek: number | null;
  playerCount: number;
  fields: string[];
  /** player id -> values in `fields` order */
  players: Record<string, Cell[]>;
}

export interface MarketRoster {
  updatedAt: string;
  playerCount: number;
  fields: string[];
  players: Record<string, Cell[]>;
  teamFields: string[];
  teams: Record<string, Cell[]>;
  checksum: string;
}

/** UTC date key. The capture runs at 01:00 UTC, so a local date would drift. */
export function snapshotDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function row(source: object, fields: readonly string[]): Cell[] {
  return fields.map((f) => {
    const value = (source as any)[f];
    // Firestore rejects undefined outright; null is a real "not reported yet".
    return value === undefined ? null : value;
  });
}

function indexById<T extends { id: number }>(
  items: T[],
  fields: readonly string[]
): Record<string, Cell[]> {
  const out: Record<string, Cell[]> = {};
  for (const item of items) out[String(item.id)] = row(item, fields);
  return out;
}

/** Cheap non-cryptographic digest, used only to skip rewriting an unchanged roster. */
function checksum(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export function buildMarketSnapshot(
  bootstrap: FPLBootstrap,
  now: Date = new Date()
): { snapshot: MarketSnapshot; roster: MarketRoster } {
  const currentEvent =
    bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);

  const snapshot: MarketSnapshot = {
    date: snapshotDateKey(now),
    capturedAt: now.toISOString(),
    gameweek: currentEvent?.id ?? null,
    playerCount: bootstrap.elements.length,
    fields: [...SNAPSHOT_FIELDS],
    players: indexById(bootstrap.elements, SNAPSHOT_FIELDS),
  };

  const rosterPlayers = indexById(bootstrap.elements, ROSTER_FIELDS);
  const teams = indexById(bootstrap.teams, TEAM_FIELDS);

  const roster: MarketRoster = {
    updatedAt: now.toISOString(),
    playerCount: bootstrap.elements.length,
    fields: [...ROSTER_FIELDS],
    players: rosterPlayers,
    teamFields: [...TEAM_FIELDS],
    teams,
    checksum: checksum(JSON.stringify(rosterPlayers) + JSON.stringify(teams)),
  };

  return { snapshot, roster };
}
