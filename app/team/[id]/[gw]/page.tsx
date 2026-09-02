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
import TeamSaveTracker from '../TeamSaveTracker';
import { AlertCircle, Search } from 'lucide-react';
import { seasonKey } from '@/lib/analyst';
import { readWatchlist } from '@/lib/watchlist';
import { analyzePlayerPrice } from '@/lib/price-calculator';
import { FplError, stalest } from '@/lib/fpl-resilience';
import { FplUnavailable, StaleNotice } from '@/components/system/UpstreamNotice';

/**
 * Cached, not rendered per visit.
 *
 * This page used to be `force-dynamic`, which meant `<Link>` could prefetch its
 * `loading.tsx` and nothing else — every click on the Team menu started from
 * zero, which is exactly what "the skeleton sits there" felt like. Two things
 * were forcing that: `cookies()`, and reading `searchParams` for `?gw=`. Both
 * are gone — the gameweek is a path segment now, and the cookie is read by the
 * middleware that rewrites into it.
 *
 * 60 seconds costs nothing in freshness: `fetchFPLEntry` and `fetchFPLPicks`
 * already cache for 60, so the app has always been willing to show numbers up
 * to a minute old. This only moves where that minute is stored. Wanting fresher
 * means lowering those first — lowering it here alone would re-render on a
 * schedule and get the same cached numbers back.
 *
 * Sharing the cache between viewers is correct here: everything on this page is
 * a function of (team id, gameweek), the watchlist included — it is keyed by
 * team, not by viewer.
 */
export const revalidate = 60;

/**
 * Empty on purpose — and required.
 *
 * Nothing is prerendered at build time: there is no list of team ids to build,
 * and every page here is rendered on the first request for it. But a dynamic
 * route with no `generateStaticParams` at all is not merely un-prerendered, it
 * is excluded from the prerender manifest entirely, and `revalidate` above then
 * describes a cache the route never joins. Verified rather than assumed: the
 * build listed this route as `ƒ` with an empty `dynamicRoutes`, and adding this
 * moved it to `●`.
 */
export function generateStaticParams() {
  return [];
}

/** `live` and `next` keep their meaning all season; a number pins one week. */
type GwSegment = string;

interface TeamPageProps {
  params: Promise<{ id: string; gw: GwSegment }>;
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { id, gw: gwSegment } = await params;

  if (!id || isNaN(Number(id))) {
    notFound();
  }

  // A segment that is neither of the two words nor a gameweek is a bad URL, not
  // a gameweek to go looking for.
  const segmentGw = Number(gwSegment);
  const isNamedGw = gwSegment === 'live' || gwSegment === 'next';
  if (!isNamedGw && !(Number.isInteger(segmentGw) && segmentGw >= 1 && segmentGw <= 38)) {
    notFound();
  }

  try {
    // Bootstrap first, and bootstrap alone.
    //
    // It is the only thing the gameweek depends on — `live` and `next` mean
    // nothing until the event list says which week is being played — and
    // `unstable_cache` holds it for 300s, so this is almost never a round trip.
    // Everything else goes in one batch behind it, squad included.
    const bootstrap = await fetchFPLBootstrap();

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

    // `live` and `next` resolve here rather than in the middleware, which has no
    // way to know which week is being played without fetching this same
    // bootstrap on the edge — a round trip on every request, to save one that is
    // already cached.
    const initialGw = isNamedGw
      ? gwSegment === 'next'
        ? Math.min(liveGw + 1, 38)
        : liveGw
      : segmentGw;

    // Which gameweek's fixtures to show. A future gameweek has no squad yet —
    // its deadline has not passed — so the squad falls back while the fixture
    // view still honours the request. Pressing "GW n+1" is asking who this
    // squad plays next, not for a squad that does not exist.
    const fixtureGw = initialGw;

    // The squad joins the batch instead of waiting for it.
    //
    // It used to be awaited after everything else, because `activeGw` clamps to
    // `entry.current_event` — one more serial round trip on a page that had just
    // been cut down to one. But the clamp that actually matters is `liveGw`,
    // which the bootstrap above already gave us: no squad exists past the week
    // being played, so asking for one is the guaranteed 404 the old code was
    // careful to avoid. Clamping here buys the parallelism without it.
    //
    // `entry.current_event` can still be behind — an entry that skipped a week —
    // and the walk-back below covers that, now on the rare path rather than
    // every load.
    const guessGw = Math.min(initialGw, liveGw);

    const [entry, fixtures, transfers, watchIds, guessedPicks] = await Promise.all([
      fetchFPLEntry(id),
      fetchFPLFixtures(),
      // Transfers give the purchase price behind every squad value.
      fetchFPLTransfers(id).catch((): any[] => []),
      // Watchlisted players move too, and this is the page you would act on it
      // from. One small document.
      readWatchlist(id).catch((): number[] => []),
      fetchFPLPicks(id, guessGw).catch((): null => null),
    ]);

    let activeGw = guessGw;
    let picksData: FPLPicksResponse | null = guessedPicks;

    // The guess only misses when the entry is behind the gameweek being played.
    if (!picksData) {
      const from = Math.min(guessGw, entry.current_event || guessGw);
      // Enough to cover a deadline that has not passed yet. Scanning all 38
      // meant up to 37 blocking requests.
      const floor = Math.max(1, from - 3);
      for (let fallbackGw = from; fallbackGw >= floor; fallbackGw--) {
        if (fallbackGw === guessGw) continue;
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

    const activeEvent = bootstrap.events.find((e) => e.id === activeGw) || currentEvent;
    // The requested gameweek runs ahead of the squad's when its deadline has
    // not passed — there is no squad or points for it yet, only fixtures.
    const isPreview = fixtureGw > activeGw;
    const squadPlayers = buildSquadPlayers(
      picksData.picks || [],
      bootstrap,
      fixtures,
      fixtureGw,
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
        status: analyzePlayerPrice(el, bootstrap).status,
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
