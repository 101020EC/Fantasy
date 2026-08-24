import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap, fetchFPLFixtures } from '@/lib/fpl-api';
import { buildMarketSnapshot } from '@/lib/market-snapshot';
import { getAdminDb, isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { ANALYST_ENABLED, finalisedEvents, seasonKey } from '@/lib/analyst';
import { buildSeasonFixtures } from '@/lib/fixtures-store';
import { buildPlayerPriors, buildPlayerStatsDoc, sweepPlayerStats } from '@/lib/player-stats';
import { captureEliteGameweek, computeEliteDerived } from '@/lib/elite-cohort';
import {
  readEliteCohort,
  storedEliteGameweeks,
  storedPlayerStatGameweeks,
  writeEliteGameweek,
  writePlayerPriors,
  writePlayerStats,
  writeSeasonFixtures,
} from '@/lib/analyst-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // firebase-admin cannot run on the Edge runtime
// Vercel Hobby caps a function at 60s. The analyst steps stay inside it by
// sweeping players with bounded concurrency, and by handling at most one
// gameweek per run; the market capture above has already committed regardless.
export const maxDuration = 60;

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

    // ── Analyst steps ────────────────────────────────────────────────────
    // Everything below is additive and OFF by default. It runs only after the
    // market capture above has committed, and each step carries its own
    // try/catch so a failure here can never cost a day of market data — which
    // is the one thing in this job that cannot be re-fetched later.
    const analyst = ANALYST_ENABLED
      ? await runAnalystSteps(bootstrap)
      : { enabled: false };

    return NextResponse.json({
      captured: true,
      date: snapshot.date,
      gameweek: snapshot.gameweek,
      playerCount: snapshot.playerCount,
      fields: snapshot.fields.length,
      rosterUpdated: rosterChanged,
      analyst,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error capturing market snapshot' },
      { status: 500 }
    );
  }
}

/**
 * Fixtures, player stats and the elite cohort.
 *
 * A no-op on roughly six days out of seven: the gameweek captures are gated on
 * `data_checked` and skip anything already stored, so the usual cost is one
 * comparison. Never throws — every failure is reported in the response instead,
 * because this runs behind a cron that only reads a status code.
 */
async function runAnalystSteps(bootstrap: any) {
  const season = seasonKey(bootstrap);
  const results: Record<string, any> = { enabled: true, season };

  // Fixtures — cheap, and needed by the feature builder to tell a blank
  // gameweek from a double.
  try {
    const fixtures = await fetchFPLFixtures();
    if (fixtures.length) {
      await writeSeasonFixtures(buildSeasonFixtures(season, fixtures));
      results.fixtures = { written: fixtures.length };
    } else {
      results.fixtures = { skipped: 'FPL returned no fixtures' };
    }
  } catch (err: any) {
    results.fixtures = { error: err.message };
  }

  const finalised = finalisedEvents(bootstrap).map((e) => e.id);

  // Player stats — the training signal. ~600 sequential requests, so this only
  // runs for a gameweek that has just been finalised and is not already stored.
  try {
    const stored = await storedPlayerStatGameweeks(season);
    const pending = finalised.filter((gw) => !stored.includes(gw));
    if (!pending.length) {
      results.playerStats = { upToDate: true, stored: stored.length };
    } else {
      // One gameweek per run. Two finalising at once is rare, and the next
      // night picks up the remainder.
      const gw = pending[0];
      const { byGameweek, progress, priors } = await sweepPlayerStats(bootstrap, {
        gameweeks: [gw],
      });
      const players = byGameweek.get(gw) ?? {};
      const doc = buildPlayerStatsDoc(season, gw, players);
      await writePlayerStats(doc);
      // Free: the same responses carry each player's past seasons.
      await writePlayerPriors(buildPlayerPriors(season, priors));
      results.playerStats = {
        gameweek: gw,
        playerCount: doc.playerCount,
        doubles: doc.doubleGameweekPlayers.length,
        failed: progress.failed.length,
        remaining: pending.length - 1,
      };
    }
  } catch (err: any) {
    results.playerStats = { error: err.message };
  }

  // Elite cohort — perishable. A manager who deletes their team takes their
  // past gameweeks with them, so this is the step worth running early.
  try {
    const cohort = await readEliteCohort(season);
    if (!cohort?.managerIds?.length) {
      results.eliteCohort = { skipped: 'no cohort configured' };
    } else {
      const stored = await storedEliteGameweeks(season);
      const pending = finalised.filter((gw) => !stored.includes(gw));
      if (!pending.length) {
        results.eliteCohort = { upToDate: true, stored: stored.length };
      } else {
        const gw = pending[0];
        const snapshot = await captureEliteGameweek(season, gw, cohort.managerIds);
        await writeEliteGameweek(snapshot, computeEliteDerived(snapshot));
        results.eliteCohort = {
          gameweek: gw,
          availableManagerCount: snapshot.availableManagerCount,
          cohortSize: snapshot.cohortSize,
          missing: snapshot.missing,
          remaining: pending.length - 1,
        };
      }
    }
  } catch (err: any) {
    results.eliteCohort = { error: err.message };
  }

  return results;
}
