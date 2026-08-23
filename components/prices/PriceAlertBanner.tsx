'use client';

import React from 'react';
import { TeamSquadPlayer } from '@/lib/types';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface PriceAlertBannerProps {
  players: TeamSquadPlayer[];
}

export default function PriceAlertBanner({ players }: PriceAlertBannerProps) {
  const criticalFallers = players.filter((p) => p.priceAnalysis.status === 'falling_soon');
  const likelyFallers = players.filter((p) => p.priceAnalysis.status === 'likely_faller');
  
  const criticalRisers = players.filter((p) => p.priceAnalysis.status === 'rising_soon');
  const likelyRisers = players.filter((p) => p.priceAnalysis.status === 'likely_riser');

  const totalAlerts = criticalFallers.length + criticalRisers.length;

  if (totalAlerts === 0 && likelyFallers.length === 0 && likelyRisers.length === 0) {
    return (
      <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">ทีมปลอดภัยจากความผันผวนของราคา</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">ไม่มีนักเตะในทีมที่มีความเสี่ยงราคาตกหรือขึ้นอย่างรุนแรงในคืนนี้</p>
          </div>
        </div>
        <Link
          href="/prices"
          className="text-xs font-bold text-teal-600 dark:text-fpl-cyan hover:underline hidden sm:block"
        >
          ดูตลาดรวมทั้งลีก &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-50 via-pink-50/50 to-purple-50 dark:from-[#20002b] dark:via-[#2a0138] dark:to-[#20002b] border border-purple-200 dark:border-purple-700/60 shadow-lg transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-200 dark:border-purple-800/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-fpl-pink/20 text-pink-600 dark:text-fpl-pink flex items-center justify-center border border-pink-300 dark:border-fpl-pink/30">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>เรดาร์แจ้งเตือนราคานักเตะในทีมคุณ</span>
              {totalAlerts > 0 && (
                <span className="px-2 py-0.5 text-xs font-extrabold rounded-full bg-rose-600 text-white animate-pulse">
                  {totalAlerts} คนเสี่ยงปรับราคาคืนนี้
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              การปรับราคากลางคืนของ FPL (ปกติช่วงเวลา ~07:30 - 08:30 น. ตามเวลาไทย)
            </p>
          </div>
        </div>

        <Link
          href="/prices"
          className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-purple-900 dark:bg-purple-900 hover:bg-purple-800 text-white dark:text-fpl-green font-bold text-xs border border-purple-700 transition"
        >
          เปิดตลาดราคาเต็ม &rarr;
        </Link>
      </div>

      {/* Grid of Alerts in Current Squad */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {/* Fallers Box */}
        {(criticalFallers.length > 0 || likelyFallers.length > 0) && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs mb-2">
              <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>เสี่ยงราคาลด (£-0.1m):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {criticalFallers.map((p) => (
                <div
                  key={p.element.id}
                  className="px-2.5 py-1 rounded-lg bg-rose-600/20 dark:bg-rose-600/30 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-500/50 text-xs font-bold flex items-center gap-1.5 animate-pulse-fall"
                >
                  <span>{p.element.web_name}</span>
                  <span className="text-[10px] text-rose-600 dark:text-rose-300">({p.priceAnalysis.netTransfers.toLocaleString()})</span>
                  <span className="text-[9px] px-1 bg-rose-600 rounded text-white font-black">คืนนี้!</span>
                </div>
              ))}
              {likelyFallers.map((p) => (
                <div
                  key={p.element.id}
                  className="px-2 py-0.5 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800 text-xs font-medium flex items-center gap-1"
                >
                  <span>{p.element.web_name}</span>
                  <span className="text-[10px] text-orange-600 dark:text-orange-400">({p.priceAnalysis.netTransfers.toLocaleString()})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risers Box */}
        {(criticalRisers.length > 0 || likelyRisers.length > 0) && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>มีโอกาสราคาขึ้น (£+0.1m):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {criticalRisers.map((p) => (
                <div
                  key={p.element.id}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 dark:bg-emerald-600/30 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/50 text-xs font-bold flex items-center gap-1.5 animate-pulse-rise"
                >
                  <span>{p.element.web_name}</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300">(+{p.priceAnalysis.netTransfers.toLocaleString()})</span>
                  <span className="text-[9px] px-1 bg-emerald-600 rounded text-white dark:text-purple-950 font-black">คืนนี้!</span>
                </div>
              ))}
              {likelyRisers.map((p) => (
                <div
                  key={p.element.id}
                  className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs font-medium flex items-center gap-1"
                >
                  <span>{p.element.web_name}</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400">(+{p.priceAnalysis.netTransfers.toLocaleString()})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
