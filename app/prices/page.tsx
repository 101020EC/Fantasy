import React from 'react';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { getAllMarketPriceAnalyses } from '@/lib/price-calculator';
import { PriceAnalysis } from '@/lib/types';
import PriceMarketTable from '@/components/prices/PriceMarketTable';
import { TrendingUp, Clock, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PricesPage() {
  let analyses: PriceAnalysis[] = [];
  let currentEventName = '';
  let errorMsg: string | null = null;

  try {
    const bootstrap = await fetchFPLBootstrap();
    analyses = getAllMarketPriceAnalyses(bootstrap);
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    if (currentEvent) {
      currentEventName = currentEvent.name;
    }
  } catch (err: any) {
    errorMsg = err.message || 'ไม่สามารถโหลดข้อมูลราคาจาก FPL API ได้';
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-fpl-green/20 text-fpl-green text-xs font-black border border-fpl-green/40">
              MARKET RADAR
            </span>
            {currentEventName && (
              <span className="text-xs text-gray-400 font-medium">
                • {currentEventName}
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-2.5">
            <TrendingUp className="w-8 h-8 text-fpl-cyan" />
            <span>กระดานเรดาร์ราคา FPL (Price Changes)</span>
          </h1>
          <p className="text-sm text-gray-300 mt-1 max-w-2xl">
            วิเคราะห์และคาดการณ์การปรับราคาขึ้น/ลงของนักเตะใน Premier League ก่อนการปรับราคาประจำวัน
          </p>
        </div>

        {/* Deadline & Nightly change notice */}
        <div className="p-3.5 bg-purple-950/80 border border-purple-800 rounded-2xl flex items-center gap-3 text-xs text-gray-300">
          <Clock className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold text-white block">เวลาปรับราคาประจำวัน:</span>
            <span className="text-gray-400">ประมาณ 01:30 - 02:30 UK (07:30 - 08:30 น. ไทย)</span>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800 text-center text-rose-200">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-400" />
          <p className="font-bold text-lg">{errorMsg}</p>
        </div>
      ) : (
        <PriceMarketTable analyses={analyses} />
      )}
    </div>
  );
}
