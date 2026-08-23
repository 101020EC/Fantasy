import React from 'react';
import { FPLEntry, FPLPicksResponse, FPLEvent } from '@/lib/types';
import { Sparkles, User, Globe } from 'lucide-react';

interface TeamHeaderProps {
  entry: FPLEntry;
  picksData: FPLPicksResponse;
  currentEvent: FPLEvent;
}

export default function TeamHeader({ entry, picksData, currentEvent }: TeamHeaderProps) {
  const history = picksData?.entry_history;

  const teamValue = history?.value
    ? (history.value / 10).toFixed(1)
    : entry.last_deadline_value
    ? (entry.last_deadline_value / 10).toFixed(1)
    : '100.0';

  const bank = history?.bank != null
    ? (history.bank / 10).toFixed(1)
    : entry.last_deadline_bank != null
    ? (entry.last_deadline_bank / 10).toFixed(1)
    : '0.0';

  const gwPoints = history?.points ?? entry.summary_event_points ?? 0;
  const totalPoints = history?.total_points ?? entry.summary_overall_points ?? 0;
  const overallRank = history?.overall_rank ?? entry.summary_overall_rank ?? null;
  const gwRank = history?.rank ?? entry.summary_event_rank ?? null;

  return (
    <div className="pastel-card p-5 sm:p-7 shadow-sm mb-6 transition-colors">
      {/* Top row: Manager Name, Team Name, ID */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-black/5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-xl font-bold shrink-0">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2.5 py-0.5 rounded-full bg-[#38003c] text-white text-[10px] font-black">
                ID #{entry.id}
              </span>
              {entry.player_region_name && (
                <span className="text-[11px] text-gray-500 font-medium">
                  • {entry.player_region_name}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#111318] tracking-tight">
              {entry.name}
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              {entry.player_first_name} {entry.player_last_name}
            </p>
          </div>
        </div>

        {/* Gameweek Badge & Active Chip */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {picksData?.active_chip && (
            <div className="px-3 py-1.5 rounded-full bg-pastel-purple text-[#111318] font-black text-xs shadow-sm flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{picksData.active_chip.toUpperCase()}</span>
            </div>
          )}
          <div className="px-3.5 py-1.5 rounded-full bg-pastel-bg border border-black/5 text-right">
            <span className="text-xs font-black text-[#111318]">
              {currentEvent?.name || `Gameweek ${currentEvent?.id || 1}`}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-5">
        {/* GW Points */}
        <div className="p-3.5 rounded-2xl bg-pastel-blueLight text-center">
          <span className="text-[11px] text-gray-600 block mb-0.5 font-semibold">แต้ม GW นี้</span>
          <span className="text-2xl font-black text-[#111318]">
            {gwPoints}
          </span>
        </div>

        {/* Overall Points */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg text-center">
          <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">แต้มสะสมรวม</span>
          <span className="text-2xl font-black text-[#111318]">
            {totalPoints}
          </span>
        </div>

        {/* Overall Rank */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg text-center">
          <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">อันดับโลก (OR)</span>
          <span className="text-base font-black text-[#111318] truncate block">
            {overallRank ? `#${overallRank.toLocaleString()}` : '-'}
          </span>
        </div>

        {/* GW Rank */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg text-center">
          <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">อันดับ GW</span>
          <span className="text-base font-black text-pastel-orangeDark truncate block">
            {gwRank ? `#${gwRank.toLocaleString()}` : '-'}
          </span>
        </div>

        {/* Squad Value */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg text-center">
          <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">มูลค่าทีม</span>
          <span className="text-base font-black text-emerald-600">£{teamValue}m</span>
        </div>

        {/* Bank */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg text-center">
          <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">เงินคงเหลือ (ITB)</span>
          <span className="text-base font-black text-purple-600">£{bank}m</span>
        </div>
      </div>
    </div>
  );
}
