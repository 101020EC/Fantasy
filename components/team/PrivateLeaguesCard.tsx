'use client';

import React from 'react';
import { Trophy, ArrowUp, ArrowDown, Minus, Shield } from 'lucide-react';

interface PrivateLeaguesCardProps {
  leagues: any[];
}

export default function PrivateLeaguesCard({ leagues = [] }: PrivateLeaguesCardProps) {
  // Filter for private leagues (excluding broad global leagues like Overall, Country, Fan league if possible)
  const privateLeagues = leagues.filter((l) => l.league_type === 'x' || l.rank_type !== 'g');
  const displayLeagues = privateLeagues.length > 0 ? privateLeagues : leagues.slice(0, 8);

  if (!displayLeagues || displayLeagues.length === 0) return null;

  return (
    <div className="pastel-card p-5 sm:p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-[#111318]">Private Leagues</h3>
            <p className="text-[11px] text-gray-500">อันดับในมินิลีกส่วนตัว (บันทึกใน Firebase)</p>
          </div>
        </div>
        <span className="text-xs font-bold text-gray-400 font-mono">
          {displayLeagues.length} Leagues
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {displayLeagues.map((league: any) => {
          const rank = league.entry_rank || 1;
          const lastRank = league.entry_last_rank || rank;
          const rankDiff = lastRank - rank; // positive = went up, negative = went down

          return (
            <div
              key={league.id}
              className="p-3 rounded-2xl bg-gray-50 border border-black/5 flex items-center justify-between gap-2 hover:bg-purple-50/50 transition"
            >
              <div className="truncate">
                <span className="font-black text-xs text-[#111318] block truncate">
                  {league.name}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">ID: {league.id}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <span className="text-sm font-black text-[#38003c] block">
                    #{rank.toLocaleString()}
                  </span>
                  <div className="flex items-center justify-end gap-0.5 text-[10px] font-bold">
                    {rankDiff > 0 ? (
                      <span className="text-emerald-600 flex items-center">
                        <ArrowUp className="w-2.5 h-2.5" /> +{rankDiff}
                      </span>
                    ) : rankDiff < 0 ? (
                      <span className="text-rose-600 flex items-center">
                        <ArrowDown className="w-2.5 h-2.5" /> {rankDiff}
                      </span>
                    ) : (
                      <span className="text-gray-400 flex items-center">
                        <Minus className="w-2.5 h-2.5" /> 0
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
