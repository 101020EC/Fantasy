'use client';

import React, { useState, useMemo } from 'react';
import { PriceAnalysis } from '@/lib/types';
import { TrendingUp, TrendingDown, Search, ArrowUpDown } from 'lucide-react';
import PlayerJersey from '../pitch/PlayerJersey';

const POSITION_IDS: Record<string, number> = { gkp: 1, def: 2, mid: 3, fwd: 4 };

interface PriceMarketTableProps {
  analyses: PriceAnalysis[];
}

export default function PriceMarketTable({ analyses }: PriceMarketTableProps) {
  const [search, setSearch] = useState('');
  // Status and position were one piece of state, so they could not be combined
  // and picking a position silently cleared the status filter.
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'netTransfers' | 'changeScore' | 'currentCost' | 'selectedByPercent'>('netTransfers');
  const [sortAsc, setSortAsc] = useState(false);

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

        return true;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (valA === valB) return 0;
        return sortAsc ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
      });
  }, [analyses, search, statusFilter, positionFilter, sortField, sortAsc]);

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

  return (
    <div className="w-full">
      {/* 2 Main Summary Cards in the Same Row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        {/* Left: Green Button (Rising Tonight) */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'critical_risers' ? 'all' : 'critical_risers')}
          className={`p-4 sm:p-5 rounded-3xl text-left transition transform hover:scale-[1.01] active:scale-98 shadow-md flex items-center justify-between ${
            statusFilter === 'critical_risers'
              ? 'bg-emerald-600 text-white ring-4 ring-emerald-300'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-100">
              <TrendingUp className="w-4 h-4" />
              <span>Rising Tonight</span>
            </div>
            <div className="text-2xl sm:text-4xl font-black mt-1">
              {criticalRisersCount} <span className="text-sm font-normal opacity-90">players</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-lg">
            🚀
          </div>
        </button>

        {/* Right: Red Button (Falling Tonight) */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'critical_fallers' ? 'all' : 'critical_fallers')}
          className={`p-4 sm:p-5 rounded-3xl text-left transition transform hover:scale-[1.01] active:scale-98 shadow-md flex items-center justify-between ${
            statusFilter === 'critical_fallers'
              ? 'bg-rose-700 text-white ring-4 ring-rose-300'
              : 'bg-rose-600 hover:bg-rose-700 text-white'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-100">
              <TrendingDown className="w-4 h-4" />
              <span>Falling Tonight</span>
            </div>
            <div className="text-2xl sm:text-4xl font-black mt-1">
              {criticalFallersCount} <span className="text-sm font-normal opacity-90">players</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-lg">
            🔻
          </div>
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="pastel-card p-4 sm:p-5 shadow-sm mb-4 space-y-3">
        {/* Search Input */}
        <div className="relative w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player name or club..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-black/5 rounded-full text-base sm:text-xs text-[#111318] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 transition shadow-inner"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
        </div>

        {/* Row 1: Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-black/5">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mr-1">Status:</span>
          {[
            { key: 'critical_risers', label: '🚀 Rising Tonight', activeClass: 'bg-emerald-600 text-white' },
            { key: 'critical_fallers', label: '🔻 Falling Tonight', activeClass: 'bg-rose-600 text-white' },
            { key: 'risers', label: '🟢 Trending Up', activeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
            { key: 'fallers', label: '🔴 Trending Down', activeClass: 'bg-rose-100 text-rose-800 border-rose-300' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(statusFilter === tab.key ? 'all' : tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                statusFilter === tab.key
                  ? `${tab.activeClass} shadow-sm ring-1 ring-black/10`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Row 2: Positions + All */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-black/5">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mr-1">Position:</span>
          {[
            { key: 'gkp', label: 'GK' },
            { key: 'def', label: 'DEF' },
            { key: 'mid', label: 'MID' },
            { key: 'fwd', label: 'FWD' },
            { key: 'all', label: 'All' },
          ].map((tab) => (
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

      {/* Table Container */}
      <div className="pastel-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="text-[11px] uppercase bg-gray-50 text-gray-500 border-b border-black/5 font-black">
              <tr>
                <th className="px-4 py-3.5">Player</th>
                <th className="px-3 py-3.5">Pos</th>
                <th
                  onClick={() => handleSort('currentCost')}
                  className="px-3 py-3.5 cursor-pointer hover:text-[#111318]"
                >
                  <div className="flex items-center gap-1">
                    <span>Price</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('selectedByPercent')}
                  className="px-3 py-3.5 cursor-pointer hover:text-[#111318]"
                >
                  <div className="flex items-center gap-1">
                    <span>Owned %</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('netTransfers')}
                  className="px-3 py-3.5 cursor-pointer hover:text-[#111318]"
                >
                  <div className="flex items-center gap-1">
                    <span>Net Transfers</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('changeScore')}
                  className="px-3 py-3.5 cursor-pointer hover:text-[#111318]"
                >
                  <div className="flex items-center gap-1">
                    <span>Target %</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {visibleRows.map((player) => {
                return (
                  <tr
                    key={player.elementId}
                    className="hover:bg-purple-50/40 transition group"
                  >
                    {/* Player Info without duplicate short name */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <PlayerJersey
                          teamCode={player.team.code}
                          isGkp={player.elementType.id === 1}
                          className="w-8 h-8 shrink-0 mt-0.5"
                        />
                        <div>
                          <div className="font-bold text-[#111318] group-hover:text-purple-700 transition">
                            {player.webName}
                          </div>
                          {/* Club Name Only (Removed short name abbreviation) */}
                          <div className="text-[11px] text-gray-500 font-semibold">
                            {player.team.name}
                          </div>
                          {player.news && (
                            <div className="text-[10px] text-rose-600 mt-1 flex items-start gap-1 font-medium leading-tight max-w-[220px] sm:max-w-md">
                              <span className="shrink-0 text-[11px]">⚠️</span>
                              <span>{player.news}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="px-3 py-3 text-xs font-bold text-gray-600">
                      {player.elementType.singular_name_short}
                    </td>

                    {/* Current Cost */}
                    <td className="px-3 py-3 font-black text-[#111318] font-mono">
                      £{player.currentCost.toFixed(1)}m
                    </td>

                    {/* Ownership % */}
                    <td className="px-3 py-3 text-xs text-gray-600 font-mono font-bold">
                      {player.selectedByPercent}%
                    </td>

                    {/* Net Transfers */}
                    <td className="px-3 py-3 font-mono font-bold text-xs">
                      {player.netTransfers > 0 ? (
                        <span className="text-emerald-600">+{player.netTransfers.toLocaleString()}</span>
                      ) : player.netTransfers < 0 ? (
                        <span className="text-rose-600">{player.netTransfers.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>

                    {/* Score Bar */}
                    <td className="px-3 py-3">
                      <div className="w-28">
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span className={player.changeScore > 0 ? 'text-emerald-600' : player.changeScore < 0 ? 'text-rose-600' : 'text-gray-400'}>
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

                    {/* Status Pill */}
                    <td className="px-4 py-3 text-right">
                      {player.status === 'rising_soon' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold animate-pulse-rise shadow-sm">
                          <TrendingUp className="w-3 h-3 text-white" />
                          <span>Rising Tonight</span>
                        </span>
                      )}
                      {player.status === 'likely_riser' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                          <TrendingUp className="w-3 h-3" />
                          <span>Trending Up</span>
                        </span>
                      )}
                      {player.status === 'falling_soon' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-600 text-white text-[11px] font-bold animate-pulse-fall shadow-sm">
                          <TrendingDown className="w-3 h-3 text-white" />
                          <span>Falling Tonight</span>
                        </span>
                      )}
                      {player.status === 'likely_faller' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-semibold">
                          <TrendingDown className="w-3 h-3" />
                          <span>Trending Down</span>
                        </span>
                      )}
                      {player.status === 'stable' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px]">
                          <span>Neutral</span>
                        </span>
                      )}
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
            <p className="text-xs text-gray-400">Try a different name, or clear the status and position filters.</p>
          </div>
        )}

        <div className="p-3 text-center text-xs text-gray-400 border-t border-black/5 bg-gray-50/50">
          {filteredData.length === 0
            ? 'No matching players'
            : filteredData.length > visibleRows.length
            ? `Showing the top ${visibleRows.length} of ${filteredData.length.toLocaleString()} matching players`
            : `Showing all ${filteredData.length} matching ${filteredData.length === 1 ? 'player' : 'players'}`}
        </div>
      </div>
    </div>
  );
}
