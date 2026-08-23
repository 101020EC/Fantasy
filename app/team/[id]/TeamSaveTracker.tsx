'use client';

import { useEffect } from 'react';
import { saveRecentTeam } from '@/components/team/RecentTeams';
import { useAuth } from '@/components/AuthContext';

interface TeamSaveTrackerProps {
  id: string;
  name: string;
  managerName: string;
}

export default function TeamSaveTracker({ id, name, managerName }: TeamSaveTrackerProps) {
  const { setSavedTeamId } = useAuth();

  useEffect(() => {
    saveRecentTeam(id, name, managerName);
    setSavedTeamId(id);
  }, [id, name, managerName, setSavedTeamId]);

  return null;
}
