'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FPLEntry, TeamSquadPlayer } from '@/lib/types';
import { CheckCircle2, TrendingDown, TrendingUp, History } from 'lucide-react';

interface TeamPitchTopBarProps {
  entry: FPLEntry;
  gameweek: number;
  /** Gameweek the fixture strip is showing; may run ahead of the squad's. */
  fixtureGw?: number;
  players: TeamSquadPlayer[];
  activeChip?: string | null;
}

export default function TeamPitchTopBar({
  entry,
  gameweek,
  fixtureGw,
  players,
  activeChip,
}: TeamPitchTopBarProps) {
  const shownGw = fixtureGw ?? gameweek;

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
        <div className="flex items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-black/10">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-3 py-1 rounded-full bg-[#111318] text-white text-[11px] font-black font-mono shadow-sm">
              ID #{entry.id}
            </span>
            {/* Two plain chips: the squad's gameweek, and the next one to
                preview fixtures for. No arrows — they implied paging through
                gameweeks, which is not what this does. */}
            {[gameweek, gameweek + 1].filter((gw) => gw <= 38).map((gw) => {
              const isShown = gw === shownGw;
              const href = gw === gameweek ? `/team/${entry.id}` : `/team/${entry.id}?gw=${gw}`;
              return (
                <Link
                  key={gw}
                  href={href}
                  title={
                    gw === gameweek
                      ? `This squad, gameweek ${gw}`
                      : `Fixtures this squad faces in gameweek ${gw}`
                  }
                  className={`px-3 py-1 rounded-full text-[11px] font-black shadow-sm transition active:scale-95 ${
                    isShown
                      ? 'bg-[#111318] text-white'
                      : 'bg-white/60 text-[#111318] hover:bg-white'
                  }`}
                >
                  GW {gw}
                </Link>
              );
            })}
            {entry.player_region_name && (
              <span className="text-[11px] text-[#111318]/70 font-semibold hidden sm:inline ml-1">
                • {entry.player_region_name}
              </span>
            )}
          </div>

          {/* Market and History. Changing team lives on History, and the alert
              settings moved to the navbar, so neither needs a slot here. */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/prices"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-white text-orange-600 shadow-sm flex items-center justify-center transition active:scale-95"
              title="Market prices"
              aria-label="Market prices"
            >
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </Link>

            <Link
              href="/"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-white text-emerald-700 shadow-sm flex items-center justify-center transition active:scale-95"
              title="History"
              aria-label="History"
            >
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </Link>
          </div>
        </div>

        {/* Row 2: Left (Avatar + Names) & Right (Today Safe aligned to right edge) */}
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/90 overflow-hidden shrink-0 shadow-md">
              <Image src="/logo.png" alt="Fanta" width={56} height={56} className="w-full h-full object-cover" />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#111318] tracking-tight leading-tight truncate">
                {entry.name}
              </h1>
              <p className="text-xs sm:text-sm text-[#111318]/80 font-semibold mt-0.5 leading-snug">
                {entry.player_first_name} {entry.player_last_name}
              </p>
            </div>
          </div>

          {/* Right Edge: Today Safe with Live Pulse */}
          <div className="shrink-0">
            {totalCritical === 0 && totalLikely === 0 ? (
              <div className="relative overflow-hidden px-3.5 sm:px-5 py-2.5 sm:py-3.5 rounded-2xl bg-emerald-500 text-white font-black text-xs sm:text-sm shadow-md flex items-center gap-2 border border-white/20">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-100 opacity-85"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
                <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                <span className="whitespace-nowrap">Today Safe</span>
              </div>
            ) : (
              <Link
                href="/prices"
                className="relative overflow-hidden px-3.5 sm:px-5 py-2.5 sm:py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm shadow-md transition active:scale-95 flex items-center gap-2 border border-white/20 animate-pulse-fall"
                title="View Price Changes"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-200 opacity-85"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
                <TrendingDown className="w-4 h-4 stroke-[3]" />
                <span className="whitespace-nowrap">
                  {totalCritical > 0
                    ? `${totalCritical} Players at Risk!`
                    : `${totalLikely} Likely to Change`}
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>

    </>
  );
}
