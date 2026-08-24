import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap, fetchFPLFixtures } from '@/lib/fpl-api';
import { isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';
import { ANALYST_ENABLED, ANALYST_DISABLED_MESSAGE, finalisedEvents, seasonKey } from '@/lib/analyst';
import { buildPlayerPriors, buildPlayerStatsDoc, sweepPlayerStats } from '@/lib/player-stats';
import { buildSeasonFixtures } from '@/lib/fixtures-store';
import {
  readPlayerPriors,
  storedPlayerStatGameweeks,
  writePlayerPriors,
  writePlayerStats,
  writeSeasonFixtures,
} from '@/lib/analyst-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * One-off sweep of /element-summary/ for every finalised gameweek not yet stored.
 *
 * Deliberately a separate route from the cron, so a full ~600-request sweep can
 * never be triggered by the schedule. Bounded: `maxGameweeks` caps the work per
 * call and the response reports what is left, so a large backfill is several
 * small calls rather than one that times out.
 *
 * Only data_checked gameweeks are written, and only ones missing — re-running
 * is safe and cheap.
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
  const maxGameweeks = Math.min(Math.max(Number(body?.maxGameweeks) || 1, 1), 3);

  try {
    const bootstrap = await fetchFPLBootstrap();
    const season = seasonKey(bootstrap);
    const finalised = finalisedEvents(bootstrap).map((e) => e.id);

    // Fixtures first: cheap, and the feature builder needs them to distinguish
    // a blank gameweek from a double.
    const fixtures = await fetchFPLFixtures();
    if (fixtures.length) await writeSeasonFixtures(buildSeasonFixtures(season, fixtures));

    const stored = finalised.length ? await storedPlayerStatGameweeks(season) : [];
    const pending = finalised.filter((gw) => !stored.includes(gw));
    const batch = pending.slice(0, maxGameweeks);

    // Prior seasons come from the same endpoint and do not depend on any
    // gameweek being finalised — they are what makes a GW1 forecast better
    // than a position average, so they are worth a sweep on their own.
    const havePriors = Boolean(await readPlayerPriors(season));
    const needPriors = !havePriors || body?.refreshPriors === true;

    if (!batch.length && !needPriors) {
      return NextResponse.json({
        season,
        written: [],
        remaining: [],
        upToDate: true,
        stored,
        message: finalised.length
          ? undefined
          : 'No gameweek has been finalised yet. FPL keeps scores provisional until a gameweek is data-checked.',
      });
    }

    // One sweep covers every requested gameweek and the priors at once —
    // element-summary returns a player's whole season plus his past ones, so
    // fetching separately would repeat the same ~600 requests.
    const { byGameweek, progress, priors } = await sweepPlayerStats(bootstrap, {
      gameweeks: batch,
    });

    let priorsWritten = null;
    if (needPriors) {
      const doc = buildPlayerPriors(season, priors);
      await writePlayerPriors(doc);
      priorsWritten = { playerCount: doc.playerCount, sourceSeason: doc.sourceSeason };
    }

    const written = [];
    for (const gw of batch) {
      const doc = buildPlayerStatsDoc(season, gw, byGameweek.get(gw) ?? {});
      await writePlayerStats(doc);
      written.push({
        gameweek: gw,
        playerCount: doc.playerCount,
        doubles: doc.doubleGameweekPlayers.length,
      });
    }

    return NextResponse.json({
      season,
      written,
      remaining: pending.slice(maxGameweeks),
      priors: priorsWritten,
      playersFetched: progress.fetched,
      playersFailed: progress.failed.length,
      fixtures: fixtures.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Backfill failed' }, { status: 500 });
  }
}
