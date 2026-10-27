'use client';

import React from 'react';
import Link from 'next/link';
import Logo from '../Logo';
import { FPLEntry, PriceStatus, TeamSquadPlayer } from '@/lib/types';
import { CheckCircle2, History, Star, TrendingUp } from 'lucide-react';
import { STATUS_META } from '../prices/status-meta';
import { rememberGwOffset } from '@/lib/gw-preference';

interface TeamPitchTopBarProps {
  entry: FPLEntry;
  gameweek: number;
  /** Gameweek the fixture strip is showing; may run ahead of the squad's. */
  fixtureGw?: number;
  players: TeamSquadPlayer[];
  /** The gameweek being played, which runs ahead of the squad's once one ends. */
  liveGw?: number;
  /** Watchlist players that are moving — name, club and direction. */
  watchMovers?: { name: string; club: string; status: PriceStatus }[];
  activeChip?: string | null;
}

export default function TeamPitchTopBar({
  entry,
  gameweek,
  fixtureGw,
  players,
  liveGw,
  watchMovers = [],
  activeChip,
}: TeamPitchTopBarProps) {
  const shownGw = fixtureGw ?? gameweek;
  // Offer the week being played and the one after it. Basing the chips on the
  // squad's own gameweek left them pointing at a week that had already ended.
  const baseGw = liveGw ?? gameweek;

  // Price risk calculation
  const criticalFallers = players.filter((p) => p.priceAnalysis.status === 'falling_soon');
  const likelyFallers = players.filter((p) => p.priceAnalysis.status === 'likely_faller');
  
  const criticalRisers = players.filter((p) => p.priceAnalysis.status === 'rising_soon');
  const likelyRisers = players.filter((p) => p.priceAnalysis.status === 'likely_riser');

  const totalCritical = criticalFallers.length + criticalRisers.length;
  const totalLikely = likelyFallers.length + likelyRisers.length;

  /**
   * Badges, split by direction.
   *
   * This used to be a single rose-red "N Players at Risk!" with a downward
   * arrow, shown even when every one of those players was about to RISE — which
   * puts your team value up and is good news. Direction now decides the colour,
   * the icon and the verb.
   *
   * The "tonight" tier leads; the trending tier is the fallback. A player only
   * reaches 100% of the threshold on the night itself, by which point it is
   * usually too late to act, so the 50-99% band has to stay visible.
   */
  const badges = (
    totalCritical > 0
      ? [
          { count: criticalRisers.length, status: 'rising_soon' as const, tone: 'rise' as const },
          { count: criticalFallers.length, status: 'falling_soon' as const, tone: 'fall' as const },
        ]
      : [
          { count: likelyRisers.length, status: 'likely_riser' as const, tone: 'rise' as const },
          { count: likelyFallers.length, status: 'likely_faller' as const, tone: 'fall' as const },
        ]
  ).filter((b) => b.count > 0);

  /**
   * Who is actually moving.
   *
   * The badges give a number and nothing else, which tells you something is
   * happening without telling you to whom — and on the page where you would act
   * on it. Squad and watchlist together, marked apart by the star already used
   * for the watchlist elsewhere.
   */
  const movers = [
    ...players
      .filter((p) => p.priceAnalysis.status !== 'stable')
      .map((p) => ({
        name: p.element.web_name,
        club: p.team.short_name,
        status: p.priceAnalysis.status,
        watched: false,
      })),
    ...watchMovers.map((w) => ({ ...w, watched: true })),
  ]
    // Tonight before trending, rises before falls, so the urgent names lead.
    .sort((a, b) => {
      const rank = (s: PriceStatus) =>
        s === 'rising_soon' ? 0 : s === 'falling_soon' ? 1 : s === 'likely_riser' ? 2 : 3;
      return rank(a.status) - rank(b.status);
    });

  /**
   * Tonight and Trending must not look alike.
   *
   * They were the same solid green in the same shape, one word apart — and the
   * mobile label collapses to "Up", which reads as "rising tonight" however
   * hard you squint. A player at 67% of the threshold is a different statement
   * from one at 101%, so it gets a quieter one: translucent, outlined, no
   * pulse. Only the tonight tier is allowed to shout.
   */
  const badgeTone = (tone: 'rise' | 'fall', critical: boolean) => {
    if (!critical) {
      return tone === 'rise'
        ? 'bg-emerald-600/15 text-emerald-900 border-emerald-700/25 hover:bg-emerald-600/25'
        : 'bg-rose-600/15 text-rose-900 border-rose-700/25 hover:bg-rose-600/25';
    }
    return tone === 'rise'
      ? 'bg-emerald-600 text-white border-white/20 hover:bg-emerald-700 animate-pulse-rise'
      : 'bg-rose-600 text-white border-white/20 hover:bg-rose-700 animate-pulse-fall';
  };

  return (
    <>
      <div className="pastel-card p-4 sm:p-5 mb-4 relative overflow-hidden text-[var(--text)]">
        {/* Row 1: Left (ID, GW, Region) & Right (Market Icon + Change Team Icon + Telegram Icon attached to right edge) */}
        <div className="flex items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-[var(--line)]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-3 py-1 rounded-full bg-[var(--text)] text-white text-[11px] font-semibold font-mono">
              ID #{entry.id}
            </span>
            {/* Two plain chips: the squad's gameweek, and the next one to
                preview fixtures for. No arrows — they implied paging through
                gameweeks, which is not what this does. */}
            {[baseGw, baseGw + 1].filter((gw) => gw <= 38).map((gw, offset) => {
              const isShown = gw === shownGw;
              // The named segments, not the numbers behind them. `live` and
              // `next` are the same two URLs every week, so switching chips
              // lands on a page that is already cached and already prefetched —
              // a numbered href would mint a new one every gameweek.
              const href = `/team/${entry.id}/${offset === 1 ? 'next' : 'live'}`;
              const isSquadWeek = gw === gameweek;
              return (
                <Link
                  key={gw}
                  href={href}
                  title={
                    isSquadWeek
                      ? `This squad, gameweek ${gw}`
                      : `Fixtures this squad faces in gameweek ${gw}`
                  }
                  // Recorded on the click, not from `shownGw` in an effect:
                  // arriving on a ?gw= link someone shared is not the viewer
                  // choosing that week, and should not overwrite what they did.
                  onClick={() => rememberGwOffset(offset === 1 ? 1 : 0)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition active:scale-95 ${
                    isShown
                      ? 'bg-[var(--text)] text-white'
                      : 'bg-gray-100 text-[var(--text)] hover:bg-gray-200'
                  }`}
                >
                  GW {gw}
                </Link>
              );
            })}
            {entry.player_region_name && (
              <span className="text-[11px] text-[var(--text)]/70 font-semibold hidden sm:inline ml-1">
                • {entry.player_region_name}
              </span>
            )}
          </div>

          {/* Market and History. Changing team lives on History, and the alert
              settings moved to the navbar, so neither needs a slot here. */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/prices"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--muted)] hidden md:flex items-center justify-center transition active:scale-95"
              title="Market prices"
              aria-label="Market prices"
            >
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[1.75]" />
            </Link>

            <Link
              href="/"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--muted)] hidden md:flex items-center justify-center transition active:scale-95"
              title="History"
              aria-label="History"
            >
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[1.75]" />
            </Link>
          </div>
        </div>

        {/* Row 2: Left (Avatar + Names) & Right (Today Safe aligned to right edge) */}
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Logo className="w-11 h-11 sm:w-12 sm:h-12 shrink-0" />

            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[var(--text)] tracking-tight leading-tight truncate">
                {entry.name}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text)]/80 font-semibold mt-0.5 leading-snug">
                {entry.player_first_name} {entry.player_last_name}
              </p>
            </div>
          </div>

          {/* Right Edge: Today Safe with Live Pulse */}
          <div className="shrink-0 flex items-center gap-2">
            {badges.length === 0 ? (
              <div className="relative overflow-hidden px-3.5 sm:px-5 py-2.5 sm:py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 border border-white/20">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-100 opacity-85"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
                <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                <span className="whitespace-nowrap">Today Safe</span>
              </div>
            ) : (
              badges.map((badge) => {
                const meta = STATUS_META[badge.status];
                return (
                  <Link
                    key={badge.status}
                    href="/prices"
                    className={`relative overflow-hidden px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition active:scale-95 flex items-center gap-1.5 border ${
                      ''
                    } ${badgeTone(badge.tone, totalCritical > 0)}`}
                    title={`${badge.count} ${meta.label}`}
                  >
                    <meta.Icon
                      className={`w-4 h-4 stroke-[3] shrink-0 ${
                        badge.status === 'falling_soon' ? 'rotate-[135deg]' : ''
                      }`}
                    />
                    <span className="whitespace-nowrap">
                      {badge.count}{' '}
                      <span className="hidden sm:inline">{meta.label}</span>
                      <span className="sm:hidden">{meta.short}</span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {movers.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-[var(--line)] flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {movers.map((m) => {
              const meta = STATUS_META[m.status];
              const up = m.status === 'rising_soon' || m.status === 'likely_riser';
              return (
                <span
                  key={`${m.name}-${m.club}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text)]"
                  title={`${m.name} — ${meta.label}${m.watched ? ' (watchlist)' : ''}`}
                >
                  <meta.Icon
                    className={`w-3 h-3 shrink-0 ${up ? 'text-emerald-700' : 'text-rose-700'} ${
                      m.status === 'falling_soon' ? 'rotate-[135deg]' : ''
                    }`}
                  />
                  <span className={up ? 'text-emerald-800' : 'text-rose-800'}>{m.name}</span>
                  <span className="text-[var(--text)]/45 font-semibold">{m.club}</span>
                  {m.watched && <Star className="w-2.5 h-2.5 text-pink-600 fill-current" />}
                </span>
              );
            })}
          </div>
        )}
      </div>

    </>
  );
}
