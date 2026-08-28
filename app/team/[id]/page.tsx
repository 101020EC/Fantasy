import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  fetchFPLBootstrap,
  fetchFPLEntry,
  fetchFPLPicks,
  fetchFPLFixtures,
  fetchFPLTransfers,
  buildSquadPlayers,
} from '@/lib/fpl-api';
import { FPLPicksResponse } from '@/lib/types';
import TeamHeader from '@/components/team/TeamHeader';
import FootballPitch from '@/components/pitch/FootballPitch';
import TeamPitchTopBar from '@/components/pitch/TeamPitchTopBar';
import PrivateLeaguesCard from '@/components/team/PrivateLeaguesCard';
import GlobalLeaguesCard from '@/components/team/GlobalLeaguesCard';
import TeamSaveTracker from './TeamSaveTracker';
import { AlertCircle, Search } from 'lucide-react';
import { seasonKey } from '@/lib/analyst';
import { readWatchlist } from '@/lib/watchlist';
import { analyzePlayerPrice } from '@/lib/price-calculator';
import { loadPriceContext } from '@/lib/price-changes-store';
import { FplError, stalest } from '@/lib/fpl-resilience';
import { FplUnavailable, StaleNotice } from '@/components/system/UpstreamNotice';

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

    // The gameweek being PLAYED, as opposed to the one the squad is stored
    // under. FPL keeps `is_current` on a finished gameweek until the next
    // deadline, so reading it alone left the chips offering a week that had
    // already ended.
    const liveGw =
      bootstrap.events.find((e) => e.is_current && !e.finished)?.id ||
      bootstrap.events.find((e) => e.is_next)?.id ||
      currentGwNum;
    const parsedGw = queryGw ? parseInt(queryGw, 10) : NaN;
    // Open on the gameweek being played, not the last one with points. The
    // chips offer `liveGw` and the one after it, so defaulting to the scored
    // week left the page sitting on a gameweek the chips no longer showed —
    // and therefore with no chip highlighted at all.
    const initialGw =
      Number.isFinite(parsedGw) && parsedGw >= 1 && parsedGw <= 38 ? parsedGw : liveGw;

    // Which gameweek's fixtures to show. A future gameweek has no squad yet —
    // its deadline has not passed — so the squad falls back while the fixture
    // view still honours the request. Pressing "GW n+1" is asking who this
    // squad plays next, not for a squad that does not exist.
    const fixtureGw = initialGw;

    // Start from the last gameweek that actually has picks. Asking for the
    // upcoming one first would spend a guaranteed 404 on every page load, since
    // its deadline has not passed; the walk-back below stays for the cases the
    // entry itself is behind.
    let activeGw = Math.min(initialGw, entry.current_event || initialGw);
    let picksData: FPLPicksResponse | null = null;

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

    // Transfers give the purchase price behind every squad value. Fetched
    // alongside fixtures rather than after them: it is one more request on a
    // page that already makes several, and it must not add a serial hop.
    const [fixtures, transfers] = await Promise.all([
      fetchFPLFixtures(),
      fetchFPLTransfers(id).catch((): any[] => []),
    ]);
    const activeEvent = bootstrap.events.find((e) => e.id === activeGw) || currentEvent;
    // The requested gameweek runs ahead of the squad's when its deadline has
    // not passed — there is no squad or points for it yet, only fixtures.
    const isPreview = fixtureGw > activeGw;
    // Same price context the market page uses, so a player cannot read
    // "Rising Tonight" on one page and "Trending Up" on the other.
    const priceContext = await loadPriceContext(seasonKey(bootstrap)).catch(() => ({}));

    // Watchlisted players move too, and this is the page you would act on it
    // from. One small document.
    const watchIds = await readWatchlist(id).catch((): number[] => []);
    const squadPlayers = buildSquadPlayers(
      picksData.picks || [],
      bootstrap,
      fixtures,
      fixtureGw,
      priceContext
    );

    // Watchlisted players that are moving, resolved to names. A count alone
    // told you something was happening without telling you to whom, and the
    // watchlist was not consulted here at all.
    const squadIds = new Set(squadPlayers.map((p) => p.element.id));
    const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));
    const watchMovers = watchIds
      .filter((wid) => !squadIds.has(wid))
      .map((wid) => bootstrap.elements.find((el) => el.id === wid))
      .filter((el): el is NonNullable<typeof el> => Boolean(el))
      .map((el) => ({
        name: el.web_name,
        club: teamMap.get(el.team)?.short_name ?? '',
        status: analyzePlayerPrice(el, bootstrap, priceContext).status,
      }))
      .filter((p) => p.status !== 'stable');

    const served = stalest(bootstrap, entry, picksData, fixtures);

    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        {served && <StaleNotice capturedAt={served.capturedAt} />}

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
          fixtureGw={fixtureGw}
          players={squadPlayers}
          liveGw={liveGw}
          watchMovers={watchMovers}
          activeChip={picksData?.active_chip}
        />

        {/* Gameweek switching lives on the History page, which swaps the squad
            in place instead of reloading this route. ?gw= still works for
            direct links. */}

        {/* 2. Football Pitch View */}
        <div>
          <FootballPitch players={squadPlayers} isPreview={isPreview} />
        </div>

        {/* 3. Team Overview Header & Stats */}
        <TeamHeader
          entry={entry}
          picksData={picksData}
          isPreview={isPreview}
          squadGw={activeGw}
          shownGw={fixtureGw}
          elements={bootstrap.elements}
          transfers={transfers}
        />

        {/* 4. Private Leagues Card */}
        <PrivateLeaguesCard
          leagues={(entry as any).leagues?.classic || []}
          currentTeamId={id}
          currentGw={activeGw}
        />

        {/* 5. Leagues FPL enrols you into — rank only, no member table */}
        <GlobalLeaguesCard leagues={(entry as any).leagues?.classic || []} />
      </div>
    );
  } catch (err: any) {
    // An upstream outage is not a missing team. Telling someone to re-check a
    // team ID that was never wrong is the worst thing this page can do, and it
    // is exactly what a single shared error card did during FPL's 403 block.
    if (err instanceof FplError && err.kind === 'unavailable') {
      return <FplUnavailable status={err.status} detail={err.message} />;
    }

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
