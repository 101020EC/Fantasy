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
      <div className="mb-6 p-4 rounded-3xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-emerald-900">Today Safe</h4>
            <p className="text-xs text-gray-500">ไม่มีนักเตะในทีมที่มีความเสี่ยงราคาตกหรือขึ้นในคืนนี้</p>
          </div>
        </div>
        <Link
          href="/prices"
          className="text-xs font-bold text-emerald-700 hover:underline hidden sm:block"
        >
          ดูตลาดรวม &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-6 p-5 rounded-3xl pastel-card shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-pastel-purple text-[#111318] flex items-center justify-center font-bold">
            ⚡
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-[#111318] flex items-center gap-2">
              <span>เรดาร์ราคานักเตะในทีมคุณ</span>
              {totalAlerts > 0 && (
                <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-[#111318] text-white">
                  {totalAlerts} คนเสี่ยงปรับราคาคืนนี้
                </span>
              )}
            </h3>
            <p className="text-[11px] text-gray-500">
              การปรับราคารอบดึกประจำวัน (~07:30 - 08:30 น. ตามเวลาไทย)
            </p>
          </div>
        </div>

        <Link
          href="/prices"
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-[#111318] text-white font-bold text-xs hover:opacity-90 transition"
        >
          เปิดตลาดราคาเต็ม &rarr;
        </Link>
      </div>

      {/* Grid of Alerts in Current Squad */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {/* Fallers Box */}
        {(criticalFallers.length > 0 || likelyFallers.length > 0) && (
          <div className="p-3.5 rounded-2xl bg-pastel-orangeLight/60 border border-pastel-orange/30">
            <div className="flex items-center gap-2 text-pastel-orangeDark font-bold text-xs mb-2">
              <TrendingDown className="w-4 h-4" />
              <span>เสี่ยงราคาลด (£-0.1m):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {criticalFallers.map((p) => (
                <div
                  key={p.element.id}
                  className="px-3 py-1 rounded-full bg-[#111318] text-white text-xs font-bold flex items-center gap-1.5 animate-pulse-fall shadow-sm"
                >
                  <span>{p.element.web_name}</span>
                  <span className="text-[10px] text-rose-300 font-mono">({p.priceAnalysis.netTransfers.toLocaleString()})</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-rose-500 rounded-full text-white font-black">ตกคืนนี้!</span>
                </div>
              ))}
              {likelyFallers.map((p) => (
                <div
                  key={p.element.id}
                  className="px-2.5 py-0.5 rounded-full bg-white text-gray-800 border border-black/5 text-xs font-medium flex items-center gap-1"
                >
                  <span>{p.element.web_name}</span>
                  <span className="text-[10px] text-gray-500 font-mono">({p.priceAnalysis.netTransfers.toLocaleString()})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risers Box */}
        {(criticalRisers.length > 0 || likelyRisers.length > 0) && (
          <div className="p-3.5 rounded-2xl bg-pastel-purpleLight/60 border border-pastel-purple/30">
            <div className="flex items-center gap-2 text-purple-700 font-bold text-xs mb-2">
              <TrendingUp className="w-4 h-4" />
              <span>มีโอกาสราคาขึ้น (£+0.1m):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {criticalRisers.map((p) => (
                <div
                  key={p.element.id}
                  className="px-3 py-1 rounded-full bg-[#111318] text-white text-xs font-bold flex items-center gap-1.5 animate-pulse-rise shadow-sm"
                >
                  <span>{p.element.web_name}</span>
                  <span className="text-[10px] text-emerald-300 font-mono">(+{p.priceAnalysis.netTransfers.toLocaleString()})</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500 rounded-full text-white font-black">ขึ้นคืนนี้!</span>
                </div>
              ))}
              {likelyRisers.map((p) => (
                <div
                  key={p.element.id}
                  className="px-2.5 py-0.5 rounded-full bg-white text-gray-800 border border-black/5 text-xs font-medium flex items-center gap-1"
                >
                  <span>{p.element.web_name}</span>
                  <span className="text-[10px] text-gray-500 font-mono">(+{p.priceAnalysis.netTransfers.toLocaleString()})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
