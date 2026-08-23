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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pastel-blueLight text-xs font-black text-[#38003c] mb-1.5">
            <span>MARKET</span>
            {currentEventName && <span>• {currentEventName}</span>}
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#111318] tracking-tight">
            Price Change
          </h1>
        </div>

        {/* Change Time Box */}
        <div className="p-3 rounded-2xl bg-white border border-black/5 flex items-center gap-2.5 text-xs shadow-sm self-start sm:self-auto">
          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-[#111318] block">เวลาปรับราคา:</span>
            <span className="text-gray-500 text-[11px]">~07:30 - 08:30 น. (เวลาไทย)</span>
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
