'use client';

import { useEffect } from 'react';
import { saveRecentTeam } from '@/components/team/RecentTeams';

interface TeamSaveTrackerProps {
  id: string;
  name: string;
  managerName: string;
}

export default function TeamSaveTracker({ id, name, managerName }: TeamSaveTrackerProps) {
  useEffect(() => {
    saveRecentTeam(id, name, managerName);
  }, [id, name, managerName]);

  return null;
}
