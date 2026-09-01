import React from 'react';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { getAllMarketPriceAnalyses, nextPriceDeadline } from '@/lib/price-calculator';
import { seasonKey } from '@/lib/analyst';
import { listPriceChangeDays } from '@/lib/price-changes-store';
import { PriceChangeDay } from '@/lib/price-changes';
import { FPLElementType, FPLTeam } from '@/lib/types';
import PriceMarketTable from '@/components/prices/PriceMarketTable';
import PriceDeadlineCountdown from '@/components/prices/PriceDeadlineCountdown';
import { MarketCell, toMarketCells, toMarketRow } from '@/lib/market-row';
import { Clock, AlertCircle } from 'lucide-react';
import { stalest } from '@/lib/fpl-resilience';
import { StaleNotice } from '@/components/system/UpstreamNotice';

export const dynamic = 'force-dynamic';

export default async function PricesPage() {
  let analyses: MarketCell[][] = [];
  let teams: FPLTeam[] = [];
  let types: FPLElementType[] = [];
  let currentEventName = '';
  let errorMsg: string | null = null;
  let changeDays: PriceChangeDay[] = [];
  let deadline: string | null = null;

  let bootstrapForStaleness: unknown = null;

  try {
    // The Past tab's history depends on nothing else here, so it is started
    // first and awaited last rather than queued behind two other requests.
    const changeDaysPromise = listPriceChangeDays(30).catch((): PriceChangeDay[] => []);

    const bootstrap = await fetchFPLBootstrap();
    bootstrapForStaleness = bootstrap;

    // Club and position travel once each, not once per player. Embedding them
    // in every row cost 394KB of the page — twenty clubs and four positions,
    // repeated 616 times.
    teams = bootstrap.teams;
    types = bootstrap.element_types;
    analyses = getAllMarketPriceAnalyses(bootstrap).map(toMarketRow).map(toMarketCells);
    deadline = nextPriceDeadline(bootstrap);

    // Only days with a computed diff exist, so an empty list is a real answer —
    // there is no history before the second snapshot.
    changeDays = await changeDaysPromise;

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

  const served = stalest(bootstrapForStaleness);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-2 pb-4 sm:pt-3 sm:pb-6">
      {served && (
        <div className="mb-3">
          <StaleNotice capturedAt={served.capturedAt} />
        </div>
      )}
      {/* Title row sits tight to the top; the tab switcher renders on the row
          below it, inside PriceMarketTable, with the update window holding the
          right-hand side of both. */}
      <div className="flex items-start justify-between gap-3 mb-2">
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
      </div>

      {errorMsg ? (
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-center text-rose-800">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-600" />
          <p className="font-bold text-base">{errorMsg}</p>
        </div>
      ) : (
        <PriceMarketTable
          analyses={analyses}
          teams={teams}
          types={types}
          changeDays={changeDays}
          aside={<PriceDeadlineCountdown deadline={deadline} />}
        />
      )}
    </div>
  );
}
