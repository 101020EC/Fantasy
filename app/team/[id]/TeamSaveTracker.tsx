'use client';

import { useEffect } from 'react';
import { saveRecentTeam } from '@/components/team/RecentTeams';
import { useAuth } from '@/components/AuthContext';
import { archiveSelectedLeaguesData } from '@/lib/firebase-service';

interface TeamSaveTrackerProps {
  id: string;
  entry: any;
  picksData: any;
  gw: number;
}


/** How long an archive of the same squad and leagues is considered current. */
const ARCHIVE_TTL_MS = 6 * 60 * 60 * 1000;

const archiveKey = (id: string, gw: number, leagueIds: number[]) =>
  `fpl_archived_${id}_${gw}_${[...leagueIds].sort((a, b) => a - b).join('-')}`;

/**
 * Whether this exact squad and league selection was archived recently.
 *
 * This request re-fetched the entry, picks, history, transfers and every
 * selected league's full standings, then wrote a Firestore batch — on **every**
 * visit to the team page, writing the same gameweek over and over. Harmless on
 * a desktop connection, and a heavy competitor for bandwidth on a phone.
 *
 * The key includes the gameweek and the league selection, so a new gameweek or
 * a changed selection archives immediately rather than waiting out the window.
 */
function archivedRecently(id: string, gw: number, leagueIds: number[]): boolean {
  try {
    const at = Number(localStorage.getItem(archiveKey(id, gw, leagueIds)));
    return Number.isFinite(at) && at > 0 && Date.now() - at < ARCHIVE_TTL_MS;
  } catch {
    // Private browsing, or storage disabled. Archiving every time is the old
    // behaviour and is still correct — just not free.
    return false;
  }
}

function markArchived(id: string, gw: number, leagueIds: number[]): void {
  try {
    localStorage.setItem(archiveKey(id, gw, leagueIds), String(Date.now()));
  } catch {}
}

export default function TeamSaveTracker({ id, entry, picksData, gw }: TeamSaveTrackerProps) {
  const { setSavedTeamId } = useAuth();

  useEffect(() => {
    const managerName = `${entry.player_first_name} ${entry.player_last_name}`;
    saveRecentTeam(id, entry.name, managerName);
    setSavedTeamId(id);

    // Background sync of the leagues the user picked in the Backup modal.
    // Returns 503 harmlessly when the server has no Firebase credentials.
    try {
      const savedLeaguesRaw = localStorage.getItem(`fpl_selected_leagues_${id}`);
      const selectedIds: number[] = savedLeaguesRaw ? JSON.parse(savedLeaguesRaw) : [];
      if (selectedIds.length > 0 && !archivedRecently(id, gw, selectedIds)) {
        archiveSelectedLeaguesData(id, gw, selectedIds)
          .then(() => markArchived(id, gw, selectedIds))
          .catch((err) => console.warn('Background archive failed:', err.message));
      }
    } catch (err) {
      console.warn('Could not read saved league selection:', err);
    }
  }, [id, entry, picksData, gw, setSavedTeamId]);

  return null;
}
