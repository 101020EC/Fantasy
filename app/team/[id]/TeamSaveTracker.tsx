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

    // Sync only user's selected leagues (if any selected in localStorage)
    try {
      const savedLeaguesRaw = localStorage.getItem(`fpl_selected_leagues_${id}`);
      const selectedIds: number[] = savedLeaguesRaw ? JSON.parse(savedLeaguesRaw) : [];
      if (selectedIds.length > 0) {
        archiveSelectedLeaguesData(id, entry, picksData, gw, selectedIds).catch(() => {});
      }
    } catch {}
  }, [id, entry, picksData, gw, setSavedTeamId]);

  return null;
}
