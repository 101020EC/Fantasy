import React from 'react';
import { FPLEntry, FPLPicksResponse } from '@/lib/types';

interface TeamHeaderProps {
  entry: FPLEntry;
  picksData: FPLPicksResponse;
  /** True when previewing a gameweek that has not been played yet. */
  isPreview?: boolean;
}

export default function TeamHeader({ entry, picksData, isPreview = false }: TeamHeaderProps) {
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

  // A future gameweek has no points. Showing the current one's numbers under a
  // heading for the gameweek being previewed is simply wrong.
  const dash = '—';
  const gwPoints = history?.points ?? entry.summary_event_points ?? 0;
  const totalPoints = history?.total_points ?? entry.summary_overall_points ?? 0;
  const overallRank = history?.overall_rank ?? entry.summary_overall_rank ?? null;
  const gwRank = history?.rank ?? entry.summary_event_rank ?? null;

  return (
    <div className="pastel-card p-5 sm:p-7 shadow-sm mb-6 transition-colors">
      {/* Identity and gameweek already sit in the hero bar above the pitch;
          repeating them here pushed the numbers below the fold. */}
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* GW Points */}
        <div className="p-3.5 rounded-2xl bg-pastel-blueLight text-center">
          <span className="text-[11px] text-gray-600 block mb-0.5 font-semibold">GW Points</span>
          <span className="text-2xl font-black text-[#111318]">
            {isPreview ? dash : gwPoints}
          </span>
        </div>

        {/* Overall Points */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg text-center">
          <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">Total Points</span>
          <span className="text-2xl font-black text-[#111318]">
            {totalPoints}
          </span>
        </div>

        {/* Overall Rank */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg text-center">
          <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">Overall Rank</span>
          <span className="text-base font-black text-[#111318] truncate block">
            {overallRank ? `#${overallRank.toLocaleString()}` : '-'}
          </span>
        </div>

        {/* GW Rank */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg text-center">
          <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">GW Rank</span>
          <span className="text-base font-black text-pastel-orangeDark truncate block">
            {isPreview ? dash : gwRank ? `#${gwRank.toLocaleString()}` : '-'}
          </span>
        </div>

        {/* Squad Value */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg text-center">
          <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">Squad Value</span>
          <span className="text-base font-black text-emerald-600">£{teamValue}m</span>
        </div>

        {/* Bank */}
        <div className="p-3.5 rounded-2xl bg-pastel-bg text-center">
          <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">In The Bank</span>
          <span className="text-base font-black text-purple-600">£{bank}m</span>
        </div>
      </div>
    </div>
  );
}
