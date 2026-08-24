import { getAdminDb } from './firebase-admin';
import { FPLPicksResponse } from './types';
import {
  fetchFPLEntry,
  fetchFPLPicks,
  fetchFPLLeagueStandings,
  fetchFPLHistory,
  fetchFPLTransfers,
} from './fpl-api';

export interface LeagueMemberStanding {
  id: number;
  entry: number;
  entryName: string;
  playerName: string;
  rank: number;
  lastRank: number;
  eventTotal: number;
  total: number;
  rankDifference: number;
}

export interface CompleteArchiveData {
  teamId: string;
  teamName: string;
  managerName: string;
  region: string;
  gameweek: number;
  overallPoints: number;
  overallRank: number | null;
  gwPoints: number;
  gwRank: number | null;
  teamValue: number;
  bank: number;
  activeChip: string | null;
  squad: any[];
  selectedPrivateLeagues: {
    id: number;
    name: string;
    myRank: number;
    myLastRank: number;
    membersCount: number;
    standings: LeagueMemberStanding[];
  }[];
  seasonHistory: any;
  transfersHistory: any[];
  lastSynced: string;
}

/**
 * Gathers every piece of FPL data needed for an archive.
 *
 * SERVER ONLY. The FPL API sends no Access-Control-Allow-Origin header, so all
 * of these fetches are blocked when called from the browser. Reach this through
 * POST /api/archive instead of importing it into a client component.
 */
export async function buildArchivePayload(
  teamId: string | number,
  gw: number,
  selectedLeagueIds: number[] = []
): Promise<CompleteArchiveData> {
  const id = String(teamId);

  // 1. Entry, picks, history and transfers in parallel
  const [entry, picksData, historyData, transfersData] = await Promise.all([
    fetchFPLEntry(id),
    fetchFPLPicks(id, gw).catch(() => null) as Promise<FPLPicksResponse | null>,
    fetchFPLHistory(id),
    fetchFPLTransfers(id),
  ]);

  // 2. Keep only the leagues the user selected
  const classicLeagues = (entry as any).leagues?.classic || [];
  const targetLeagues = classicLeagues.filter((l: any) =>
    selectedLeagueIds.includes(Number(l.id))
  );

  // 3. Full standings for each selected league, in parallel
  const fullSelectedLeagues = await Promise.all(
    targetLeagues.map(async (league: any) => {
      const standingsRes = await fetchFPLLeagueStandings(league.id);
      const results: any[] = standingsRes?.standings?.results || [];

      // Every field needs a concrete value: the Admin SDK rejects a document
      // containing undefined. FPL also dropped `id` from this payload, so the
      // manager's entry number is the stable identifier now.
      const memberStandings: LeagueMemberStanding[] = results.map((r: any) => {
        const rank = Number(r.rank) || 0;
        const lastRank = Number(r.last_rank) || rank;

        return {
          id: Number(r.id ?? r.entry) || 0,
          entry: Number(r.entry) || 0,
          entryName: r.entry_name ?? '',
          playerName: r.player_name ?? '',
          rank,
          lastRank,
          eventTotal: Number(r.event_total) || 0,
          total: Number(r.total) || 0,
          rankDifference: lastRank - rank,
        };
      });

      return {
        id: Number(league.id) || 0,
        name: league.name ?? '',
        myRank: Number(league.entry_rank) || 0,
        myLastRank: Number(league.entry_last_rank) || Number(league.entry_rank) || 0,
        membersCount: memberStandings.length,
        standings: memberStandings,
      };
    })
  );

  return {
    teamId: id,
    teamName: entry.name ?? '',
    managerName: `${entry.player_first_name ?? ''} ${entry.player_last_name ?? ''}`.trim(),
    region: entry.player_region_name || '',
    gameweek: gw,
    overallPoints: picksData?.entry_history?.total_points ?? entry.summary_overall_points ?? 0,
    overallRank: picksData?.entry_history?.overall_rank ?? entry.summary_overall_rank ?? null,
    gwPoints: picksData?.entry_history?.points ?? entry.summary_event_points ?? 0,
    gwRank: picksData?.entry_history?.rank ?? entry.summary_event_rank ?? null,
    teamValue: (picksData?.entry_history?.value ?? entry.last_deadline_value ?? 1000) / 10,
    bank: (picksData?.entry_history?.bank ?? entry.last_deadline_bank ?? 0) / 10,
    activeChip: picksData?.active_chip || null,
    squad: picksData?.picks || [],
    selectedPrivateLeagues: fullSelectedLeagues,
    seasonHistory: historyData,
    transfersHistory: transfersData,
    lastSynced: new Date().toISOString(),
  };
}

/**
 * Writes a gameweek snapshot to three places in one batch.
 *
 * Lives here rather than in the route so the nightly cron can archive a
 * finalised gameweek too. Risk F-1: the only trigger used to be a useEffect on
 * the team page, so a gameweek nobody opened was never archived — and FPL keeps
 * serving the picks, so the gap was silent. A backtest over "my squad each
 * week" therefore had holes by construction.
 */
export async function writeArchive(
  archive: CompleteArchiveData,
  opts: { dataChecked?: boolean; source?: 'live' | 'cron' } = {}
) {
  const dataChecked = opts.dataChecked ?? false;
  const source = opts.source ?? 'live';
  const db = getAdminDb();
  const id = String(archive.teamId);
  const gw = archive.gameweek;

  const batch = db.batch();

  // A. Team gameweek snapshot: teams/{teamId}/gameweeks/gw_{gw}
  // Risk F-2: the archive used to store whatever FPL reported at the moment a
  // page was open, including provisional scores it later contradicted. Recording
  // how final the numbers are lets a re-archive replace a provisional snapshot,
  // and lets a backtest refuse to score against one.
  batch.set(
    db.collection('teams').doc(id).collection('gameweeks').doc(`gw_${gw}`),
    { ...archive, dataChecked, source },
    { merge: true }
  );

  // B. Team root document: teams/{teamId}
  batch.set(
    db.collection('teams').doc(id),
    {
      teamName: archive.teamName,
      managerName: archive.managerName,
      region: archive.region,
      overallPoints: archive.overallPoints,
      overallRank: archive.overallRank,
      lastUpdatedGw: gw,
      selectedLeagueIds: archive.selectedPrivateLeagues.map((l) => l.id),
      lastSynced: archive.lastSynced,
    },
    { merge: true }
  );

  // C. Standings per selected league: leagues/{leagueId}/gameweeks/gw_{gw}
  for (const league of archive.selectedPrivateLeagues) {
    if (league.standings.length === 0) continue;
    batch.set(
      db.collection('leagues').doc(String(league.id)).collection('gameweeks').doc(`gw_${gw}`),
      {
        leagueId: league.id,
        leagueName: league.name,
        gameweek: gw,
        totalMembers: league.membersCount,
        standings: league.standings,
        updatedAt: archive.lastSynced,
      },
      { merge: true }
    );
  }

  await batch.commit();
}
