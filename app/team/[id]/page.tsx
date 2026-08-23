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
import PrivateLeaguesCard from '@/components/team/PrivateLeaguesCard';
import TeamGameweekScroll from '@/components/team/TeamGameweekScroll';
import TeamSaveTracker from './TeamSaveTracker';
import { AlertCircle, Search } from 'lucide-react';

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

    const currentGwNum = currentEvent?.id || 1;
    const parsedGw = queryGw ? parseInt(queryGw, 10) : NaN;
    const initialGw =
      Number.isFinite(parsedGw) && parsedGw >= 1 && parsedGw <= 38
        ? parsedGw
        : entry.current_event || currentGwNum;

    let activeGw = initialGw;
    let picksData: FPLPicksResponse | null = null;

    // Try fetching the requested GW, fallback to previous GWs if deadline not passed yet
    try {
      picksData = await fetchFPLPicks(id, activeGw);
    } catch {
      // Walk back a few gameweeks for a squad — enough to cover a deadline that
      // has not passed yet. Scanning all 38 meant up to 37 blocking requests.
      const floor = Math.max(1, activeGw - 3);
      for (let fallbackGw = activeGw - 1; fallbackGw >= floor; fallbackGw--) {
        try {
          picksData = await fetchFPLPicks(id, fallbackGw);
          activeGw = fallbackGw;
          break;
        } catch {}
      }
    }

    if (!picksData) {
      throw new Error(`Unable to find squad lineup for this team (Please check Team ID)`);
    }

    const fixtures = await fetchFPLFixtures();
    const activeEvent = bootstrap.events.find((e) => e.id === activeGw) || currentEvent;
    const squadPlayers = buildSquadPlayers(picksData.picks || [], bootstrap, fixtures, activeGw);

    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        <TeamSaveTracker
          id={id}
          entry={entry}
          picksData={picksData}
          gw={activeGw}
        />

        {/* 1. Top Blue Hero Card: Market, Change Team, Telegram, Avatar, Team Name, Today Safe beside name */}
        <TeamPitchTopBar
          entry={entry}
          gameweek={activeGw}
          players={squadPlayers}
          activeChip={picksData?.active_chip}
        />

        {/* 2. Gameweek switcher — the page already honoured ?gw=, but nothing
            in the UI ever linked to it. */}
        <TeamGameweekScroll teamId={id} activeGw={activeGw} currentGw={currentGwNum} />

        {/* 3. Football Pitch View */}
        <div>
          <FootballPitch players={squadPlayers} />
        </div>

        {/* 4. Team Overview Header & Stats */}
        <TeamHeader entry={entry} picksData={picksData} currentEvent={activeEvent} />

        {/* 5. Private Leagues Card */}
        <PrivateLeaguesCard
          leagues={(entry as any).leagues?.classic || []}
          currentTeamId={id}
          currentGw={activeGw}
        />
      </div>
    );
  } catch (err: any) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-4xl bg-white border border-rose-200 shadow-xl">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-[#111318] mb-2">Team Not Found</h2>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">
            {err.message || `No data found for FPL Team ID: ${id}. Please verify the number.`}
          </p>
          <Link
            href="/?switch=true"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#111318] text-white font-black text-xs hover:scale-105 transition-transform shadow-md"
          >
            <Search className="w-4 h-4" />
            <span>Search Another Team ID</span>
          </Link>
        </div>
      </div>
    );
  }
}
