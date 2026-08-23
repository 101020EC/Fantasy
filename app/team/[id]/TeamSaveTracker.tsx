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
      if (selectedIds.length > 0) {
        archiveSelectedLeaguesData(id, gw, selectedIds).catch((err) =>
          console.warn('Background archive failed:', err.message)
        );
      }
    } catch (err) {
      console.warn('Could not read saved league selection:', err);
    }
  }, [id, entry, picksData, gw, setSavedTeamId]);

  return null;
}
