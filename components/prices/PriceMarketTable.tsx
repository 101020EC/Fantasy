'use client';

import React, { useMemo, useState } from 'react';
import { PriceAnalysis } from '@/lib/types';
import { ArrowUpDown, Leaf, Rocket, Search, Star, AlertCircle } from 'lucide-react';
import PlayerJersey from '../pitch/PlayerJersey';
import { StatusPill } from './status-meta';
import { useAuth } from '../AuthContext';
import { useMarketContext } from './useMarketContext';

const POSITION_IDS: Record<string, number> = { gkp: 1, def: 2, mid: 3, fwd: 4 };

// Laid out as two columns so each chip sits under the summary card it narrows:
// Trending Up below Rising Tonight, Trending Down below Falling Tonight.
const STATUS_FILTERS = [
  { key: 'critical_risers', label: 'Rising Tonight', active: 'bg-emerald-600 text-white' },
  { key: 'critical_fallers', label: 'Falling Tonight', active: 'bg-rose-600 text-white' },
  { key: 'risers', label: 'Trending Up', active: 'bg-emerald-100 text-emerald-800' },
  { key: 'fallers', label: 'Trending Down', active: 'bg-rose-100 text-rose-800' },
];

const POSITION_FILTERS = [
  { key: 'gkp', label: 'GK' },
  { key: 'def', label: 'DEF' },
  { key: 'mid', label: 'MID' },
  { key: 'fwd', label: 'FWD' },
  { key: 'all', label: 'All' },
];

interface PriceMarketTableProps {
  analyses: PriceAnalysis[];
}

export default function PriceMarketTable({ analyses }: PriceMarketTableProps) {
  const [search, setSearch] = useState('');
  // Status and position are separate so they combine; one shared value meant
  // picking a position silently cleared the status filter.
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<
    'netTransfers' | 'changeScore' | 'currentCost' | 'selectedByPercent'
  >('netTransfers');
  const [sortAsc, setSortAsc] = useState(false);
  const [watchMode, setWatchMode] = useState(false);
  const [watchOnly, setWatchOnly] = useState(false);

  const { savedTeamId } = useAuth();
  const { squadIds, watchIds, watchlistReady, toggleWatch, saveError } =
    useMarketContext(savedTeamId);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();

    return analyses
      .filter((p) => {
        if (q) {
          const matchSearch =
            p.webName.toLowerCase().includes(q) ||
            p.fullName.toLowerCase().includes(q) ||
            p.team.name.toLowerCase().includes(q) ||
            p.team.short_name.toLowerCase().includes(q);
          if (!matchSearch) return false;
        }

        if (statusFilter === 'risers' && !['rising_soon', 'likely_riser'].includes(p.status))
          return false;
        if (statusFilter === 'critical_risers' && p.status !== 'rising_soon') return false;
        if (statusFilter === 'fallers' && !['falling_soon', 'likely_faller'].includes(p.status))
          return false;
        if (statusFilter === 'critical_fallers' && p.status !== 'falling_soon') return false;

        if (positionFilter !== 'all' && p.elementType.id !== POSITION_IDS[positionFilter])
          return false;

        if (watchOnly && !watchIds.has(p.elementId)) return false;

        return true;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (valA === valB) return 0;
        return sortAsc ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
      });
  }, [analyses, search, statusFilter, positionFilter, sortField, sortAsc, watchOnly, watchIds]);

  const visibleRows = filteredData.slice(0, 100);

  const { criticalRisersCount, criticalFallersCount } = useMemo(
    () => ({
      criticalRisersCount: analyses.filter((a) => a.status === 'rising_soon').length,
      criticalFallersCount: analyses.filter((a) => a.status === 'falling_soon').length,
    }),
    [analyses]
  );

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortableHeader = (field: typeof sortField, label: string) => (
    <th
      onClick={() => handleSort(field)}
      className="px-3 py-3.5 text-center cursor-pointer hover:text-[#111318] transition"
    >
      <div className="flex items-center justify-center gap-1">
        <span>{label}</span>
        <ArrowUpDown className="w-3 h-3 text-gray-400" />
      </div>
    </th>
  );

  return (
    <div className="w-full">
      {/* Summary cards — each is also the filter for its own status */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3">
        <button
          onClick={() =>
            setStatusFilter(statusFilter === 'critical_risers' ? 'all' : 'critical_risers')
          }
          className={`p-4 sm:p-5 rounded-3xl text-left transition transform hover:scale-[1.01] active:scale-95 shadow-md flex items-center justify-between ${
            statusFilter === 'critical_risers'
              ? 'bg-emerald-600 text-white ring-4 ring-emerald-300'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-100">
              <Rocket className="w-4 h-4" />
              <span>Rising Tonight</span>
            </div>
            <div className="text-2xl sm:text-4xl font-black mt-1">
              {criticalRisersCount} <span className="text-sm font-normal opacity-90">players</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5 animate-pulse-rise" />
          </div>
        </button>

        <button
          onClick={() =>
            setStatusFilter(statusFilter === 'critical_fallers' ? 'all' : 'critical_fallers')
          }
          className={`p-4 sm:p-5 rounded-3xl text-left transition transform hover:scale-[1.01] active:scale-95 shadow-md flex items-center justify-between ${
            statusFilter === 'critical_fallers'
              ? 'bg-rose-700 text-white ring-4 ring-rose-300'
              : 'bg-rose-600 hover:bg-rose-700 text-white'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-100">
              <Leaf className="w-4 h-4 rotate-[135deg]" />
              <span>Falling Tonight</span>
            </div>
            <div className="text-2xl sm:text-4xl font-black mt-1">
              {criticalFallersCount} <span className="text-sm font-normal opacity-90">players</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Leaf className="w-5 h-5 rotate-[135deg] animate-pulse-fall" />
          </div>
        </button>
      </div>

      {/* Same grid and gap as the summary cards above, and outside the padded
          controls card — otherwise the card's own padding shifts the column
          split and the chips no longer sit under the card they narrow. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        {STATUS_FILTERS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(statusFilter === tab.key ? 'all' : tab.key)}
            className={`px-3 py-2 rounded-full text-xs font-bold transition truncate ${
              statusFilter === tab.key
                ? `${tab.active} shadow-sm ring-1 ring-black/10`
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-black/5 shadow-sm'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and position controls */}
      <div className="pastel-card p-4 sm:p-5 shadow-sm mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player name or club..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-black/5 rounded-full text-base sm:text-xs text-[#111318] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 transition shadow-inner"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          </div>

          <button
            type="button"
            onClick={() => setWatchMode((v) => !v)}
            disabled={!savedTeamId}
            title={
              savedTeamId
                ? 'Add or remove players from your watchlist'
                : 'Pick a team first to use the watchlist'
            }
            className={`shrink-0 px-3.5 py-2.5 rounded-full text-xs font-black transition flex items-center gap-1.5 disabled:opacity-40 ${
              watchMode
                ? 'bg-pink-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-pink-50 hover:text-pink-600'
            }`}
          >
            <Star className={`w-4 h-4 ${watchMode ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">Watchlist</span>
            {watchIds.size > 0 && (
              <span
                className={`px-1.5 rounded-full text-[10px] ${
                  watchMode ? 'bg-white/25' : 'bg-pink-100 text-pink-700'
                }`}
              >
                {watchIds.size}
              </span>
            )}
          </button>
        </div>

        {watchMode && !watchlistReady && savedTeamId && (
          <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              The watchlist needs Firebase configured on the server, otherwise it cannot be saved or
              used for Telegram alerts.
            </span>
          </div>
        )}

        {saveError && (
          <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <span>{saveError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-black/5">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mr-1">
            Position
          </span>
          {watchIds.size > 0 && (
            <button
              type="button"
              onClick={() => setWatchOnly((v) => !v)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition flex items-center gap-1 mr-1 ${
                watchOnly
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'bg-pink-50 text-pink-700 hover:bg-pink-100'
              }`}
            >
              <Star className={`w-3 h-3 ${watchOnly ? 'fill-current' : ''}`} />
              <span>Watchlist only</span>
            </button>
          )}
          {POSITION_FILTERS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPositionFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black transition ${
                positionFilter === tab.key
                  ? 'bg-[#38003c] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pastel-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="text-[11px] uppercase text-gray-400 border-b border-black/5 font-black tracking-wide">
              <tr>
                {/* Target % leads: this is a price radar, so the prediction is
                    the column you scan first. */}
                {sortableHeader('changeScore', 'Target %')}
                <th className="px-4 py-3.5 text-left">Player</th>
                <th className="px-3 py-3.5 text-center">Pos</th>
                {sortableHeader('currentCost', 'Price')}
                {sortableHeader('selectedByPercent', 'Owned %')}
                {sortableHeader('netTransfers', 'Net Transfers')}
                <th className="px-4 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {visibleRows.map((player) => {
                const inSquad = squadIds.has(player.elementId);
                const watched = watchIds.has(player.elementId);

                // Squad wins the row colour when a player is both — being in
                // the team is the stronger fact; the star still marks the
                // watchlist membership.
                const rowTint = inSquad
                  ? 'bg-sky-50 hover:bg-sky-100'
                  : watched
                  ? 'bg-pink-50 hover:bg-pink-100'
                  : 'hover:bg-purple-50/40';

                return (
                  <tr
                    key={player.elementId}
                    className={`transition group ${rowTint}`}
                  >
                    {/* Target % — half the previous width */}
                    <td className="px-3 py-3">
                      <div className="w-14 mx-auto">
                        <div className="text-[10px] font-bold mb-1 text-center">
                          <span
                            className={
                              player.changeScore > 0
                                ? 'text-emerald-600'
                                : player.changeScore < 0
                                ? 'text-rose-600'
                                : 'text-gray-400'
                            }
                          >
                            {player.changeScore > 0 ? `+${player.changeScore}` : player.changeScore}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              player.changeScore >= 75
                                ? 'bg-emerald-500'
                                : player.changeScore > 0
                                ? 'bg-emerald-400'
                                : player.changeScore <= -75
                                ? 'bg-rose-500'
                                : player.changeScore < 0
                                ? 'bg-rose-400'
                                : 'bg-gray-300'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(8, Math.abs(player.changeScore)))}%`,
                              marginLeft: player.changeScore < 0 ? 'auto' : '0',
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <PlayerJersey
                          teamCode={player.team.code}
                          isGkp={player.elementType.id === 1}
                          className="w-8 h-8 shrink-0 mt-0.5"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <div className="font-bold text-[#111318] group-hover:text-purple-700 transition">
                              {player.webName}
                            </div>
                            {inSquad && (
                              <span className="px-1.5 py-0.5 rounded-full bg-sky-500 text-white text-[9px] font-black shrink-0">
                                MY TEAM
                              </span>
                            )}
                            {watched && (
                              <Star className="w-3 h-3 text-pink-500 fill-current shrink-0" />
                            )}
                            {watchMode && (
                              <button
                                type="button"
                                onClick={() => toggleWatch(player.elementId)}
                                aria-label={
                                  watched
                                    ? `Remove ${player.webName} from watchlist`
                                    : `Add ${player.webName} to watchlist`
                                }
                                className={`ml-0.5 p-1 rounded-full transition shrink-0 ${
                                  watched
                                    ? 'bg-pink-500 text-white hover:bg-pink-600'
                                    : 'bg-gray-100 text-gray-400 hover:bg-pink-100 hover:text-pink-600'
                                }`}
                              >
                                <Star className={`w-3 h-3 ${watched ? 'fill-current' : ''}`} />
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 font-semibold">
                            {player.team.name}
                          </div>
                          {player.news && (
                            <div
                              title={player.news}
                              className="text-[10px] text-rose-600 mt-1 flex items-center gap-1 font-medium leading-tight whitespace-nowrap"
                            >
                              <span className="shrink-0 text-[11px]">⚠️</span>
                              <span className="truncate max-w-[260px] sm:max-w-[420px] lg:max-w-[560px]">
                                {player.news}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-center text-xs font-bold text-gray-600">
                      {player.elementType.singular_name_short}
                    </td>

                    <td className="px-3 py-3 text-center font-black text-[#111318] font-mono">
                      £{player.currentCost.toFixed(1)}m
                    </td>

                    <td className="px-3 py-3 text-center text-xs text-gray-600 font-mono font-bold">
                      {player.selectedByPercent}%
                    </td>

                    <td className="px-3 py-3 text-center font-mono font-bold text-xs">
                      {player.netTransfers > 0 ? (
                        <span className="text-emerald-600">
                          +{player.netTransfers.toLocaleString()}
                        </span>
                      ) : player.netTransfers < 0 ? (
                        <span className="text-rose-600">
                          {player.netTransfers.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <StatusPill status={player.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredData.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm font-bold text-gray-500 mb-1">No players match these filters</p>
            <p className="text-xs text-gray-400">
              Try a different name, or clear the status and position filters.
            </p>
          </div>
        )}

        <div className="p-3 text-center text-xs text-gray-400 border-t border-black/5 bg-gray-50/50">
          {filteredData.length === 0
            ? 'No matching players'
            : filteredData.length > visibleRows.length
            ? `Showing the top ${visibleRows.length} of ${filteredData.length.toLocaleString()} matching players`
            : `Showing all ${filteredData.length} matching ${
                filteredData.length === 1 ? 'player' : 'players'
              }`}
        </div>
      </div>
    </div>
  );
}
