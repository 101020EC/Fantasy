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
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pastel-blueLight dark:bg-pastel-darkPill text-xs font-black text-[#111318] dark:text-white mb-2">
            <span>MARKET RADAR</span>
            {currentEventName && <span>• {currentEventName}</span>}
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#111318] dark:text-white tracking-tight">
            FPL Price Changes Radar
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            วิเคราะห์และคาดการณ์การปรับราคาขึ้น/ลงของนักเตะ Premier League ประจำวัน
          </p>
        </div>

        {/* Change Time Box */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#171a23] border border-black/5 dark:border-white/10 flex items-center gap-3 text-xs shadow-sm self-start sm:self-auto">
          <div className="w-8 h-8 rounded-full bg-pastel-orangeLight text-pastel-orangeDark flex items-center justify-center font-bold">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-[#111318] dark:text-white block">เวลาปรับราคา:</span>
            <span className="text-gray-500 dark:text-gray-400 text-[11px]">~07:30 - 08:30 น. (เวลาไทย)</span>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center text-rose-800 dark:text-rose-200">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-600 dark:text-rose-400" />
          <p className="font-bold text-base">{errorMsg}</p>
        </div>
      ) : (
        <PriceMarketTable analyses={analyses} />
      )}
    </div>
  );
}
