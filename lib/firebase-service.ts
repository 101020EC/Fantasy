import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { FPLPicksResponse } from './types';
import { fetchFPLLeagueStandings, fetchFPLHistory, fetchFPLTransfers } from './fpl-api';

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
 * Save / Archive into Firebase Firestore for SELECTED leagues only:
 */
export async function archiveSelectedLeaguesData(
  teamId: string | number,
  entry: any,
  picksData: FPLPicksResponse,
  gw: number,
  selectedLeagueIds: number[] = []
): Promise<CompleteArchiveData | null> {
  try {
    const id = String(teamId);

    // 1. Fetch History & Transfers
    const [historyData, transfersData] = await Promise.all([
      fetchFPLHistory(id),
      fetchFPLTransfers(id),
    ]);

    // 2. Filter ONLY user-selected leagues
    const classicLeagues = entry.leagues?.classic || [];
    const targetLeagues = classicLeagues.filter((l: any) =>
      selectedLeagueIds.includes(Number(l.id))
    );

    // 3. Fetch full standings of EVERY member only for selected leagues
    const leagueStandingsPromises = targetLeagues.map(async (league: any) => {
      const standingsRes = await fetchFPLLeagueStandings(league.id);
      const results: any[] = standingsRes?.standings?.results || [];

      const memberStandings: LeagueMemberStanding[] = results.map((r: any) => ({
        id: r.id,
        entry: r.entry,
        entryName: r.entry_name,
        playerName: r.player_name,
        rank: r.rank,
        lastRank: r.last_rank || r.rank,
        eventTotal: r.event_total || 0,
        total: r.total || 0,
        rankDifference: (r.last_rank || r.rank) - r.rank,
      }));

      return {
        id: league.id,
        name: league.name,
        myRank: league.entry_rank || 1,
        myLastRank: league.entry_last_rank || 1,
        membersCount: memberStandings.length,
        standings: memberStandings,
      };
    });

    const fullSelectedLeagues = await Promise.all(leagueStandingsPromises);

    // 4. Build Complete Archive Object
    const completeArchive: CompleteArchiveData = {
      teamId: id,
      teamName: entry.name,
      managerName: `${entry.player_first_name} ${entry.player_last_name}`,
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

    // 5. Store in Firestore:
    // A. Team Gameweek Document: teams/{teamId}/gameweeks/gw_{gw}
    const gwDocRef = doc(db, 'teams', id, 'gameweeks', `gw_${gw}`);
    await setDoc(gwDocRef, completeArchive, { merge: true });

    // B. Team Root Document: teams/{teamId}
    const teamDocRef = doc(db, 'teams', id);
    await setDoc(
      teamDocRef,
      {
        teamName: entry.name,
        managerName: `${entry.player_first_name} ${entry.player_last_name}`,
        region: entry.player_region_name || '',
        overallPoints: completeArchive.overallPoints,
        overallRank: completeArchive.overallRank,
        lastUpdatedGw: gw,
        selectedLeagueIds,
        lastSynced: completeArchive.lastSynced,
      },
      { merge: true }
    );

    // C. Store Each Selected League's Standings: leagues/{leagueId}/gameweeks/gw_{gw}
    for (const league of fullSelectedLeagues) {
      if (league.standings.length > 0) {
        const leagueGwRef = doc(db, 'leagues', String(league.id), 'gameweeks', `gw_${gw}`);
        await setDoc(
          leagueGwRef,
          {
            leagueId: league.id,
            leagueName: league.name,
            gameweek: gw,
            totalMembers: league.membersCount,
            standings: league.standings,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }

    return completeArchive;
  } catch (error) {
    console.warn('Firebase selected league archive error:', error);
    return null;
  }
}
