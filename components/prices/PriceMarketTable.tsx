'use client';

import React, { useState, useMemo } from 'react';
import { PriceAnalysis } from '@/lib/types';
import { TrendingUp, TrendingDown, Search, ArrowUpDown, Sparkles, Minus } from 'lucide-react';
import PlayerJersey from '../pitch/PlayerJersey';

interface PriceMarketTableProps {
  analyses: PriceAnalysis[];
}

export default function PriceMarketTable({ analyses }: PriceMarketTableProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortField, setSortField] = useState<'netTransfers' | 'changeScore' | 'currentCost' | 'selectedByPercent'>('netTransfers');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredData = useMemo(() => {
    return analyses
      .filter((p) => {
        const matchSearch =
          p.webName.toLowerCase().includes(search.toLowerCase()) ||
          p.fullName.toLowerCase().includes(search.toLowerCase()) ||
          p.team.name.toLowerCase().includes(search.toLowerCase()) ||
          p.team.short_name.toLowerCase().includes(search.toLowerCase());

        if (!matchSearch) return false;

        if (filterType === 'risers') return p.status === 'rising_soon' || p.status === 'likely_riser';
        if (filterType === 'critical_risers') return p.status === 'rising_soon';
        if (filterType === 'fallers') return p.status === 'falling_soon' || p.status === 'likely_faller';
        if (filterType === 'critical_fallers') return p.status === 'falling_soon';
        if (filterType === 'gkp') return p.elementType.id === 1;
        if (filterType === 'def') return p.elementType.id === 2;
        if (filterType === 'mid') return p.elementType.id === 3;
        if (filterType === 'fwd') return p.elementType.id === 4;

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        return sortAsc ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
      });
  }, [analyses, search, filterType, sortField, sortAsc]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const criticalRisersCount = analyses.filter((a) => a.status === 'rising_soon').length;
  const criticalFallersCount = analyses.filter((a) => a.status === 'falling_soon').length;

  return (
    <div className="w-full">
      {/* 3 Pastel Summary Cards (Matching the image style) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        {/* Card 1: Risers */}
        <button
          onClick={() => setFilterType('critical_risers')}
          className={`card-pastel-purple p-5 text-left transition transform hover:scale-[1.02] active:scale-98 shadow-md ${
            filterType === 'critical_risers' ? 'ring-4 ring-[#111318] dark:ring-white' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#111318]/80 dark:text-white/80">
              🚀 ขึ้นคืนนี้ (Tonight)
            </span>
            <div className="w-8 h-8 rounded-full bg-[#111318] text-white flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#111318] dark:text-white">
            {criticalRisersCount} คน
          </div>
          <span className="text-[11px] text-[#111318]/70 dark:text-white/70 mt-1 block font-medium">
            ยอดซื้อสุทธิพุ่งสูง คาดปรับ +£0.1m
          </span>
        </button>

        {/* Card 2: Fallers */}
        <button
          onClick={() => setFilterType('critical_fallers')}
          className={`card-pastel-orange p-5 text-left transition transform hover:scale-[1.02] active:scale-98 shadow-md ${
            filterType === 'critical_fallers' ? 'ring-4 ring-[#111318] dark:ring-white' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#111318]/80 dark:text-white/80">
              ⚠️ ตกคืนนี้ (Tonight)
            </span>
            <div className="w-8 h-8 rounded-full bg-[#111318] text-white flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#111318] dark:text-white">
            {criticalFallersCount} คน
          </div>
          <span className="text-[11px] text-[#111318]/70 dark:text-white/70 mt-1 block font-medium">
            ยอดเทขายสูงมาก คาดปรับ -£0.1m
          </span>
        </button>

        {/* Card 3: All Players */}
        <button
          onClick={() => setFilterType('all')}
          className={`card-pastel-blue p-5 text-left transition transform hover:scale-[1.02] active:scale-98 shadow-md ${
            filterType === 'all' ? 'ring-4 ring-[#111318] dark:ring-white' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#111318]/80 dark:text-white/80">
              ⚽ ทั้งหมด (All Players)
            </span>
            <div className="w-8 h-8 rounded-full bg-[#111318] text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-pastel-blue" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#111318] dark:text-white">
            {analyses.length} คน
          </div>
          <span className="text-[11px] text-[#111318]/70 dark:text-white/70 mt-1 block font-medium">
            ดัชนีโมเมนตัมราคาเรียลไทม์
          </span>
        </button>
      </div>

      {/* Filter and Search Controls (Matching Pill Style) */}
      <div className="pastel-card p-4 shadow-sm mb-6 flex flex-col md:flex-row gap-3 justify-between items-center transition-colors">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อนักเตะ หรือทีม..."
            className="w-full pl-9 pr-4 py-2 bg-pastel-bg border border-black/5 rounded-full text-base sm:text-xs text-[#111318] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-2.5" />
        </div>

        {/* Categories Tabs in Round Capsules */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { key: 'all', label: 'ทั้งหมด' },
            { key: 'critical_risers', label: '🚀 ขึ้นคืนนี้' },
            { key: 'risers', label: '🟢 ขาขึ้น' },
            { key: 'critical_fallers', label: '⚠️ ตกคืนนี้' },
            { key: 'fallers', label: '🔴 ขาลง' },
            { key: 'gkp', label: 'GK' },
            { key: 'def', label: 'DEF' },
            { key: 'mid', label: 'MID' },
            { key: 'fwd', label: 'FWD' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                filterType === tab.key
                  ? 'bg-[#111318] dark:bg-white text-white dark:text-[#111318] shadow-sm'
                  : 'bg-pastel-bg dark:bg-pastel-darkPill text-gray-600 dark:text-gray-300 hover:bg-gray-200'
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
          <table className="w-full text-left text-sm text-gray-700 dark:text-gray-200">
            <thead className="text-[11px] uppercase bg-gray-50 dark:bg-pastel-darkPill text-gray-500 dark:text-gray-400 border-b border-black/5 dark:border-white/5 font-black">
              <tr>
                <th className="px-4 py-3.5">ผู้เล่น (Player)</th>
                <th className="px-3 py-3.5">ตำแหน่ง</th>
                <th
                  onClick={() => handleSort('currentCost')}
                  className="px-3 py-3.5 cursor-pointer hover:text-[#111318] dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>ราคา</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('selectedByPercent')}
                  className="px-3 py-3.5 cursor-pointer hover:text-[#111318] dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>ถือครอง %</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('netTransfers')}
                  className="px-3 py-3.5 cursor-pointer hover:text-[#111318] dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>ยอดซื้อ/ขายสุทธิ</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('changeScore')}
                  className="px-3 py-3.5 cursor-pointer hover:text-[#111318] dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>ดัชนีราคา</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-right">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filteredData.slice(0, 100).map((player) => {
                return (
                  <tr
                    key={player.elementId}
                    className="hover:bg-pastel-bg/60 dark:hover:bg-pastel-darkPill/40 transition group"
                  >
                    {/* Player Info with condition / injury under name & club */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <PlayerJersey
                          teamCode={player.team.code}
                          isGkp={player.elementType.id === 1}
                          className="w-8 h-8 shrink-0 mt-0.5"
                        />
                        <div>
                          <div className="font-bold text-[#111318] dark:text-white group-hover:text-pastel-blueDark transition">
                            {player.webName}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
                            {player.team.name} ({player.team.short_name})
                          </div>
                          {player.news && (
                            <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 flex items-start gap-1 font-medium leading-tight max-w-[220px] sm:max-w-md">
                              <span className="shrink-0 text-[11px]">⚠️</span>
                              <span>{player.news}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="px-3 py-3 text-xs font-bold text-gray-600 dark:text-gray-300">
                      {player.elementType.singular_name_short}
                    </td>

                    {/* Current Cost */}
                    <td className="px-3 py-3 font-black text-[#111318] dark:text-white font-mono">
                      £{player.currentCost.toFixed(1)}m
                    </td>

                    {/* Ownership % */}
                    <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-300 font-mono font-bold">
                      {player.selectedByPercent}%
                    </td>

                    {/* Net Transfers */}
                    <td className="px-3 py-3 font-mono font-bold text-xs">
                      {player.netTransfers > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">+{player.netTransfers.toLocaleString()}</span>
                      ) : player.netTransfers < 0 ? (
                        <span className="text-rose-600 dark:text-rose-400">{player.netTransfers.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>

                    {/* Score Bar */}
                    <td className="px-3 py-3">
                      <div className="w-28">
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span className={player.changeScore > 0 ? 'text-emerald-600 dark:text-emerald-400' : player.changeScore < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'}>
                            {player.changeScore > 0 ? `+${player.changeScore}` : player.changeScore}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-black/40 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              player.changeScore >= 75
                                ? 'bg-emerald-500'
                                : player.changeScore > 0
                                ? 'bg-emerald-400'
                                : player.changeScore <= -75
                                ? 'bg-rose-500'
                                : player.changeScore < 0
                                ? 'bg-orange-400'
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
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#111318] text-white text-[11px] font-bold animate-pulse-rise shadow-sm">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span>ขึ้นคืนนี้</span>
                        </span>
                      )}
                      {player.status === 'likely_riser' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
                          <TrendingUp className="w-3 h-3" />
                          <span>ขาขึ้น</span>
                        </span>
                      )}
                      {player.status === 'falling_soon' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#111318] text-white text-[11px] font-bold animate-pulse-fall shadow-sm">
                          <TrendingDown className="w-3 h-3 text-rose-400" />
                          <span>ตกคืนนี้</span>
                        </span>
                      )}
                      {player.status === 'likely_faller' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-[11px] font-semibold">
                          <TrendingDown className="w-3 h-3" />
                          <span>ขาลง</span>
                        </span>
                      )}
                      {player.status === 'stable' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-pastel-darkPill text-gray-500 dark:text-gray-400 text-[11px]">
                          <Minus className="w-3 h-3" />
                          <span>ปกติ</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3.5 text-center text-xs text-gray-400 border-t border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-pastel-darkPill/20">
          แสดง 100 อันดับแรกตามตัวกรองที่เลือก (อัปเดตจาก FPL Official API)
        </div>
      </div>
    </div>
  );
}
