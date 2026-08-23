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
import { AlertCircle, ChevronLeft, ChevronRight, Search, Shield, RefreshCw } from 'lucide-react';

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

  let bootstrap;
  let entry;
  let picksData;
  let fixtures;
  let errorMessage = '';

  try {
    // 1. Fetch bootstrap static data
    bootstrap = await fetchFPLBootstrap();
    
    // 2. Fetch entry/user info
    entry = await fetchFPLEntry(id);

    // 3. Determine gameweek
    const currentEvent =
      bootstrap.events.find((e) => e.is_current) ||
      bootstrap.events.find((e) => e.is_next) ||
      bootstrap.events[0];

    const targetGw = queryGw ? parseInt(queryGw) : (entry.current_event || currentEvent.id);

    // 4. Fetch picks & fixtures in parallel
    [picksData, fixtures] = await Promise.all([
      fetchFPLPicks(id, targetGw),
      fetchFPLFixtures(),
    ]);

    const activeEvent = bootstrap.events.find((e) => e.id === targetGw) || currentEvent;
    const squadPlayers = buildSquadPlayers(picksData.picks, bootstrap, fixtures, targetGw);

    return (
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <TeamSaveTracker
          id={id}
          name={entry.name}
          managerName={`${entry.player_first_name} ${entry.player_last_name}`}
        />

        {/* Back and GW Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-gray-400 hover:text-fpl-green transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>ค้นหาทีมอื่น</span>
          </Link>

          {/* Gameweek Selector */}
          <div className="flex items-center gap-2 bg-purple-950/80 border border-purple-800 rounded-xl p-1 shadow-inner">
            {targetGw > 1 ? (
              <Link
                href={`/team/${id}?gw=${targetGw - 1}`}
                className="p-1.5 hover:bg-purple-900 rounded-lg text-gray-300 hover:text-white transition"
                title="GW ก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
            ) : (
              <span className="p-1.5 text-gray-600 cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </span>
            )}

            <span className="text-xs sm:text-sm font-black text-white px-2">
              Gameweek {targetGw}
            </span>

            {targetGw < 38 ? (
              <Link
                href={`/team/${id}?gw=${targetGw + 1}`}
                className="p-1.5 hover:bg-purple-900 rounded-lg text-gray-300 hover:text-white transition"
                title="GW ถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <span className="p-1.5 text-gray-600 cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
              </span>
            )}
          </div>
        </div>

        {/* Team Overview Header */}
        <TeamHeader entry={entry} picksData={picksData} currentEvent={activeEvent} />

        {/* Price Alerts Radar for this Squad */}
        <PriceAlertBanner players={squadPlayers} />

        {/* Football Pitch View */}
        <div className="mt-4">
          <FootballPitch players={squadPlayers} />
        </div>
      </div>
    );
  } catch (err: any) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="p-8 rounded-3xl bg-purple-950/80 border border-rose-800/80 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-950/80 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-800">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">ไม่สามารถดึงข้อมูลทีมได้</h2>
          <p className="text-sm text-gray-300 mb-6">
            {err.message || `ไม่พบข้อมูลสำหรับ FPL Team ID: ${id} กรุณาตรวจสอบหมายเลขทีมอีกครั้ง`}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-fpl-green to-emerald-400 text-fpl-purple font-black text-sm hover:scale-105 transition-transform shadow-lg"
          >
            <Search className="w-4 h-4" />
            <span>กลับไปหน้าค้นหา Team ID</span>
          </Link>
        </div>
      </div>
    );
  }
}
