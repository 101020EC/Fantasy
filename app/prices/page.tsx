import React from 'react';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { getAllMarketPriceAnalyses } from '@/lib/price-calculator';
import { seasonKey } from '@/lib/analyst';
import { listPriceChangeDays, loadPriceContext } from '@/lib/price-changes-store';
import { PriceChangeDay } from '@/lib/price-changes';
import { PriceAnalysis } from '@/lib/types';
import PriceMarketTable from '@/components/prices/PriceMarketTable';
import { Clock, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PricesPage() {
  let analyses: PriceAnalysis[] = [];
  let currentEventName = '';
  let errorMsg: string | null = null;
  let changeDays: PriceChangeDay[] = [];
  let confidence = { riseFitted: false, fallFitted: false };

  try {
    const bootstrap = await fetchFPLBootstrap();

    // Baselines and thresholds make the target percentage mean something. Both
    // degrade to the old behaviour if Firestore is unreachable, so a database
    // problem costs accuracy rather than the page.
    const context = await loadPriceContext(seasonKey(bootstrap)).catch(() => ({}));
    analyses = getAllMarketPriceAnalyses(bootstrap, context);
    const t = 'thresholds' in context ? context.thresholds : null;
    confidence = { riseFitted: Boolean(t?.riseFitted), fallFitted: Boolean(t?.fallFitted) };

    // The Past tab. Only days with a computed diff exist, so an empty list is a
    // real answer — there is no history before the second snapshot.
    changeDays = await listPriceChangeDays(30).catch(() => []);

    // The gameweek being played or about to be — not the last one with points.
    // FPL keeps `is_current` on a finished gameweek until the next deadline, so
    // reading it alone left this badge saying "Gameweek 1" for days after GW1
    // had ended.
    const activeEvent =
      bootstrap.events.find((e) => e.is_current && !e.finished) ||
      bootstrap.events.find((e) => e.is_next) ||
      bootstrap.events.find((e) => e.is_current);
    if (activeEvent) {
      currentEventName = activeEvent.name;
    }
  } catch (err: any) {
    errorMsg = err.message || 'Unable to load price data from FPL API';
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      {/* Top Header: Price Change on Left + Change Time on Right */}
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

        {/* Change Time Box on the Right */}
        <div className="px-3.5 py-2 rounded-2xl bg-white border border-black/5 flex items-center gap-2 text-xs shadow-sm shrink-0">
          <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="leading-tight">
            <span className="font-black text-[#111318] block text-[11px] sm:text-xs">Update Window</span>
            <span className="block text-[11px] sm:text-xs font-bold text-[#38003c]">
              08:30 - 09:30 Bangkok
            </span>
            <span className="block text-gray-400 text-[9px] sm:text-[10px]">
              01:30 - 02:30 UTC
            </span>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-center text-rose-800">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-600" />
          <p className="font-bold text-base">{errorMsg}</p>
        </div>
      ) : (
        <PriceMarketTable analyses={analyses} changeDays={changeDays} confidence={confidence} />
      )}
    </div>
  );
}
