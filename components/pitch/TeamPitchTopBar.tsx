'use client';

import React from 'react';
import { FPLEntry, TeamSquadPlayer } from '@/lib/types';
import { CheckCircle2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface TeamPitchTopBarProps {
  entry: FPLEntry;
  gameweek: number;
  players: TeamSquadPlayer[];
}

export default function TeamPitchTopBar({ entry, gameweek, players }: TeamPitchTopBarProps) {
  const criticalFallers = players.filter((p) => p.priceAnalysis.status === 'falling_soon');
  const criticalRisers = players.filter((p) => p.priceAnalysis.status === 'rising_soon');
  const totalAlerts = criticalFallers.length + criticalRisers.length;

  return (
    <div className="pastel-card p-3 sm:p-4 mb-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Front: Team Name • ID • Manager Name • Gameweek */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
        <span className="font-black text-[#38003c] text-sm sm:text-base">
          {entry.name}
        </span>
        <span className="text-gray-300">•</span>
        <span className="px-2 py-0.5 rounded-full bg-[#38003c] text-white text-[11px] font-mono font-black">
          #{entry.id}
        </span>
        <span className="text-gray-300">•</span>
        <span className="text-gray-600 font-semibold">
          {entry.player_first_name} {entry.player_last_name}
        </span>
        <span className="text-gray-300">•</span>
        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-[#38003c] font-black text-[11px]">
          GW {gameweek}
        </span>
      </div>

      {/* Right side: Today Safe / Price Alerts */}
      <div className="flex items-center gap-2 self-start sm:self-auto">
        {totalAlerts === 0 ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Today Safe</span>
          </div>
        ) : (
          <Link
            href="/prices"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111318] text-white text-xs font-black shadow-sm animate-pulse-fall"
            title="มีนักเตะในทีมเสี่ยงปรับราคาคืนนี้"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>{totalAlerts} คนเสี่ยงปรับราคาคืนนี้</span>
          </Link>
        )}
      </div>
    </div>
  );
}
