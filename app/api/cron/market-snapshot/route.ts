import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap, fetchFPLFixtures } from '@/lib/fpl-api';
import { buildMarketSnapshot } from '@/lib/market-snapshot';
import { getAdminDb, isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { ANALYST_ENABLED, finalisedEvents, seasonKey } from '@/lib/analyst';
import { buildSeasonFixtures } from '@/lib/fixtures-store';
import { buildPlayerPriors, buildPlayerStatsDoc, sweepPlayerStats } from '@/lib/player-stats';
import { captureEliteGameweek, computeEliteDerived, ENTRY_FIELDS } from '@/lib/elite-cohort';
import { buildArchivePayload, writeArchive } from '@/lib/archive';
import { getTelegramConfig } from '@/lib/telegram';
import { loadFeatureInputs } from '@/lib/forecast-inputs';
import { buildFeatures } from '@/lib/feature-builder';
import { forecast } from '@/lib/forecast-engine';
import { scoreGameweek, actualPoints } from '@/lib/backtest';
import { CalibrationObservation, fitCalibration } from '@/lib/calibration';
import { PlayerStatsGameweek } from '@/lib/player-stats';
import { GameweekForecast } from '@/lib/types';
import {
  analystPaths,
  readAccuracyHistory,
  readCalibration,
  readForecast,
  readPlayerPriors,
  readEliteCohort,
  readEliteSnapshot,
  writeAccuracy,
  writeCalibration,
  writeForecast,
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
 * Fixtures, player stats, the elite cohort, scoring, calibration and the
 * forecast, in that order.
 *
 * The order matters in one place: scoring must precede calibration, and
 * calibration must precede the forecast, so the projection written tonight uses
 * the correction fitted from the gameweek scored tonight rather than lagging a
 * day behind it.
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

  // Prior seasons, if this database has none.
  //
  // These used to be written only as a by-product of capturing a finalised
  // gameweek, which meant a fresh deployment had none until the first week was
  // data-checked — and without them the model has no evidence about anybody, so
  // every projection came out as zero. They do not depend on a gameweek at all:
  // element-summary ships each player's past seasons and always has.
  try {
    if (await readPlayerPriors(season)) {
      results.playerPriors = { present: true };
    } else {
      const { priors } = await sweepPlayerStats(bootstrap, { gameweeks: [] });
      const doc = buildPlayerPriors(season, priors);
      await writePlayerPriors(doc);
      results.playerPriors = { written: doc.playerCount, sourceSeason: doc.sourceSeason };
    }
  } catch (err: any) {
    results.playerPriors = { error: err.message };
  }

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

  // Risk F-1: the team archive had no scheduled trigger at all — it only ran
  // from a useEffect when someone opened the team page with leagues selected.
  // A gameweek nobody looked at was never archived, and FPL keeps serving the
  // picks, so the gap was silent and a backtest over "my squad each week" had
  // holes by construction.
  try {
    const teamId = (await getTelegramConfig()).teamId;
    if (!teamId) {
      results.teamArchive = { skipped: 'no tracked team configured' };
    } else {
      const db = getAdminDb();
      const missing: number[] = [];
      for (const gw of finalised) {
        const doc = await db.collection('teams').doc(String(teamId)).collection('gameweeks').doc(`gw_${gw}`).get();
        // Re-archive a snapshot taken while the gameweek was still live: FPL
        // revises those, and merge:true would otherwise leave the wrong value.
        if (!doc.exists || doc.data()?.dataChecked !== true) missing.push(gw);
      }
      const batch = missing.slice(0, 3);
      for (const gw of batch) {
        const existing = await db.collection('teams').doc(String(teamId)).get();
        const leagueIds: number[] = existing.data()?.selectedLeagueIds ?? [];
        const payload = await buildArchivePayload(teamId, gw, leagueIds);
        await writeArchive(payload, { dataChecked: true, source: 'cron' });
      }
      results.teamArchive = { teamId, archived: batch, remaining: missing.length - batch.length };
    }
  } catch (err: any) {
    results.teamArchive = { error: err.message };
  }

  // Score any finalised gameweek not yet scored. Both model variants, on one
  // population, every week — the elite variant is a hypothesis under test and
  // only sustained evidence promotes it.
  try {
    const history = await readAccuracyHistory(season).catch(() => []);
    const done = new Set(history.map((h) => h.gameweek));
    const pending = finalised.filter((gw) => gw >= 2 && !done.has(gw));
    if (!pending.length) {
      results.backtest = { upToDate: true, scored: history.length };
    } else {
      const db = getAdminDb();
      const gameweek = pending[0];
      const statsSnap = await db.doc(analystPaths.playerStats(season)).collection('gameweeks').doc(`gw_${gameweek}`).get();
      if (!statsSnap.exists) {
        results.backtest = { gameweek, skipped: 'player stats not captured yet' };
      } else {
        const forecasts: Record<string, GameweekForecast> = {};
        let epNext: Record<string, number> | null = null;

        // What the app actually published before the deadline, scored alongside
        // the replays. Without it the accuracy figures describe a forecast
        // nobody ever saw: the replays are rebuilt with today's engine, so every
        // model fix silently rewrites the whole history in its own favour.
        const published = await readForecast(season, gameweek).catch(() => null);
        if (published) forecasts.as_published = published;
        for (const includeElite of [false, true]) {
          const inputs = await loadFeatureInputs(bootstrap, season, gameweek, { includeElite });
          const features = buildFeatures(inputs, { includeElite });
          forecasts[includeElite ? 'elite' : 'base'] = forecast(features, {
            fixtures: inputs.fixtures, teams: bootstrap.teams,
            scoring: bootstrap.scoring, calibration: inputs.calibration,
          });
          if (!includeElite && inputs.market) {
            const i = inputs.market.fields.indexOf('ep_next');
            if (i !== -1) {
              epNext = {};
              for (const [id, v] of Object.entries(inputs.market.players)) {
                const n = Number(v[i]);
                if (!Number.isNaN(n)) epNext[id] = n;
              }
            }
          }
        }
        const snapshot = await readEliteSnapshot(season, gameweek).catch(() => null);
        const pi = ENTRY_FIELDS.indexOf('points');
        const accuracy = scoreGameweek({
          season, gameweek,
          stats: statsSnap.data() as PlayerStatsGameweek,
          forecasts, epNext,
          eliteManagerPoints: snapshot
            ? Object.values(snapshot.managers).map((m) => Number(m.entry[pi]) || 0)
            : undefined,
          eliteAvailableManagerCount: snapshot?.availableManagerCount,
        });
        await writeAccuracy(accuracy);
        results.backtest = {
          gameweek, n: accuracy.n,
          base: accuracy.models.base?.mae, elite: accuracy.models.elite?.mae,
          epNext: accuracy.models.ep_next?.mae,
          remaining: pending.length - 1,
        };
      }
    }
  } catch (err: any) {
    results.backtest = { error: err.message };
  }

  // Fit the correction that the NEXT gameweek's forecast will use, from every
  // gameweek already scored. Stored against the gameweek it may be used for, so
  // a later replay of that gameweek picks up the same factors and cannot reach
  // forward into results that had not happened yet.
  try {
    const next = bootstrap.events.find((e: any) => e.is_next)?.id;
    if (!next) {
      results.calibration = { skipped: 'no next gameweek' };
    } else {
      const db = getAdminDb();
      const elementType = new Map(bootstrap.elements.map((e: any) => [e.id, e.element_type]));
      const scored = await readAccuracyHistory(season).catch(() => []);
      const observations: CalibrationObservation[] = [];

      // Only gameweeks with BOTH a published forecast and finalised stats. A
      // replay would do here too, but fitting on the replay and then correcting
      // the replay is a loop that converges on its own opinion.
      for (const row of scored) {
        const [fc, statsSnap] = await Promise.all([
          readForecast(season, row.gameweek).catch(() => null),
          db
            .doc(analystPaths.playerStats(season))
            .collection('gameweeks')
            .doc(`gw_${row.gameweek}`)
            .get(),
        ]);
        if (!fc || !statsSnap.exists) continue;
        const stats = statsSnap.data() as PlayerStatsGameweek;
        for (const [id, p] of Object.entries(fc.predictions)) {
          // Fit on the UNCALIBRATED projection. Fitting on an already-corrected
          // number compounds last week's factor into this week's.
          const predicted = p.rawXPts ?? p.xPts;
          if (predicted <= 0) continue;
          observations.push({
            gameweek: row.gameweek,
            elementId: Number(id),
            elementType: Number(elementType.get(Number(id))) || 0,
            predicted,
            actual: actualPoints(stats, Number(id)),
          });
        }
      }

      const fitted = fitCalibration(season, observations);
      await writeCalibration(fitted, next);
      results.calibration = {
        forGameweek: next,
        fittedOn: fitted.sourceGameweeks,
        observations: observations.length,
        positions: fitted.positionFactor,
        players: Object.keys(fitted.playerFactor).length,
        notes: fitted.notes,
      };
    }
  } catch (err: any) {
    results.calibration = { error: err.message };
  }

  // A forecast for the next gameweek, stored so it can be scored later. A
  // prediction nobody wrote down cannot be measured against anything — and it
  // is scored as `as_published` above, against exactly this document.
  //
  // Last, deliberately: it reads the calibration the step above just wrote.
  try {
    const next = bootstrap.events.find((e: any) => e.is_next)?.id;
    if (!next) {
      results.forecast = { skipped: 'no next gameweek' };
    } else {
      const inputs = await loadFeatureInputs(bootstrap, season, next, { includeElite: false });
      const features = buildFeatures(inputs, { includeElite: false });
      const result = forecast(features, {
        fixtures: inputs.fixtures,
        teams: bootstrap.teams,
        scoring: bootstrap.scoring,
        calibration: inputs.calibration,
      });
      await writeForecast(result);
      results.forecast = { gameweek: next, players: Object.keys(result.predictions).length, flags: result.qualityFlags };
    }
  } catch (err: any) {
    results.forecast = { error: err.message };
  }

  return results;
}
