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
import TeamHeader from '@/components/team/TeamHeader';
import FootballPitch from '@/components/pitch/FootballPitch';
import PriceAlertBanner from '@/components/prices/PriceAlertBanner';
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

    const targetGw = queryGw ? parseInt(queryGw) : (entry.current_event || currentEvent.id);

    const [picksData, fixtures] = await Promise.all([
      fetchFPLPicks(id, targetGw),
      fetchFPLFixtures(),
    ]);

    const activeEvent = bootstrap.events.find((e) => e.id === targetGw) || currentEvent;
    const squadPlayers = buildSquadPlayers(picksData.picks, bootstrap, fixtures, targetGw);

    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
        <TeamSaveTracker
          id={id}
          name={entry.name}
          managerName={`${entry.player_first_name} ${entry.player_last_name}`}
        />

        {/* Action Controls & GW Navigation Bar */}
        <div className="flex items-center justify-between gap-2">
          <TeamActionButtons />

          {/* Gameweek Selector */}
          <div className="flex items-center gap-1 bg-white border border-black/5 rounded-full p-1 shadow-sm">
            {targetGw > 1 ? (
              <Link
                href={`/team/${id}?gw=${targetGw - 1}`}
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
              GW {targetGw}
            </span>

            {targetGw < 38 ? (
              <Link
                href={`/team/${id}?gw=${targetGw + 1}`}
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

        {/* 1. Football Pitch View FIRST (รูปแผนการเล่นและผังสนามขึ้นมาก่อน) */}
        <div>
          <FootballPitch players={squadPlayers} />
        </div>

        {/* 2. Price Alerts Radar for this Squad */}
        <PriceAlertBanner players={squadPlayers} />

        {/* 3. Team Overview Header & Stats (แต้ม GW นี้, แต้มสะสม, อันดับโลก อยู่ด้านล่าง) */}
        <TeamHeader entry={entry} picksData={picksData} currentEvent={activeEvent} />
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
          <p className="text-xs text-gray-500 mb-6">
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
