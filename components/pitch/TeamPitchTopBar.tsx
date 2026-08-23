'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FPLEntry, TeamSquadPlayer } from '@/lib/types';
import { CheckCircle2, TrendingDown, TrendingUp, ArrowRightLeft, Send } from 'lucide-react';
import TelegramSettingsModal from '../telegram/TelegramSettingsModal';

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
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);

  // Price risk calculation
  const criticalFallers = players.filter((p) => p.priceAnalysis.status === 'falling_soon');
  const likelyFallers = players.filter((p) => p.priceAnalysis.status === 'likely_faller');
  
  const criticalRisers = players.filter((p) => p.priceAnalysis.status === 'rising_soon');
  const likelyRisers = players.filter((p) => p.priceAnalysis.status === 'likely_riser');

  const totalCritical = criticalFallers.length + criticalRisers.length;
  const totalLikely = likelyFallers.length + likelyRisers.length;

  return (
    <>
      {/* Periwinkle Blue Card */}
      <div className="card-pastel-blue p-5 sm:p-6 mb-4 shadow-xl relative overflow-hidden transition-all text-[#111318]">
        {/* Row 1: Left (ID, GW, Region) & Right (Market Icon + Change Team Icon + Telegram Icon attached to right edge) */}
        <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-black/10">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-3 py-1 rounded-full bg-[#111318] text-white text-[11px] font-black font-mono shadow-sm">
              ID #{entry.id}
            </span>
            <span className="px-3 py-1 rounded-full bg-white/80 text-[#111318] text-[11px] font-black shadow-sm">
              GW {gameweek}
            </span>
            {activeChip && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#38003c] text-white text-[10px] font-black shadow-sm">
                {activeChip.toUpperCase()}
              </span>
            )}
            {entry.player_region_name && (
              <span className="text-[11px] text-[#111318]/70 font-semibold hidden sm:inline ml-1">
                • {entry.player_region_name}
              </span>
            )}
          </div>

          {/* Right Edge: Market (Logo) + Change Team (Logo) + Telegram (Logo) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Market Icon Button (อยู่หน้าสลับทีม) */}
            <Link
              href="/prices"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-white text-orange-600 shadow-sm flex items-center justify-center transition active:scale-95"
              title="ตลาดราคา (Market)"
            >
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </Link>

            {/* Change Team Icon Button */}
            <Link
              href="/?switch=true"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-white text-[#111318] shadow-sm flex items-center justify-center transition active:scale-95"
              title="เปลี่ยนทีม (Change Team)"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </Link>

            {/* Telegram Icon Button */}
            <button
              onClick={() => setIsTelegramOpen(true)}
              type="button"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-sky-50 text-sky-600 shadow-sm flex items-center justify-center transition active:scale-95"
              title="ตั้งค่าแจ้งเตือน Telegram"
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Avatar + Team Name + Today Safe Badge on the Right of Name */}
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/90 flex items-center justify-center text-2xl font-bold shrink-0 shadow-md">
            👑
          </div>

          <div className="flex-1 min-w-0">
            {/* Team Name + Today Safe Badge side-by-side */}
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#111318] tracking-tight truncate">
                {entry.name}
              </h1>

              {/* Today Safe / Price Alert Badge placed directly to the right of Team Name */}
              {totalCritical === 0 && totalLikely === 0 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-black shadow-md shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Today Safe</span>
                </div>
              ) : (
                <Link
                  href="/prices"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md transition active:scale-95 shrink-0 animate-pulse-fall"
                  title="ดูรายละเอียดการปรับราคา"
                >
                  <TrendingDown className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>
                    {totalCritical > 0
                      ? `${totalCritical} คนเสี่ยงปรับราคาคืนนี้!`
                      : `${totalLikely} คนมีแนวโน้มปรับราคา`}
                  </span>
                </Link>
              )}
            </div>

            <p className="text-xs sm:text-sm text-[#111318]/80 font-semibold mt-0.5">
              {entry.player_first_name} {entry.player_last_name}
            </p>
          </div>
        </div>
      </div>

      <TelegramSettingsModal
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
      />
    </>
  );
}
