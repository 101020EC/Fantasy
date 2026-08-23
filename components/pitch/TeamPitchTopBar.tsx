'use client';

import React from 'react';
import { FPLEntry, TeamSquadPlayer } from '@/lib/types';
import { CheckCircle2, TrendingDown, TrendingUp, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface TeamPitchTopBarProps {
  entry: FPLEntry;
  gameweek: number;
  players: TeamSquadPlayer[];
  activeChip?: string | null;
}

export default function TeamPitchTopBar({
  entry,
  gameweek,
  players,
  activeChip,
}: TeamPitchTopBarProps) {
  // Accurate calculation of price risks
  const criticalFallers = players.filter((p) => p.priceAnalysis.status === 'falling_soon');
  const likelyFallers = players.filter((p) => p.priceAnalysis.status === 'likely_faller');
  
  const criticalRisers = players.filter((p) => p.priceAnalysis.status === 'rising_soon');
  const likelyRisers = players.filter((p) => p.priceAnalysis.status === 'likely_riser');

  const totalCritical = criticalFallers.length + criticalRisers.length;
  const totalLikely = likelyFallers.length + likelyRisers.length;

  return (
    <div className="pastel-card p-4 sm:p-6 mb-4 shadow-sm transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Avatar + Team Info (Decorated identically to bottom overview header) */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-xl font-bold shrink-0 shadow-sm">
            👑
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-[#38003c] text-white text-[10px] font-black font-mono">
                ID #{entry.id}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-[#38003c] text-[10px] font-black">
                GW {gameweek}
              </span>
              {activeChip && (
                <span className="px-2.5 py-0.5 rounded-full bg-pastel-purple text-[#111318] text-[10px] font-black">
                  {activeChip.toUpperCase()}
                </span>
              )}
              {entry.player_region_name && (
                <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">
                  • {entry.player_region_name}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-[#111318] tracking-tight leading-tight">
              {entry.name}
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              {entry.player_first_name} {entry.player_last_name}
            </p>
          </div>
        </div>

        {/* Right side: Today Safe or Live Alerts */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {totalCritical === 0 && totalLikely === 0 ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs sm:text-sm font-black shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Today Safe</span>
            </div>
          ) : (
            <Link
              href="/prices"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-black shadow-md transition active:scale-95 animate-pulse-fall"
              title="ดูรายละเอียดการปรับราคา"
            >
              <TrendingDown className="w-4 h-4 text-white shrink-0" />
              <span>
                {totalCritical > 0
                  ? `${totalCritical} คนเสี่ยงปรับราคาคืนนี้!`
                  : `${totalLikely} คนมีแนวโน้มปรับราคา`}
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
