'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, X } from 'lucide-react';

interface StoredTeam {
  id: string;
  name: string;
  managerName?: string;
  timestamp: number;
}

export function saveRecentTeam(id: string, name: string, managerName?: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('fpl_recent_teams');
    let teams: StoredTeam[] = raw ? JSON.parse(raw) : [];
    
    // Remove if already exists to push to front
    teams = teams.filter((t) => t.id !== id);
    teams.unshift({
      id,
      name,
      managerName,
      timestamp: Date.now(),
    });

    // Keep max 6
    teams = teams.slice(0, 6);
    localStorage.setItem('fpl_recent_teams', JSON.stringify(teams));
  } catch (e) {
    console.error(e);
  }
}

export default function RecentTeams() {
  const [recentTeams, setRecentTeams] = useState<StoredTeam[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fpl_recent_teams');
      if (raw) {
        setRecentTeams(JSON.parse(raw));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const removeTeam = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = recentTeams.filter((t) => t.id !== id);
    setRecentTeams(updated);
    localStorage.setItem('fpl_recent_teams', JSON.stringify(updated));
  };

  if (recentTeams.length === 0) return null;

  return (
    <div className="w-full mt-4 text-left">
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-2">
        <History className="w-3 h-3 text-pastel-blueDark" />
        <span>ทีมที่ดูล่าสุด (Recent Teams)</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {recentTeams.map((team) => (
          <Link
            key={team.id}
            href={`/team/${team.id}`}
            className="group flex items-center gap-1.5 px-3 py-1 rounded-full bg-pastel-bg hover:bg-pastel-blueLight transition text-[#111318] text-xs shadow-sm border border-black/5"
          >
            <span className="font-bold">
              {team.name || `Team #${team.id}`}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">#{team.id}</span>
            <button
              onClick={(e) => removeTeam(e, team.id)}
              className="text-gray-400 hover:text-rose-500 p-0.5 rounded-full"
              title="ลบออกจากประวัติ"
            >
              <X className="w-3 h-3" />
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}
