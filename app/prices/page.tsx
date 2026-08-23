import React from 'react';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { getAllMarketPriceAnalyses } from '@/lib/price-calculator';
import { PriceAnalysis } from '@/lib/types';
import PriceMarketTable from '@/components/prices/PriceMarketTable';
import { Clock, AlertCircle } from 'lucide-react';

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
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      {/* Top Header: Price Change on Left + เวลาปรับราคา on Right in the same row */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-1">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-2xl sm:text-4xl font-black text-[#111318] tracking-tight">
            Price Change
          </h1>
          {currentEventName && (
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-[#38003c] text-xs font-black hidden sm:inline-block">
              {currentEventName}
            </span>
          )}
        </div>

        {/* เวลาปรับราคา on the Right of Price Change */}
        <div className="px-3.5 py-2 rounded-2xl bg-white border border-black/5 flex items-center gap-2 text-xs shadow-sm shrink-0">
          <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-black text-[#111318] block text-[11px] sm:text-xs">เวลาปรับราคา:</span>
            <span className="text-gray-500 text-[10px] sm:text-[11px]">~07:30 - 08:30 น. (ไทย)</span>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-center text-rose-800">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-600" />
          <p className="font-bold text-base">{errorMsg}</p>
        </div>
      ) : (
        <PriceMarketTable analyses={analyses} />
      )}
    </div>
  );
}
