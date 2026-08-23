import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // firebase-admin cannot run on the Edge runtime

const MAX_WATCHLIST = 100;

/**
 * The watchlist lives server-side because the nightly price alert has to read
 * it. That job runs from Vercel Cron with no browser attached, so a list kept
 * in localStorage could tint rows here and never reach Telegram.
 *
 * Stored at watchlists/{teamId} as a plain array of element ids.
 */
function teamIdFrom(req: NextRequest): string | null {
  const raw = new URL(req.url).searchParams.get('teamId');
  return raw && !isNaN(Number(raw)) ? String(Number(raw)) : null;
}

export async function GET(req: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const teamId = teamIdFrom(req);
  if (!teamId) return NextResponse.json({ error: 'Invalid Team ID' }, { status: 400 });

  // Not configured is not an error here — the page still works, the list is
  // just empty and cannot be saved.
  if (!isAdminConfigured) {
    return NextResponse.json({ elementIds: [], configured: false, message: ADMIN_NOT_CONFIGURED });
  }

  const snap = await getAdminDb().collection('watchlists').doc(teamId).get();
  const elementIds: number[] = snap.data()?.elementIds ?? [];
  return NextResponse.json({ elementIds, configured: true });
}

export async function PUT(req: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const teamId = teamIdFrom(req);
  if (!teamId) return NextResponse.json({ error: 'Invalid Team ID' }, { status: 400 });
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.elementIds)) {
    return NextResponse.json({ error: 'Expected { elementIds: number[] }' }, { status: 400 });
  }

  // Normalise here rather than trusting the caller: unique, numeric, bounded.
  const elementIds = Array.from(
    new Set(body.elementIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))
  ).slice(0, MAX_WATCHLIST);

  await getAdminDb()
    .collection('watchlists')
    .doc(teamId)
    .set({ elementIds, updatedAt: new Date().toISOString() });

  return NextResponse.json({ elementIds, saved: true });
}
