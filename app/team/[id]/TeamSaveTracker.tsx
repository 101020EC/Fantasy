'use client';

import { useEffect } from 'react';
import { saveRecentTeam } from '@/components/team/RecentTeams';
import { useAuth } from '@/components/AuthContext';
import { archiveCompleteTeamData } from '@/lib/firebase-service';

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

    // Background Complete Sync to Firebase Firestore (Team Profile + GW Picks + All Private Leagues Standings)
    archiveCompleteTeamData(id, entry, picksData, gw).catch((err) => {
      console.warn('Firebase background sync notice:', err);
    });
  }, [id, entry, picksData, gw, setSavedTeamId]);

  return null;
}
