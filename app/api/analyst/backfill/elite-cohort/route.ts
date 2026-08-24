import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';
import { ANALYST_ENABLED, ANALYST_DISABLED_MESSAGE, finalisedEvents, seasonKey } from '@/lib/analyst';
import { captureEliteGameweek, computeEliteDerived } from '@/lib/elite-cohort';
import { readEliteCohort, storedEliteGameweeks, writeEliteGameweek } from '@/lib/analyst-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Captures finalised gameweeks the cohort is missing.
 *
 * "Backfill" only within the current season — previous seasons are genuinely
 * unavailable (/entry/{id}/event/{gw}/picks/ 404s outside the current season),
 * which is why the cohort is forward-tracking by design.
 *
 * Worth running as soon as a gameweek finalises rather than leaving it to the
 * nightly job: if a manager deletes their team, their past picks stop being
 * fetchable and cannot be recovered from anywhere.
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

  const body = await req.json().catch(() => ({}));
  const maxGameweeks = Math.min(Math.max(Number(body?.maxGameweeks) || 2, 1), 5);

  try {
    const bootstrap = await fetchFPLBootstrap();
    const season = seasonKey(bootstrap);
    const cohort = await readEliteCohort(season);

    if (!cohort?.managerIds?.length) {
      return NextResponse.json(
        { error: 'No cohort configured. POST /api/analyst/cohort with { managerIds } first.' },
        { status: 400 }
      );
    }

    const finalised = finalisedEvents(bootstrap).map((e) => e.id);
    if (!finalised.length) {
      return NextResponse.json({
        season,
        written: [],
        message:
          'No gameweek has been finalised yet. Picks are captured only once FPL marks a gameweek data-checked, because a live week still moves.',
      });
    }

    const stored = await storedEliteGameweeks(season);
    const pending = finalised.filter((gw) => !stored.includes(gw)).slice(0, maxGameweeks);

    const written = [];
    for (const gw of pending) {
      const snapshot = await captureEliteGameweek(season, gw, cohort.managerIds);
      const derived = computeEliteDerived(snapshot);
      await writeEliteGameweek(snapshot, derived);
      written.push({
        gameweek: gw,
        cohortSize: snapshot.cohortSize,
        availableManagerCount: snapshot.availableManagerCount,
        // Surfaced, never smoothed over: a missing manager shrinks the
        // denominator rather than counting as 0% ownership.
        missing: snapshot.missing,
        chips: derived.chips,
        captainEntropy: derived.consensus.captainEntropy,
      });
    }

    return NextResponse.json({ season, written, stored });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Capture failed' }, { status: 500 });
  }
}
