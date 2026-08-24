import { NextResponse } from 'next/server';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { getAdminDb, isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';
import { ANALYST_ENABLED, finalisedEvents, seasonKey } from '@/lib/analyst';
import {
  analystPaths,
  readEliteCohort,
  storedEliteGameweeks,
  storedPlayerStatGameweeks,
} from '@/lib/analyst-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Coverage of the analyst collections — what has been captured, what is still
 * pending, and why. Read-only; safe to hit at any time, including while the
 * feature is switched off.
 *
 * Uses .select() projections rather than reading whole documents, the idiom
 * app/api/market/status/route.ts established: a playerStats gameweek is ~45KB
 * and none of it is needed to answer "does this exist".
 */
export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bootstrap = await fetchFPLBootstrap();
  const season = seasonKey(bootstrap);
  const finalised = finalisedEvents(bootstrap).map((e) => e.id);
  const current = bootstrap.events.find((e) => e.is_current)?.id ?? null;

  const base = {
    enabled: ANALYST_ENABLED,
    season,
    currentGameweek: current,
    finalisedGameweeks: finalised,
  };

  if (!isAdminConfigured) {
    return NextResponse.json({ ...base, error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }

  const db = getAdminDb();
  const [playerStats, elite, cohort, fixtures] = await Promise.all([
    storedPlayerStatGameweeks(season).catch((): number[] => []),
    storedEliteGameweeks(season).catch((): number[] => []),
    readEliteCohort(season).catch(() => null),
    db.doc(analystPaths.fixtures(season)).get().then((s) => s.data() ?? null).catch(() => null),
  ]);

  return NextResponse.json({
    ...base,
    playerStats: {
      stored: playerStats,
      pending: finalised.filter((gw) => !playerStats.includes(gw)),
    },
    eliteCohort: {
      configured: Boolean(cohort?.managerIds?.length),
      cohortSize: cohort?.cohortSize ?? 0,
      stored: elite,
      pending: finalised.filter((gw) => !elite.includes(gw)),
    },
    fixtures: fixtures
      ? { updatedAt: fixtures.updatedAt, fixtureCount: fixtures.fixtureCount }
      : null,
    // Stated plainly because it is the usual reason nothing has been captured:
    // a live gameweek still moves, so nothing provisional is ever stored.
    note: finalised.length
      ? undefined
      : 'No gameweek is data_checked yet, so there is nothing to capture. Scores stay provisional until FPL finalises a gameweek.',
  });
}
