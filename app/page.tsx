'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import {
  Trophy,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  Minus,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
} from 'lucide-react';
import PlayerJersey from '@/components/pitch/PlayerJersey';
import Modal from '@/components/ui/Modal';

function HistoryView() {
  const { savedTeamId, setSavedTeamId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Team & History State
  const [entryData, setEntryData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any>(null);
  const [transfersData, setTransfersData] = useState<any[]>([]);
  const [bootstrapData, setBootstrapData] = useState<any>(null);
  const [selectedGw, setSelectedGw] = useState<number>(0);
  const [gwPicks, setGwPicks] = useState<any[]>([]);
  const [gwPicksLoading, setGwPicksLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Team Setup Modal State
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [newTeamInput, setNewTeamInput] = useState('');
  const [previewNewEntry, setPreviewNewEntry] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Change-team controls arrive as /?switch=true. Consume the flag straight
  // away — leaving it in the URL made the dialog reappear on every refresh or
  // back-navigation, which read as "it pops up every time".
  useEffect(() => {
    if (searchParams.get('switch') !== 'true') return;
    setIsSetupModalOpen(true);
    router.replace('/', { scroll: false });
  }, [searchParams, router]);

  // Load Team Data & History
  useEffect(() => {
    if (!savedTeamId) {
      setLoading(false);
      setIsSetupModalOpen(true);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const [entryRes, bootstrapRes] = await Promise.all([
          fetch(`/api/fpl/entry/${savedTeamId}`, { signal: ac.signal }),
          fetch('/api/fpl/bootstrap', { signal: ac.signal }),
        ]);

        if (!entryRes.ok) {
          const body = await entryRes.json().catch(() => ({}));
          throw new Error(body.error || `Team ID ${savedTeamId} was not found`);
        }

        const entry = await entryRes.json();
        const bootstrap = bootstrapRes.ok ? await bootstrapRes.json() : null;

        setEntryData(entry);
        setBootstrapData(bootstrap);

        const curEvent =
          bootstrap?.events?.find((e: any) => e.is_current) ||
          bootstrap?.events?.find((e: any) => e.is_next) ||
          bootstrap?.events?.[0];
        setSelectedGw(entry?.current_event || curEvent?.id || 1);

        // History & transfers go through our own routes: the FPL API sends no
        // CORS headers, so calling it straight from the browser always fails.
        const [hist, trans] = await Promise.all([
          fetch(`/api/fpl/history/${savedTeamId}`, { signal: ac.signal }).then((r) =>
            r.ok ? r.json() : null
          ),
          fetch(`/api/fpl/transfers/${savedTeamId}`, { signal: ac.signal }).then((r) =>
            r.ok ? r.json() : []
          ),
        ]);

        setHistoryData(hist);
        setTransfersData(Array.isArray(trans) ? trans : []);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setLoadError(err.message || 'Could not load this team');
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [savedTeamId]);

  // Load Picks whenever selectedGw changes. Aborting keeps a slow response for
  // an old gameweek from landing on top of a newer one.
  useEffect(() => {
    if (!savedTeamId || !selectedGw) return;

    const ac = new AbortController();
    setGwPicksLoading(true);

    fetch(`/api/fpl/picks/${savedTeamId}/${selectedGw}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setGwPicks(data?.picks || []))
      .catch((err) => {
        if (err.name !== 'AbortError') setGwPicks([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setGwPicksLoading(false);
      });

    return () => ac.abort();
  }, [savedTeamId, selectedGw]);

  // Preview new team before confirmation
  const handleCheckNewTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamInput.trim()) return;

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewNewEntry(null);

    try {
      const res = await fetch(`/api/fpl/entry/${newTeamInput.trim()}`);
      // Only a 404 means the ID is wrong. Anything else is FPL being
      // unavailable, and telling someone their ID is bad sends them to fix
      // something that was never broken.
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? 'Team ID not found in FPL system'
            : 'FPL is not responding right now — try again in a moment'
        );
      }
      const data = await res.json();
      setPreviewNewEntry(data);
    } catch (err: any) {
      setPreviewError(err.message || 'Unable to load team info');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Confirm Team Switch
  const handleConfirmSwitch = () => {
    if (previewNewEntry) {
      const newId = String(previewNewEntry.id);
      setSavedTeamId(newId);
      setIsSetupModalOpen(false);
      setPreviewNewEntry(null);
      setNewTeamInput('');
      router.push(`/team/${newId}/live`);
    }
  };

  // Find stats for currently selected GW
  const currentGwStats = historyData?.current?.find((h: any) => h.event === selectedGw);
  /**
   * Two different questions, which used to share one variable.
   *
   * `latestScoredGw` is the last gameweek that HAS points — FPL's own
   * `current_event`, which stays at 1 until the GW2 deadline passes. It is the
   * ceiling on what can be selected: `currentGwStats` looks the selection up in
   * `history.current[]`, and a gameweek with no entry there renders empty cards.
   *
   * `activeGw` is the gameweek being played or about to be, which is what
   * "Current" means to a reader and what the official site shows. Once GW1 is
   * finished that is GW2, even though GW1 is still the last one with points.
   */
  const latestScoredGw = entryData?.current_event || selectedGw || 1;
  const activeGw =
    bootstrapData?.events?.find((e: any) => e.is_current && !e.finished)?.id ||
    bootstrapData?.events?.find((e: any) => e.is_next)?.id ||
    latestScoredGw;

  // Memoised: rebuilding these from ~700 players on every keystroke was wasteful
  const elementMap = useMemo(
    () => new Map<number, any>((bootstrapData?.elements ?? []).map((el: any) => [el.id, el])),
    [bootstrapData]
  );
  const teamMap = useMemo(
    () => new Map<number, any>((bootstrapData?.teams ?? []).map((t: any) => [t.id, t])),
    [bootstrapData]
  );

  const starters = gwPicks.filter((p) => p.position <= 11);
  const bench = gwPicks.filter((p) => p.position > 11);

  // Transfers for this GW
  const gwTransfers = transfersData.filter((t) => t.event === selectedGw);

  // Every league, invitational ones first — those are the ones with people you
  // know in them. FPL only ever returns 'x' (invitational) and 's' (enrolled).
  const allLeagues = useMemo(() => {
    const classic = (entryData as any)?.leagues?.classic ?? [];
    return [...classic].sort((a: any, b: any) => {
      const rank = (l: any) => (l.league_type === 'x' ? 0 : 1);
      return rank(a) - rank(b);
    });
  }, [entryData]);

  // `loading` used to be tracked but never rendered: users saw a fully-formed
  // page with "-" in every tile while requests were still in flight.
  if (loading && savedTeamId) {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        <div className="h-32 rounded-3xl bg-amber-100/70 animate-pulse" />
        <div className="h-16 rounded-3xl bg-gray-200/70 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-200/70 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-3xl bg-gray-200/50 animate-pulse" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-4xl bg-white border border-rose-200 shadow-xl">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-[#111318] mb-2">Could not load your team</h2>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">{loadError}</p>
          <button
            onClick={() => setIsSetupModalOpen(true)}
            type="button"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#111318] text-white font-black text-xs hover:scale-105 transition-transform shadow-md"
          >
            <Search className="w-4 h-4" />
            <span>Use a different Team ID</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      {/* 1. Dark Yellow / Amber Top Banner */}
      <div className="rounded-3xl p-5 sm:p-7 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-xl relative overflow-hidden transition-all">
        <div className="flex flex-row items-center justify-between gap-3 sm:gap-4">
          {/* Avatar + Manager Name + Team Name */}
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden shrink-0 shadow-lg bg-white">
              <Image src="/logo.png" alt="Fanta" width={64} height={64} className="w-full h-full object-cover" />
            </div>

            {/* min-w-0 on every flex ancestor, or truncate below has nothing to
                shrink against and the long name slides under the button. */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <span className="px-3 py-0.5 rounded-full bg-black/30 backdrop-blur-sm text-white text-[11px] font-mono font-black shrink-0 whitespace-nowrap">
                  ID #{entryData?.id || savedTeamId || '-'}
                </span>
                {entryData?.player_region_name && (
                  <span className="text-xs text-amber-100 font-semibold truncate">
                    • {entryData.player_region_name}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight truncate">
                {entryData?.name || 'My Fantasy Team'}
              </h1>
              <p className="text-xs sm:text-sm text-amber-100 font-semibold truncate">
                {entryData ? `${entryData.player_first_name} ${entryData.player_last_name}` : 'Manager'}
              </p>
            </div>
          </div>

          {/* Team Setup Button */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              onClick={() => {
                setNewTeamInput('');
                setPreviewNewEntry(null);
                setPreviewError(null);
                setIsSetupModalOpen(true);
              }}
              type="button"
              className="px-3 py-2 sm:px-5 sm:py-2.5 rounded-full bg-white text-[#111318] hover:bg-amber-50 font-black text-[11px] sm:text-sm shadow-md transition active:scale-95 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 stroke-[2.5] shrink-0" />
              <span>Team Setup</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Gameweek Horizontal Capsule Scroll Bar */}
      <div className="pastel-card p-2.5 sm:p-3 shadow-sm flex items-center overflow-x-auto gap-2 scrollbar-none">
        {Array.from({ length: 38 }, (_, i) => i + 1).map((gw) => {
          const isSelected = gw === selectedGw;
          const isFinished = gw <= latestScoredGw;

          return (
            <button
              key={gw}
              onClick={() => setSelectedGw(gw)}
              type="button"
              className={`flex-shrink-0 min-w-[65px] text-center py-2 px-2 rounded-full text-xs transition active:scale-95 ${
                isSelected
                  ? 'bg-[#38003c] text-white font-black shadow-md ring-2 ring-purple-300'
                  : isFinished
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold border border-amber-200'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-400 font-medium'
              }`}
            >
              <span className="block text-[8px] uppercase opacity-75">
                {gw === activeGw ? 'Current' : isFinished ? 'Done' : 'Upcoming'}
              </span>
              <span className="text-xs font-black">GW {gw}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Gameweek History Detailed Content */}
      <div className="space-y-4">
        {/* GW Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="pastel-card p-4 text-center">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">GW {selectedGw} Pts</span>
            <span className="text-2xl font-black text-[#38003c]">
              {currentGwStats?.points ?? '-'}
            </span>
          </div>

          <div className="pastel-card p-4 text-center">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">Total Points</span>
            <span className="text-2xl font-black text-[#111318]">
              {currentGwStats?.total_points ?? '-'}
            </span>
          </div>

          <div className="pastel-card p-4 text-center">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">GW {selectedGw} Rank</span>
            <span className="text-base font-black text-amber-700 truncate block">
              {currentGwStats?.rank ? `#${currentGwStats.rank.toLocaleString()}` : '-'}
            </span>
          </div>

          <div className="pastel-card p-4 text-center">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">Overall Rank</span>
            <span className="text-base font-black text-[#111318] truncate block">
              {currentGwStats?.overall_rank ? `#${currentGwStats.overall_rank.toLocaleString()}` : '-'}
            </span>
          </div>

          <div className="pastel-card p-4 text-center">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">Transfers</span>
            <span className="text-base font-black text-purple-700">
              {currentGwStats ? `${currentGwStats.event_transfers} (${currentGwStats.event_transfers_cost}pt)` : '-'}
            </span>
          </div>

          <div className="pastel-card p-4 text-center">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">Bench Points</span>
            <span className="text-base font-black text-emerald-600">
              {currentGwStats?.points_on_bench ?? '-'} pt
            </span>
          </div>
        </div>

        {/* Squad Lineup in this GW */}
        <div className="pastel-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-[#38003c] flex items-center justify-center font-bold">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#111318]">
                  Squad Lineup (Gameweek {selectedGw})
                </h3>
                <p className="text-xs text-gray-500">Starting XI &amp; Substitutes</p>
              </div>
            </div>
            {gwPicksLoading && <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />}
          </div>

          {gwPicks.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              No squad data available for Gameweek {selectedGw}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Starters Grid */}
              <div>
                <span className="text-xs font-black uppercase text-gray-400 mb-2 block">Starting XI</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {starters.map((p) => {
                    const el = elementMap.get(p.element);
                    const team = teamMap.get(el?.team);

                    return (
                      <div
                        key={p.element}
                        className="p-2.5 rounded-2xl bg-gray-50 border border-black/5 flex items-center gap-2.5"
                      >
                        <PlayerJersey teamCode={el?.team_code || 1} isGkp={el?.element_type === 1} className="w-8 h-8 shrink-0" />
                        <div className="truncate">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs text-[#111318] truncate block">
                              {el?.web_name || `Player #${p.element}`}
                            </span>
                            {p.is_captain && (
                              <span className="px-1.5 py-0.5 bg-[#38003c] text-white text-[9px] font-black rounded-full">
                                C
                              </span>
                            )}
                            {p.is_vice_captain && (
                              <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-full">
                                V
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {team?.short_name || 'CLB'} &bull; £{((el?.now_cost || 50) / 10).toFixed(1)}m
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bench Grid */}
              <div className="pt-2 border-t border-black/5">
                <span className="text-xs font-black uppercase text-gray-400 mb-2 block">Bench</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {bench.map((p, idx) => {
                    const el = elementMap.get(p.element);
                    const team = teamMap.get(el?.team);

                    return (
                      <div
                        key={p.element}
                        className="p-2.5 rounded-2xl bg-gray-50/70 border border-black/5 flex items-center gap-2.5 opacity-90"
                      >
                        <PlayerJersey teamCode={el?.team_code || 1} isGkp={el?.element_type === 1} className="w-8 h-8 shrink-0" />
                        <div className="truncate">
                          <span className="font-bold text-xs text-[#111318] truncate block">
                            {idx === 0 ? 'GK: ' : `Sub ${idx}: `}{el?.web_name || `Player #${p.element}`}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {team?.short_name || 'CLB'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Private Leagues Standings */}
        <div className="pastel-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#111318]">Leagues</h3>
                <p className="text-xs text-gray-500">
                  Your position in every league on this team
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {allLeagues.map((league: any) => {
              const rank = league.entry_rank || 1;
              const lastRank = league.entry_last_rank || rank;
              const rankDiff = lastRank - rank;

              return (
                <div
                  key={league.id}
                  className="p-3.5 rounded-2xl bg-gray-50 border border-black/5 flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-xs text-[#111318] truncate">{league.name}</span>
                      {league.league_type === 'x' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black shrink-0">
                          PRIVATE
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">ID: {league.id}</span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-[#38003c] block">Rank #{rank}</span>
                    <div className="flex items-center justify-end gap-1 text-[10px] font-bold">
                      {rankDiff > 0 ? (
                        <span className="text-emerald-600 flex items-center font-black">
                          <ArrowUp className="w-2.5 h-2.5" /> +{rankDiff}
                        </span>
                      ) : rankDiff < 0 ? (
                        <span className="text-rose-600 flex items-center font-black">
                          <ArrowDown className="w-2.5 h-2.5" /> {rankDiff}
                        </span>
                      ) : (
                        <span className="text-gray-400 flex items-center font-medium">
                          <Minus className="w-2.5 h-2.5" /> Same
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transfers in this Gameweek */}
        {gwTransfers.length > 0 && (
          <div className="pastel-card p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/5">
              <ArrowRightLeft className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-black text-[#111318]">
                Gameweek {selectedGw} Transfers ({gwTransfers.length})
              </h3>
            </div>
            <div className="space-y-2">
              {gwTransfers.map((t: any, idx: number) => {
                const elIn = elementMap.get(t.element_in);
                const elOut = elementMap.get(t.element_out);

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-gray-50 border border-black/5 flex items-center justify-between text-xs font-bold"
                  >
                    <div className="flex items-center gap-2 text-emerald-700">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">IN</span>
                      <span>{elIn?.web_name || `Player #${t.element_in}`}</span>
                      <span className="text-gray-400 font-mono text-[11px]">£{(t.element_in_cost / 10).toFixed(1)}m</span>
                    </div>

                    <div className="flex items-center gap-2 text-rose-700">
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px]">OUT</span>
                      <span>{elOut?.web_name || `Player #${t.element_out}`}</span>
                      <span className="text-gray-400 font-mono text-[11px]">£{(t.element_out_cost / 10).toFixed(1)}m</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Team Setup Modal with Confirmation */}
      <Modal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        labelledBy="team-setup-title"
        className="max-w-md"
      >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h2 id="team-setup-title" className="text-xl font-black text-[#111318]">Team Setup</h2>
                <p className="text-xs text-gray-500">Enter a new FPL Team ID to track</p>
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleCheckNewTeam} className="space-y-3 mb-4">
              <div className="relative">
                <input
                  type="number"
                  value={newTeamInput}
                  onChange={(e) => setNewTeamInput(e.target.value)}
                  placeholder="Enter FPL Team ID (e.g. 12345)..."
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-black/10 rounded-full text-base font-bold text-[#111318] focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              </div>

              {previewError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{previewError}</span>
                </div>
              )}

              {!previewNewEntry && (
                <button
                  type="submit"
                  disabled={previewLoading}
                  className="w-full py-3 bg-[#111318] text-white font-black text-xs rounded-full shadow-md hover:opacity-90 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Find Team'}
                </button>
              )}
            </form>

            {/* Confirmation Box when team is found */}
            {previewNewEntry && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 mb-4 animate-fadeIn">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>New team found! Confirm switch:</span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-amber-200/80 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Current Team:</span>
                    <span className="font-bold text-[#111318]">#{savedTeamId || '-'} ({entryData?.name || '-'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">New Team:</span>
                    <span className="font-black text-[#38003c]">#{previewNewEntry.id} ({previewNewEntry.name})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Manager:</span>
                    <span className="font-bold text-gray-700">{previewNewEntry.player_first_name} {previewNewEntry.player_last_name}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmSwitch}
                    type="button"
                    className="flex-1 py-2.5 bg-[#38003c] text-white font-black text-xs rounded-full shadow-md active:scale-95 transition"
                  >
                    Confirm Switch
                  </button>
                  <button
                    onClick={() => setPreviewNewEntry(null)}
                    type="button"
                    className="px-4 py-2.5 bg-gray-200 text-gray-700 font-bold text-xs rounded-full transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
        )}
      </Modal>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-16 flex justify-center">
          <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
        </div>
      }
    >
      <HistoryView />
    </Suspense>
  );
}
