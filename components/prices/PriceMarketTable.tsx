'use client';

import React, { useState, useMemo } from 'react';
import { PriceAnalysis } from '@/lib/types';
import { TrendingUp, TrendingDown, Search, Filter, ArrowUpDown, ShieldAlert, Sparkles, Minus } from 'lucide-react';
import PlayerJersey from '../pitch/PlayerJersey';

interface PriceMarketTableProps {
  analyses: PriceAnalysis[];
}

export default function PriceMarketTable({ analyses }: PriceMarketTableProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all'); // all, risers, fallers, gkp, def, mid, fwd
  const [sortField, setSortField] = useState<'netTransfers' | 'changeScore' | 'currentCost' | 'selectedByPercent'>('netTransfers');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredData = useMemo(() => {
    return analyses
      .filter((p) => {
        // Search filter
        const matchSearch =
          p.webName.toLowerCase().includes(search.toLowerCase()) ||
          p.fullName.toLowerCase().includes(search.toLowerCase()) ||
          p.team.name.toLowerCase().includes(search.toLowerCase()) ||
          p.team.short_name.toLowerCase().includes(search.toLowerCase());

        if (!matchSearch) return false;

        // Category filter
        if (filterType === 'risers') {
          return p.status === 'rising_soon' || p.status === 'likely_riser';
        }
        if (filterType === 'critical_risers') {
          return p.status === 'rising_soon';
        }
        if (filterType === 'fallers') {
          return p.status === 'falling_soon' || p.status === 'likely_faller';
        }
        if (filterType === 'critical_fallers') {
          return p.status === 'falling_soon';
        }
        if (filterType === 'gkp') return p.elementType.id === 1;
        if (filterType === 'def') return p.elementType.id === 2;
        if (filterType === 'mid') return p.elementType.id === 3;
        if (filterType === 'fwd') return p.elementType.id === 4;

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortAsc) {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
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
      {/* Quick Summary Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => setFilterType('critical_risers')}
          className={`p-4 rounded-2xl border text-left transition ${
            filterType === 'critical_risers'
              ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-400'
              : 'bg-emerald-950/30 border-emerald-800/40 hover:bg-emerald-950/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              🚀 เสี่ยงราคาขึ้นคืนนี้
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {criticalRisersCount} คน
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">ยอดซื้อสุทธิพุ่งสูง คาดปรับ +£0.1m</span>
        </button>

        <button
          onClick={() => setFilterType('critical_fallers')}
          className={`p-4 rounded-2xl border text-left transition ${
            filterType === 'critical_fallers'
              ? 'bg-rose-950/80 border-rose-500 ring-2 ring-rose-400'
              : 'bg-rose-950/30 border-rose-800/40 hover:bg-rose-950/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
              ⚠️ เสี่ยงราคาตกคืนนี้
            </span>
            <TrendingDown className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {criticalFallersCount} คน
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">ยอดเทขายสูงมาก คาดปรับ -£0.1m</span>
        </button>

        <button
          onClick={() => setFilterType('all')}
          className={`p-4 rounded-2xl border text-left transition ${
            filterType === 'all'
              ? 'bg-purple-900/80 border-purple-500 ring-2 ring-purple-400'
              : 'bg-purple-950/30 border-purple-800/40 hover:bg-purple-950/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
              ⚽ ผู้เล่นทั้งหมดใน FPL
            </span>
            <Sparkles className="w-5 h-5 text-fpl-cyan" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {analyses.length} คน
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">วิเคราะห์แนวโน้มราคาแบบเรียลไทม์</span>
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="glass-panel p-4 rounded-2xl border border-purple-800/60 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อนักเตะ หรือทีม..."
            className="w-full pl-9 pr-4 py-2 bg-purple-950/80 border border-purple-800 rounded-xl text-sm text-white placeholder-gray-400 focus:outline-none focus:border-fpl-green"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
        </div>

        {/* Categories Tabs */}
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterType === tab.key
                  ? 'bg-fpl-green text-fpl-purple shadow-md'
                  : 'bg-purple-950/60 text-gray-300 hover:bg-purple-900 border border-purple-800/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-panel rounded-2xl border border-purple-800/60 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-200">
            <thead className="text-[11px] uppercase bg-purple-950/90 text-purple-200 border-b border-purple-800/80 font-black">
              <tr>
                <th className="px-4 py-3.5">ผู้เล่น (Player)</th>
                <th className="px-3 py-3.5">ตำแหน่ง</th>
                <th
                  onClick={() => handleSort('currentCost')}
                  className="px-3 py-3.5 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>ราคา</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('selectedByPercent')}
                  className="px-3 py-3.5 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>ถือครอง %</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('netTransfers')}
                  className="px-3 py-3.5 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>ยอดซื้อ/ขายสุทธิ</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('changeScore')}
                  className="px-3 py-3.5 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>ดัชนีราคา (Prediction)</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-right">สถานะแจ้งเตือน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/40">
              {filteredData.slice(0, 100).map((player) => {
                return (
                  <tr
                    key={player.elementId}
                    className="hover:bg-purple-900/20 transition group"
                  >
                    {/* Player Info */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <PlayerJersey
                          teamCode={player.team.code}
                          isGkp={player.elementType.id === 1}
                          className="w-8 h-8 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-white group-hover:text-fpl-green transition">
                            {player.webName}
                          </div>
                          <div className="text-[11px] text-gray-400 flex items-center gap-1">
                            <span>{player.team.short_name}</span>
                            {player.news && (
                              <span className="text-rose-400 text-[10px]" title={player.news}>
                                • ⚠️ {player.news.slice(0, 24)}...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="px-3 py-3 text-xs font-semibold text-purple-300">
                      {player.elementType.singular_name_short}
                    </td>

                    {/* Current Cost */}
                    <td className="px-3 py-3 font-bold text-white font-mono">
                      £{player.currentCost.toFixed(1)}m
                    </td>

                    {/* Ownership % */}
                    <td className="px-3 py-3 text-xs text-amber-300 font-mono">
                      {player.selectedByPercent}%
                    </td>

                    {/* Net Transfers */}
                    <td className="px-3 py-3 font-mono font-bold text-xs">
                      {player.netTransfers > 0 ? (
                        <span className="text-emerald-400">+{player.netTransfers.toLocaleString()}</span>
                      ) : player.netTransfers < 0 ? (
                        <span className="text-rose-400">{player.netTransfers.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>

                    {/* Score Bar */}
                    <td className="px-3 py-3">
                      <div className="w-32">
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span className={player.changeScore > 0 ? 'text-emerald-400' : player.changeScore < 0 ? 'text-rose-400' : 'text-gray-400'}>
                            {player.changeScore > 0 ? `+${player.changeScore}` : player.changeScore}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-purple-900">
                          <div
                            className={`h-full ${
                              player.changeScore >= 75
                                ? 'bg-emerald-400'
                                : player.changeScore > 0
                                ? 'bg-emerald-600'
                                : player.changeScore <= -75
                                ? 'bg-rose-500'
                                : player.changeScore < 0
                                ? 'bg-orange-500'
                                : 'bg-gray-700'
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-[11px] font-black animate-pulse-rise">
                          <TrendingUp className="w-3 h-3" />
                          <span>ขึ้นคืนนี้</span>
                        </span>
                      )}
                      {player.status === 'likely_riser' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-semibold">
                          <TrendingUp className="w-3 h-3" />
                          <span>ขาขึ้น</span>
                        </span>
                      )}
                      {player.status === 'falling_soon' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[11px] font-black animate-pulse-fall">
                          <TrendingDown className="w-3 h-3" />
                          <span>ตกคืนนี้</span>
                        </span>
                      )}
                      {player.status === 'likely_faller' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-950 text-orange-400 border border-orange-800 text-[11px] font-semibold">
                          <TrendingDown className="w-3 h-3" />
                          <span>ขาลง</span>
                        </span>
                      )}
                      {player.status === 'stable' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-950/60 text-gray-400 text-[11px]">
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
        <div className="p-3 text-center text-xs text-gray-400 border-t border-purple-900/60 bg-purple-950/40">
          แสดงรายการ 100 อันดับแรกตามตัวกรองที่เลือก (ข้อมูลอัปเดตต่อเนื่องจาก FPL Official API)
        </div>
      </div>
    </div>
  );
}
