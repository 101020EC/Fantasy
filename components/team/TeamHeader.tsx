import React from 'react';
import { FPLEntry, FPLPicksResponse, FPLEvent } from '@/lib/types';
import { Sparkles, User, Globe, Trophy, Shield } from 'lucide-react';

interface TeamHeaderProps {
  entry: FPLEntry;
  picksData: FPLPicksResponse;
  currentEvent: FPLEvent;
}

export default function TeamHeader({ entry, picksData, currentEvent }: TeamHeaderProps) {
  const teamValue = (picksData.entry_history.value / 10).toFixed(1);
  const bank = (picksData.entry_history.bank / 10).toFixed(1);

  return (
    <div className="pastel-card p-5 sm:p-7 shadow-sm mb-6 transition-colors">
      {/* Top row: Manager Name, Team Name, ID */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-black/5 dark:border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-pastel-blueLight dark:bg-pastel-darkPill flex items-center justify-center text-xl font-bold shrink-0">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2.5 py-0.5 rounded-full bg-[#111318] dark:bg-white text-white dark:text-[#111318] text-[10px] font-black">
                ID #{entry.id}
              </span>
              {entry.player_region_name && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  • {entry.player_region_name}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#111318] dark:text-white tracking-tight">
              {entry.name}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {entry.player_first_name} {entry.player_last_name}
            </p>
          </div>
        </div>

        {/* Gameweek Badge & Active Chip */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {picksData.active_chip && (
            <div className="px-3 py-1.5 rounded-full bg-pastel-purple text-[#111318] font-black text-xs shadow-sm flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{picksData.active_chip.toUpperCase()}</span>
            </div>
          )}
          <div className="px-3.5 py-1.5 rounded-full bg-pastel-bg dark:bg-pastel-darkPill border border-black/5 dark:border-white/10 text-right">
            <span className="text-xs font-black text-[#111318] dark:text-white">
              {currentEvent.name || `Gameweek ${currentEvent.id}`}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid (Matching the pastel stat pills) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-5">
        {/* GW Points */}
        <div className="p-3.5 rounded-2xl bg-pastel-blueLight dark:bg-[#1f283d] text-center">
          <span className="text-[11px] text-gray-600 dark:text-gray-400 block mb-0.5 font-semibold">แต้ม GW นี้</span>
          <span className="text-2xl font-black text-[#111318] dark:text-pastel-blue">
            {picksData.entry_history.points}
          </span>
        </div>

        {/* Overall Points */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg dark:bg-pastel-darkPill text-center">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5 font-semibold">แต้มสะสมรวม</span>
          <span className="text-2xl font-black text-[#111318] dark:text-white">
            {picksData.entry_history.total_points}
          </span>
        </div>

        {/* Overall Rank */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg dark:bg-pastel-darkPill text-center">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5 font-semibold">อันดับโลก (OR)</span>
          <span className="text-base font-black text-[#111318] dark:text-white truncate block">
            {picksData.entry_history.overall_rank
              ? `#${picksData.entry_history.overall_rank.toLocaleString()}`
              : entry.summary_overall_rank
              ? `#${entry.summary_overall_rank.toLocaleString()}`
              : '-'}
          </span>
        </div>

        {/* GW Rank */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg dark:bg-pastel-darkPill text-center">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5 font-semibold">อันดับ GW</span>
          <span className="text-base font-black text-pastel-orangeDark dark:text-pastel-orange truncate block">
            {picksData.entry_history.rank ? `#${picksData.entry_history.rank.toLocaleString()}` : '-'}
          </span>
        </div>

        {/* Squad Value */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg dark:bg-pastel-darkPill text-center">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5 font-semibold">มูลค่าทีม</span>
          <span className="text-base font-black text-emerald-600 dark:text-emerald-400">£{teamValue}m</span>
        </div>

        {/* Bank */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg dark:bg-pastel-darkPill text-center">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5 font-semibold">เงินคงเหลือ (ITB)</span>
          <span className="text-base font-black text-purple-600 dark:text-pastel-purple">£{bank}m</span>
        </div>
      </div>
    </div>
  );
}
