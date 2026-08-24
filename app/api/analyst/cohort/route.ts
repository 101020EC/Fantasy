import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';
import { ANALYST_ENABLED, ANALYST_DISABLED_MESSAGE, seasonKey } from '@/lib/analyst';
import { buildCohort } from '@/lib/elite-cohort';
import { readEliteCohort, writeEliteCohort } from '@/lib/analyst-store';
import { ELITE_COHORT_IDS, ELITE_COHORT_QUALIFICATIONS } from '@/lib/elite-cohort-seed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** The cohort roster as stored, without any gameweek data. */
export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }
  const bootstrap = await fetchFPLBootstrap();
  const cohort = await readEliteCohort(seasonKey(bootstrap));
  return NextResponse.json({ cohort });
}

/**
 * Defines or updates the cohort: POST { managerIds: number[], qualifications?: {} }.
 * With an empty body it seeds from lib/elite-cohort-seed.ts, which is the
 * reviewable source of truth for who is in the cohort and why.
 *
 * Resolves each id against /entry/{id}/ so a typo shows up here as a missing
 * manager rather than as a silent gap in every future capture. `past` seasons
 * are stored as the evidence behind the Top 1K claim — they are the only
 * historical data the API exposes for these managers.
 */
export async function POST(req: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ANALYST_ENABLED) {
    return NextResponse.json({ error: ANALYST_DISABLED_MESSAGE }, { status: 503 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const requested = Array.isArray(body?.managerIds) ? body.managerIds : null;
  const managerIds: number[] = requested
    ? Array.from(
        new Set<number>(
          requested.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
        )
      ).slice(0, 100)
    : ELITE_COHORT_IDS;

  if (!managerIds.length) {
    return NextResponse.json({ error: 'Expected { managerIds: number[] }' }, { status: 400 });
  }

  const bootstrap = await fetchFPLBootstrap();
  const season = seasonKey(bootstrap);
  const cohort = await buildCohort(season, managerIds, {
    ...ELITE_COHORT_QUALIFICATIONS,
    ...(body?.qualifications ?? {}),
  });
  await writeEliteCohort(cohort);

  const resolved = Object.keys(cohort.managers).map(Number);
  return NextResponse.json({
    season,
    source: requested ? 'request' : 'seed',
    cohortSize: cohort.cohortSize,
    resolved: resolved.length,
    unresolved: managerIds.filter((id) => !resolved.includes(id)),
  });
}
