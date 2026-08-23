import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { buildMarketSnapshot } from '@/lib/market-snapshot';
import { getAdminDb, isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // firebase-admin cannot run on the Edge runtime

/**
 * Captures the day's player market into Firestore.
 *
 * Scheduled for 01:00 UTC — just before the nightly price change window
 * (01:30–02:30 UTC), which is the most valuable moment to record: it is the
 * last state before prices move.
 *
 * Writes market/{YYYY-MM-DD}. Re-running on the same day overwrites that day's
 * document rather than adding another, so a retry is safe.
 */
export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
    }
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminConfigured) {
      return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
    }

    const bootstrap = await fetchFPLBootstrap();
    if (!bootstrap.elements?.length) {
      return NextResponse.json({ error: 'FPL returned no players' }, { status: 502 });
    }

    const { snapshot, roster } = buildMarketSnapshot(bootstrap);
    const db = getAdminDb();

    await db.collection('market').doc(snapshot.date).set(snapshot);

    // Names, clubs and positions barely change — rewrite only when they do.
    const rosterRef = db.collection('players').doc('roster');
    const existing = await rosterRef.get();
    const rosterChanged = existing.data()?.checksum !== roster.checksum;
    if (rosterChanged) {
      await rosterRef.set(roster);
    }

    return NextResponse.json({
      captured: true,
      date: snapshot.date,
      gameweek: snapshot.gameweek,
      playerCount: snapshot.playerCount,
      fields: snapshot.fields.length,
      rosterUpdated: rosterChanged,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error capturing market snapshot' },
      { status: 500 }
    );
  }
}
