import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { reconstructLeagueHistory } from '@/lib/league-history';
import { getAdminDb, isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // a rebuild is one request per member

/**
 * Rebuilds each requested league's table for every finalised gameweek.
 *
 * Existing documents captured live from FPL are left alone — FPL's own report
 * is authoritative for the week it was taken in, particularly for the
 * `rank_sort` tiebreak, which is not derivable from public data.
 */
export async function POST(req: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.leagueIds) || body.leagueIds.length === 0) {
    return NextResponse.json({ error: 'Expected { leagueIds: number[] }' }, { status: 400 });
  }

  const leagueIds: number[] = Array.from(
    new Set<number>(body.leagueIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))
  ).slice(0, 20);

  try {
    const bootstrap = await fetchFPLBootstrap();
    const finalised = new Set(bootstrap.events.filter((e) => e.data_checked).map((e) => e.id));

    if (finalised.size === 0) {
      return NextResponse.json({
        results: leagueIds.map((id) => ({ leagueId: id, written: 0, skipped: 0 })),
        finalisedGameweeks: 0,
        message:
          'No gameweek has been finalised yet, so there is nothing to rebuild. Scores stay provisional until FPL marks a gameweek data-checked.',
      });
    }

    const db = getAdminDb();
    const results = [];

    for (const leagueId of leagueIds) {
      const history = await reconstructLeagueHistory(leagueId, finalised);
      if (!history) {
        results.push({ leagueId, error: 'League not found or empty' });
        continue;
      }

      let written = 0;
      let skipped = 0;

      for (const { gameweek, standings } of history.gameweeks) {
        const ref = db
          .collection('leagues')
          .doc(String(leagueId))
          .collection('gameweeks')
          .doc(`gw_${gameweek}`);

        const existing = await ref.get();
        if (existing.exists && existing.data()?.source !== 'reconstructed') {
          skipped += 1; // captured live at the time; leave it alone
          continue;
        }

        await ref.set({
          leagueId: history.leagueId,
          leagueName: history.leagueName,
          gameweek,
          totalMembers: standings.length,
          standings,
          source: 'reconstructed',
          updatedAt: new Date().toISOString(),
        });
        written += 1;
      }

      results.push({
        leagueId,
        leagueName: history.leagueName,
        memberCount: history.memberCount,
        written,
        skipped,
      });
    }

    return NextResponse.json({ results, finalisedGameweeks: finalised.size });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Rebuild failed' }, { status: 500 });
  }
}
