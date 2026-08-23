import React from 'react';
import { FPLEntry, FPLPicksResponse, FPLEvent } from '@/lib/types';
import { Sparkles, User, Globe } from 'lucide-react';

interface TeamHeaderProps {
  entry: FPLEntry;
  picksData: FPLPicksResponse;
  currentEvent: FPLEvent;
}

export default function TeamHeader({ entry, picksData, currentEvent }: TeamHeaderProps) {
  const teamValue = (picksData.entry_history.value / 10).toFixed(1);
  const bank = (picksData.entry_history.bank / 10).toFixed(1);

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-6 border border-purple-200/80 dark:border-purple-800/60 shadow-xl mb-6 transition-colors">
      {/* Top row: Manager Name, Team Name, ID */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-purple-200/60 dark:border-purple-900/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/80 text-purple-800 dark:text-fpl-cyan text-xs font-black border border-purple-300 dark:border-purple-700/50">
              Team ID: {entry.id}
            </span>
            {entry.player_region_name && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                <Globe className="w-3.5 h-3.5 text-gray-400" />
                {entry.player_region_name}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            {entry.name}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5 mt-0.5">
            <User className="w-4 h-4 text-purple-600 dark:text-fpl-green" />
            <span>{entry.player_first_name} {entry.player_last_name}</span>
          </p>
        </div>

        {/* Gameweek Badge & Active Chip */}
        <div className="flex items-center gap-3">
          {picksData.active_chip && (
            <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black text-xs shadow-md flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Chip: {picksData.active_chip.toUpperCase()}</span>
            </div>
          )}
          <div className="px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 text-right">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">สัปดาห์แข่งขัน</span>
            <span className="text-sm font-black text-purple-700 dark:text-fpl-green">
              {currentEvent.name || `Gameweek ${currentEvent.id}`}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
        {/* GW Points */}
        <div className="p-3 bg-purple-50/70 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/40 rounded-xl text-center">
          <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">แต้ม GW นี้</span>
          <span className="text-xl sm:text-2xl font-black text-purple-700 dark:text-fpl-green">
            {picksData.entry_history.points}
          </span>
        </div>

        {/* Overall Points */}
        <div className="p-3 bg-purple-50/70 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/40 rounded-xl text-center">
          <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">แต้มสะสมรวม</span>
          <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
            {picksData.entry_history.total_points}
          </span>
        </div>

        {/* Overall Rank */}
        <div className="p-3 bg-purple-50/70 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/40 rounded-xl text-center">
          <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">อันดับโลก (OR)</span>
          <span className="text-base sm:text-lg font-black text-teal-600 dark:text-fpl-cyan truncate block">
            {picksData.entry_history.overall_rank
              ? `#${picksData.entry_history.overall_rank.toLocaleString()}`
              : entry.summary_overall_rank
              ? `#${entry.summary_overall_rank.toLocaleString()}`
              : '-'}
          </span>
        </div>

        {/* GW Rank */}
        <div className="p-3 bg-purple-50/70 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/40 rounded-xl text-center">
          <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">อันดับ GW</span>
          <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 truncate block">
            {picksData.entry_history.rank ? `#${picksData.entry_history.rank.toLocaleString()}` : '-'}
          </span>
        </div>

        {/* Squad Value */}
        <div className="p-3 bg-purple-50/70 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/40 rounded-xl text-center">
          <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">มูลค่าทีม</span>
          <span className="text-lg font-black text-emerald-600 dark:text-emerald-300">£{teamValue}m</span>
        </div>

        {/* Bank */}
        <div className="p-3 bg-purple-50/70 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/40 rounded-xl text-center">
          <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">เงินในธนาคาร (ITB)</span>
          <span className="text-lg font-black text-purple-600 dark:text-purple-300">£{bank}m</span>
        </div>
      </div>
    </div>
  );
}
