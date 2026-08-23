'use client';

import { useEffect } from 'react';
import { saveRecentTeam } from '@/components/team/RecentTeams';
import { useAuth } from '@/components/AuthContext';
import { archiveGameweekData } from '@/lib/firebase-service';

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

    // Background save to Firebase Firestore
    archiveGameweekData(id, entry, picksData, gw).catch(() => {});
  }, [id, entry, picksData, gw, setSavedTeamId]);

  return null;
}
