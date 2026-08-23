import { fetchFPLLeagueStandings } from './fpl-api';
import { LeagueMemberStanding } from './archive';

/**
 * Rebuilds a private league's table for every gameweek played so far.
 *
 * FPL's standings endpoint only ever reports the present — it ignores an
 * `event` parameter, so there is no way to ask what a table looked like after
 * gameweek 3. But `entry/{id}/history/` returns every gameweek for one
 * manager, so sorting all members by cumulative points reproduces any past
 * table exactly. Ranking is a pure function of total points, so the result
 * matches what FPL reported at the time.
 *
 * Cost is one request per member, not per member per gameweek: a single
 * history response carries the whole season. These leagues run under twenty
 * members, so a rebuild is a couple of dozen requests.
 *
 * Only finalised gameweeks are rebuilt. While a gameweek is live FPL is still
 * awarding bonus and correcting stats, and its endpoints disagree with each
 * other by a point or two — observed during GW1, where a manager's history
 * said 94 and the league table said 93 with no transfer cost involved.
 * Archiving that would store numbers FPL itself goes on to contradict, so a
 * week only counts once `data_checked` is true.
 */

const FPL_BASE = 'https://fantasy.premierleague.com/api';
const FPL_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
};

/** Guard rail: reconstruction is per-member, so a system league would be thousands of requests. */
export const MAX_RECONSTRUCTABLE_MEMBERS = 200;

interface MemberSeason {
  entry: number;
  entryName: string;
  playerName: string;
  /** gameweek -> { points that week, cumulative total } */
  byGameweek: Map<number, { points: number; total: number }>;
}

export interface ReconstructedGameweek {
  gameweek: number;
  standings: LeagueMemberStanding[];
}

async function fetchMemberSeason(
  entry: number,
  entryName: string,
  playerName: string
): Promise<MemberSeason | null> {
  try {
    const res = await fetch(`${FPL_BASE}/entry/${entry}/history/`, {
      headers: FPL_HEADERS,
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const data = await res.json();
    const byGameweek = new Map<number, { points: number; total: number }>();
    for (const gw of data.current ?? []) {
      byGameweek.set(Number(gw.event), {
        points: Number(gw.points) || 0,
        total: Number(gw.total_points) || 0,
      });
    }
    return { entry, entryName, playerName, byGameweek };
  } catch {
    return null;
  }
}

/**
 * Assigns FPL's ranking: equal totals share a rank, and the next rank skips by
 * the size of the tied group — 3, 3, 6, 6, 9, 9, 9, 9. Verified against a live
 * league before writing this.
 */
function assignRanks(
  rows: { entry: number; entryName: string; playerName: string; total: number; points: number }[]
) {
  const sorted = [...rows].sort((a, b) => b.total - a.total || a.entry - b.entry);
  const ranks = new Map<number, number>();

  sorted.forEach((row, index) => {
    const previous = sorted[index - 1];
    // Same total as the entry above? Share its rank. Otherwise take the
    // position, so the rank skips over everyone tied ahead.
    ranks.set(row.entry, previous && previous.total === row.total ? ranks.get(previous.entry)! : index + 1);
  });

  return { sorted, ranks };
}

export async function reconstructLeagueHistory(
  leagueId: number | string,
  /** Gameweek ids FPL has marked `data_checked` — anything else is provisional. */
  finalisedGameweeks: Set<number>
): Promise<{
  leagueId: number;
  leagueName: string;
  memberCount: number;
  gameweeks: ReconstructedGameweek[];
} | null> {
  const standingsRes = await fetchFPLLeagueStandings(leagueId);
  const members = standingsRes?.standings?.results ?? [];
  if (members.length === 0) return null;

  if (members.length > MAX_RECONSTRUCTABLE_MEMBERS) {
    throw new Error(
      `League ${leagueId} has ${members.length}+ members — too many to rebuild one request at a time`
    );
  }

  const seasons = (
    await Promise.all(
      members.map((m: any) => fetchMemberSeason(Number(m.entry), m.entry_name ?? '', m.player_name ?? ''))
    )
  ).filter((s): s is MemberSeason => s !== null);

  // Played by somebody, and closed by FPL. A live week's numbers still move.
  const playedGameweeks = [...new Set(seasons.flatMap((s) => [...s.byGameweek.keys()]))]
    .filter((gw) => finalisedGameweeks.has(gw))
    .sort((a, b) => a - b);

  const gameweeks: ReconstructedGameweek[] = playedGameweeks.map((gw) => {
    const rows = seasons
      .filter((s) => s.byGameweek.has(gw))
      .map((s) => ({
        entry: s.entry,
        entryName: s.entryName,
        playerName: s.playerName,
        total: s.byGameweek.get(gw)!.total,
        points: s.byGameweek.get(gw)!.points,
      }));

    const { sorted, ranks } = assignRanks(rows);

    // Last week's rank, so movement is available without reading the previous doc.
    const previousRanks = gw > 1
      ? assignRanks(
          seasons
            .filter((s) => s.byGameweek.has(gw - 1))
            .map((s) => ({
              entry: s.entry,
              entryName: s.entryName,
              playerName: s.playerName,
              total: s.byGameweek.get(gw - 1)!.total,
              points: s.byGameweek.get(gw - 1)!.points,
            }))
        ).ranks
      : new Map<number, number>();

    const standings: LeagueMemberStanding[] = sorted.map((row) => {
      const rank = ranks.get(row.entry)!;
      const lastRank = previousRanks.get(row.entry) ?? rank;
      return {
        id: row.entry,
        entry: row.entry,
        entryName: row.entryName,
        playerName: row.playerName,
        rank,
        lastRank,
        eventTotal: row.points,
        total: row.total,
        rankDifference: lastRank - rank,
      };
    });

    return { gameweek: gw, standings };
  });

  return {
    leagueId: Number(leagueId),
    leagueName: standingsRes?.league?.name ?? '',
    memberCount: seasons.length,
    gameweeks,
  };
}
