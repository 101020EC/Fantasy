import { NextResponse } from 'next/server';
import {
  fetchFPLBootstrap,
  fetchFPLEntry,
  fetchFPLPicks,
  fetchFPLFixtures,
  fetchFPLTransfers,
} from '@/lib/fpl-api';
import { seasonKey } from '@/lib/analyst';
import { loadPriceContext } from '@/lib/price-changes-store';
import { readWatchlist } from '@/lib/watchlist';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** TEMPORARY. Times each upstream call from the deployed region. */
export async function GET() {
  const id = '2792350';
  const ms: Record<string, number> = {};
  const time = async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
    const t = Date.now();
    try {
      return await fn();
    } finally {
      ms[label] = Date.now() - t;
    }
  };

  const t0 = Date.now();
  const [bootstrap, entry] = await Promise.all([
    time('bootstrap', () => fetchFPLBootstrap()),
    time('entry', () => fetchFPLEntry(id)),
    time('fixtures', () => fetchFPLFixtures()),
    time('transfers', () => fetchFPLTransfers(id).catch(() => [])),
    time('watchlist', () => readWatchlist(id).catch((): number[] => [])),
  ]);
  ms.stage1 = Date.now() - t0;

  const t1 = Date.now();
  await Promise.all([
    time('picks', () => fetchFPLPicks(id, entry.current_event || 1)),
    time('priceContext', () => loadPriceContext(seasonKey(bootstrap)).catch(() => ({}))),
  ]);
  ms.stage2 = Date.now() - t1;
  ms.total = Date.now() - t0;

  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, ms });
}
