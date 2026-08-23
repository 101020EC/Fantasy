import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  fetchFPLBootstrap,
  fetchFPLEntry,
  fetchFPLPicks,
  fetchFPLFixtures,
  buildSquadPlayers,
} from '@/lib/fpl-api';
import { FPLPicksResponse } from '@/lib/types';
import TeamHeader from '@/components/team/TeamHeader';
import FootballPitch from '@/components/pitch/FootballPitch';
import TeamPitchTopBar from '@/components/pitch/TeamPitchTopBar';
import PriceAlertBanner from '@/components/prices/PriceAlertBanner';
import PrivateLeaguesCard from '@/components/team/PrivateLeaguesCard';
import TeamSaveTracker from './TeamSaveTracker';
import TeamActionButtons from '@/components/team/TeamActionButtons';
import { AlertCircle, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface TeamPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gw?: string }>;
}

export default async function TeamPage({ params, searchParams }: TeamPageProps) {
  const { id } = await params;
  const { gw: queryGw } = await searchParams;

  if (!id || isNaN(Number(id))) {
    notFound();
  }

  try {
    const bootstrap = await fetchFPLBootstrap();
    const entry = await fetchFPLEntry(id);

    const currentEvent =
      bootstrap.events.find((e) => e.is_current) ||
      bootstrap.events.find((e) => e.is_next) ||
      bootstrap.events[0];

    const initialGw = queryGw ? parseInt(queryGw) : (entry.current_event || currentEvent?.id || 1);

    let activeGw = initialGw;
    let picksData: FPLPicksResponse | null = null;

    // Try fetching the requested GW, fallback to previous GWs if deadline not passed yet
    try {
      picksData = await fetchFPLPicks(id, activeGw);
    } catch (err) {
      for (let fallbackGw = activeGw - 1; fallbackGw >= 1; fallbackGw--) {
        try {
          picksData = await fetchFPLPicks(id, fallbackGw);
          activeGw = fallbackGw;
          break;
        } catch {}
      }
    }

    if (!picksData) {
      throw new Error(`ไม่พบข้อมูลการจัดตัวของทีมนี้ (กรุณาตรวจ Team ID)`);
    }

    const fixtures = await fetchFPLFixtures();
    const activeEvent = bootstrap.events.find((e) => e.id === activeGw) || currentEvent;
    const squadPlayers = buildSquadPlayers(picksData.picks || [], bootstrap, fixtures, activeGw);

    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
        <TeamSaveTracker
          id={id}
          entry={entry}
          picksData={picksData}
          gw={activeGw}
        />

        {/* Action Controls & GW Navigation Bar */}
        <div className="flex items-center justify-between gap-2">
          <TeamActionButtons />

          {/* Gameweek Selector */}
          <div className="flex items-center gap-1 bg-white border border-black/5 rounded-full p-1 shadow-sm">
            {activeGw > 1 ? (
              <Link
                href={`/team/${id}?gw=${activeGw - 1}`}
                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition"
                title="GW ก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
            ) : (
              <span className="p-1.5 text-gray-300 cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </span>
            )}

            <span className="text-xs sm:text-sm font-black text-[#111318] px-2.5">
              GW {activeGw}
            </span>

            {activeGw < 38 ? (
              <Link
                href={`/team/${id}?gw=${activeGw + 1}`}
                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition"
                title="GW ถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <span className="p-1.5 text-gray-300 cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
              </span>
            )}
          </div>
        </div>

        {/* 1. Today Safe / Price Alert Header on top of Pitch with Team Name, ID, Manager Name, GW */}
        <TeamPitchTopBar
          entry={entry}
          gameweek={activeGw}
          players={squadPlayers}
        />

        {/* 2. Football Pitch View */}
        <div>
          <FootballPitch players={squadPlayers} />
        </div>

        {/* 3. Detailed Price Alert Banner if any alerts */}
        <PriceAlertBanner players={squadPlayers} />

        {/* 4. Team Overview Header & Stats (แต้ม GW นี้, แต้มสะสม, อันดับโลก อยู่ด้านล่าง) */}
        <TeamHeader entry={entry} picksData={picksData} currentEvent={activeEvent} />

        {/* 5. Private Leagues Card (ข้อมูล Private Leagues ที่บันทึกใน Firebase) */}
        <PrivateLeaguesCard leagues={(entry as any).leagues?.classic || []} />
      </div>
    );
  } catch (err: any) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-4xl bg-white border border-rose-200 shadow-xl">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-[#111318] mb-2">ไม่พบข้อมูลทีม</h2>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">
            {err.message || `ไม่พบข้อมูลสำหรับ FPL Team ID: ${id} กรุณาตรวจสอบหมายเลขทีมอีกครั้ง`}
          </p>
          <Link
            href="/?switch=true"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#111318] text-white font-black text-xs hover:scale-105 transition-transform shadow-md"
          >
            <Search className="w-4 h-4" />
            <span>กลับไปหน้าค้นหา Team ID</span>
          </Link>
        </div>
      </div>
    );
  }
}
