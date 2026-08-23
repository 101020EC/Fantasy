import { db } from './firebase';
import { doc, setDoc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { FPLEntry, FPLPicksResponse } from './types';

export interface GameweekArchive {
  teamId: string;
  teamName: string;
  managerName: string;
  gameweek: number;
  points: number;
  totalPoints: number;
  overallRank: number | null;
  gwRank: number | null;
  teamValue: number;
  bank: number;
  activeChip: string | null;
  picks: FPLPicksResponse['picks'];
  privateLeagues: {
    id: number;
    name: string;
    rank: number;
    lastRank: number;
  }[];
  timestamp: string;
}

/**
 * Save / Archive Gameweek data + Private Leagues into Firebase Firestore
 */
export async function archiveGameweekData(
  teamId: string | number,
  entry: any,
  picksData: FPLPicksResponse,
  gw: number
): Promise<boolean> {
  try {
    const id = String(teamId);
    
    // Filter private classic leagues (exclude general/overall leagues)
    const privateLeagues = (entry.leagues?.classic || [])
      .filter((l: any) => l.league_type === 'x' || l.rank_type !== 'g') // 'x' indicates private league
      .map((l: any) => ({
        id: l.id,
        name: l.name,
        rank: l.entry_rank || l.entry_last_rank || 1,
        lastRank: l.entry_last_rank || l.entry_rank || 1,
      }));

    const archiveData: GameweekArchive = {
      teamId: id,
      teamName: entry.name,
      managerName: `${entry.player_first_name} ${entry.player_last_name}`,
      gameweek: gw,
      points: picksData.entry_history?.points ?? entry.summary_event_points ?? 0,
      totalPoints: picksData.entry_history?.total_points ?? entry.summary_overall_points ?? 0,
      overallRank: picksData.entry_history?.overall_rank ?? entry.summary_overall_rank ?? null,
      gwRank: picksData.entry_history?.rank ?? entry.summary_event_rank ?? null,
      teamValue: (picksData.entry_history?.value ?? entry.last_deadline_value ?? 1000) / 10,
      bank: (picksData.entry_history?.bank ?? entry.last_deadline_bank ?? 0) / 10,
      activeChip: picksData.active_chip,
      picks: picksData.picks,
      privateLeagues: privateLeagues.length > 0 ? privateLeagues : (entry.leagues?.classic || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        rank: l.entry_rank || 1,
        lastRank: l.entry_last_rank || 1,
      })),
      timestamp: new Date().toISOString(),
    };

    // Save to Firestore: teams/{teamId}/gameweeks/{gw}
    const gwDocRef = doc(db, 'teams', id, 'gameweeks', `gw_${gw}`);
    await setDoc(gwDocRef, archiveData, { merge: true });

    // Also update team summary doc
    const teamDocRef = doc(db, 'teams', id);
    await setDoc(
      teamDocRef,
      {
        lastUpdatedGw: gw,
        teamName: entry.name,
        managerName: `${entry.player_first_name} ${entry.player_last_name}`,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.warn('Firebase Archive skipped/error:', error);
    return false;
  }
}
