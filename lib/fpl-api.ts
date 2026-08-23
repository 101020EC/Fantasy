import { unstable_cache } from 'next/cache';
import {
  FPLBootstrap,
  FPLElement,
  FPLElementType,
  FPLEntry,
  FPLEvent,
  FPLFixture,
  FPLPicksResponse,
  FPLTeam,
  TeamSquadPlayer,
} from './types';
import { analyzePlayerPrice } from './price-calculator';

const FPL_BASE = 'https://fantasy.premierleague.com/api';

// The FPL API rejects requests without a browser-like User-Agent.
const FPL_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
};

/**
 * SERVER ONLY. The FPL API sends no CORS headers, so every call here fails when
 * made from a browser. Client components must go through /api/fpl/*.
 */
function fplFetch(path: string, revalidate: number) {
  return fetch(`${FPL_BASE}${path}`, { headers: FPL_HEADERS, next: { revalidate } });
}

// bootstrap-static ships 109 fields per player and weighs ~1.7MB. Next's data
// cache refuses anything over 2MB, so `revalidate` silently did nothing and
// every request re-downloaded the lot. Keeping only the fields lib/types.ts
// declares brings it to ~270KB, which caches — and which is also what the
// /api/fpl/bootstrap proxy hands to the browser.
const ELEMENT_FIELDS: (keyof FPLElement)[] = [
  'id', 'web_name', 'first_name', 'second_name', 'team', 'team_code', 'element_type',
  'now_cost', 'cost_change_event', 'cost_change_start', 'transfers_in_event',
  'transfers_out_event', 'selected_by_percent', 'total_points', 'event_points', 'form',
  'status', 'news', 'chance_of_playing_next_round', 'ep_this', 'ep_next',
];
const TEAM_FIELDS: (keyof FPLTeam)[] = ['id', 'name', 'short_name', 'code', 'strength'];
const EVENT_FIELDS: (keyof FPLEvent)[] = [
  'id', 'name', 'deadline_time', 'is_previous', 'is_current', 'is_next', 'finished', 'data_checked',
];
const ELEMENT_TYPE_FIELDS: (keyof FPLElementType)[] = [
  'id', 'plural_name', 'plural_name_short', 'singular_name', 'singular_name_short',
];

function project<T>(rows: any[] | undefined, fields: (keyof T)[]): T[] {
  return (rows ?? []).map((row) => {
    const out = {} as T;
    for (const field of fields) out[field] = row[field];
    return out;
  });
}

function trimBootstrap(raw: any): FPLBootstrap {
  return {
    events: project<FPLEvent>(raw?.events, EVENT_FIELDS),
    teams: project<FPLTeam>(raw?.teams, TEAM_FIELDS),
    elements: project<FPLElement>(raw?.elements, ELEMENT_FIELDS),
    element_types: project<FPLElementType>(raw?.element_types, ELEMENT_TYPE_FIELDS),
  };
}

/**
 * Cached on the trimmed result rather than the raw response, so the entry
 * actually fits the data cache. `no-store` on the fetch itself stops Next from
 * attempting — and failing — to cache the full 1.7MB body.
 */
const getBootstrap = unstable_cache(
  async (): Promise<FPLBootstrap> => {
    const res = await fetch(`${FPL_BASE}/bootstrap-static/`, {
      headers: FPL_HEADERS,
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`Could not load FPL player data (HTTP ${res.status})`);
    }
    return trimBootstrap(await res.json());
  },
  ['fpl-bootstrap-static'],
  { revalidate: 300, tags: ['fpl-bootstrap'] }
);

export function fetchFPLBootstrap(): Promise<FPLBootstrap> {
  return getBootstrap();
}

export async function fetchFPLEntry(teamId: number | string): Promise<FPLEntry> {
  const res = await fplFetch(`/entry/${teamId}/`, 60);
  if (!res.ok) {
    // Distinguish "no such team" from an upstream outage — collapsing both into
    // "team not found" sent users to re-check an ID that was fine.
    throw new Error(
      res.status === 404
        ? `Team ID ${teamId} was not found — check the number`
        : `The FPL API is temporarily unavailable (HTTP ${res.status})`
    );
  }
  return res.json();
}

export async function fetchFPLPicks(
  teamId: number | string,
  eventId: number | string
): Promise<FPLPicksResponse> {
  const res = await fplFetch(`/entry/${teamId}/event/${eventId}/picks/`, 60);
  if (!res.ok) {
    throw new Error(`No squad found for GW ${eventId}`);
  }
  return res.json();
}

export async function fetchFPLFixtures(): Promise<FPLFixture[]> {
  try {
    const res = await fplFetch('/fixtures/', 1800);
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function fetchFPLLeagueStandings(leagueId: number | string): Promise<any> {
  try {
    const res = await fplFetch(`/leagues-classic/${leagueId}/standings/`, 300);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function fetchFPLHistory(teamId: number | string): Promise<any> {
  try {
    const res = await fplFetch(`/entry/${teamId}/history/`, 300);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function fetchFPLTransfers(teamId: number | string): Promise<any[]> {
  try {
    const res = await fplFetch(`/entry/${teamId}/transfers/`, 300);
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export function buildSquadPlayers(
  picks: FPLPicksResponse['picks'] = [],
  bootstrap: FPLBootstrap,
  fixtures: FPLFixture[] = [],
  currentEventId: number = 1
): TeamSquadPlayer[] {
  const elementMap = new Map(bootstrap.elements.map((el) => [el.id, el]));
  const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const typeMap = new Map(bootstrap.element_types.map((et) => [et.id, et]));

  // Prefer a fixture in the current gameweek; fall back to the next one.
  const upcoming = fixtures
    .filter((f) => f.event === currentEventId || f.event === currentEventId + 1)
    .sort((a, b) => a.event - b.event);

  return (picks || [])
    .map((pick) => {
      const element = elementMap.get(pick.element);
      if (!element) return null;

      const team = teamMap.get(element.team) || {
        id: element.team,
        name: 'Club',
        short_name: 'CLB',
        code: 0,
        strength: 3,
      };

      const elementType = typeMap.get(element.element_type) || {
        id: element.element_type,
        plural_name: 'Players',
        plural_name_short: 'PLY',
        singular_name: 'Player',
        singular_name_short: 'PLY',
      };

      const nextFix = upcoming.find(
        (f) => f.team_h === element.team || f.team_a === element.team
      );

      let nextFixture;
      if (nextFix) {
        const isHome = nextFix.team_h === element.team;
        const opponentId = isHome ? nextFix.team_a : nextFix.team_h;
        nextFixture = {
          opponent: teamMap.get(opponentId) || {
            id: opponentId,
            name: 'Opponent',
            short_name: 'OPP',
            code: 0,
            strength: 3,
          },
          isHome,
          difficulty: isHome ? nextFix.team_h_difficulty : nextFix.team_a_difficulty,
        };
      }

      return {
        pick,
        element,
        team,
        elementType,
        priceAnalysis: analyzePlayerPrice(element, bootstrap),
        nextFixture,
      };
    })
    .filter(Boolean) as TeamSquadPlayer[];
}
