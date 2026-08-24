import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { isAdminConfigured, ADMIN_NOT_CONFIGURED, getAdminDb } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';
import { ANALYST_ENABLED, ANALYST_DISABLED_MESSAGE, finalisedEvents, gwDocId, seasonKey } from '@/lib/analyst';
import {
  analystPaths,
  readAccuracyHistory,
  readEliteSnapshot,
  writeAccuracy,
} from '@/lib/analyst-store';
import { loadFeatureInputs } from '@/lib/forecast-inputs';
import { buildFeatures } from '@/lib/feature-builder';
import { forecast } from '@/lib/forecast-engine';
import { scoreGameweek, evaluatePromotion } from '@/lib/backtest';
import { PlayerStatsGameweek } from '@/lib/player-stats';
import { ENTRY_FIELDS } from '@/lib/elite-cohort';
import { GameweekForecast } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Scores stored so far, plus whether elite features have earned promotion. */
export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }
  const bootstrap = await fetchFPLBootstrap();
  const season = seasonKey(bootstrap);
  const history = await readAccuracyHistory(season).catch(() => []);
  return NextResponse.json({
    season,
    scored: history.map((h) => h.gameweek),
    history,
    promotion: evaluatePromotion(history),
  });
}

/**
 * Replays a finalised gameweek and scores it.
 *
 * The forecast is rebuilt from data available BEFORE that gameweek rather than
 * read back from storage, so a gameweek can be scored even if no forecast was
 * generated at the time — and so a change to the model can be re-scored across
 * the whole season. buildFeatures only requests earlier gameweeks and
 * assertNoLookahead runs twice, which is what makes replaying honest rather
 * than a way to score the answer sheet against itself.
 *
 * Both variants are always scored, on the same population, because the
 * question is whether Elite Cohort Signals help — not whether they look good.
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
  const only = Number(body?.gameweek) || null;

  try {
    const bootstrap = await fetchFPLBootstrap();
    const season = seasonKey(bootstrap);
    const db = getAdminDb();

    const finalised = finalisedEvents(bootstrap).map((e) => e.id);
    // Nothing before GW2 can be scored: a forecast for GW1 would have no
    // earlier gameweek to learn from, and scoring it would only measure the
    // prior-season prior.
    const candidates = (only ? [only] : finalised).filter((gw) => gw >= 2 && finalised.includes(gw));

    if (!candidates.length) {
      return NextResponse.json({
        season,
        scored: [],
        message: finalised.length
          ? 'Nothing to score yet — scoring starts at GW2, since a GW1 forecast has no earlier gameweek behind it.'
          : 'No gameweek has been finalised yet. FPL keeps scores provisional until a gameweek is data-checked.',
      });
    }

    const scored = [];
    for (const gameweek of candidates.slice(0, 6)) {
      const statsSnap = await db
        .doc(analystPaths.playerStats(season))
        .collection('gameweeks')
        .doc(gwDocId(gameweek))
        .get();
      if (!statsSnap.exists) {
        scored.push({ gameweek, skipped: 'no stored player stats' });
        continue;
      }
      const stats = statsSnap.data() as PlayerStatsGameweek;

      const forecasts: Record<string, GameweekForecast> = {};
      for (const includeElite of [false, true]) {
        const inputs = await loadFeatureInputs(bootstrap, season, gameweek, { includeElite });
        const features = buildFeatures(inputs, { includeElite });
        const result = forecast(features, {
          fixtures: inputs.fixtures,
          teams: bootstrap.teams,
          scoring: bootstrap.scoring,
        });
        forecasts[includeElite ? 'elite' : 'base'] = result;

        // FPL's own projection, from the same pre-deadline snapshot the model
        // used. Captured once, from the base pass.
        if (!includeElite && inputs.market) {
          const i = inputs.market.fields.indexOf('ep_next');
          if (i !== -1) {
            const ep: Record<string, number> = {};
            for (const [id, values] of Object.entries(inputs.market.players)) {
              const v = Number(values[i]);
              if (!Number.isNaN(v)) ep[id] = v;
            }
            (forecasts as any).__ep = ep;
          }
        }
      }
      const epNext = (forecasts as any).__ep ?? null;
      delete (forecasts as any).__ep;

      // The human benchmark: what the cohort actually scored that week.
      const snapshot = await readEliteSnapshot(season, gameweek).catch(() => null);
      const pointsIndex = ENTRY_FIELDS.indexOf('points');
      const eliteManagerPoints = snapshot
        ? Object.values(snapshot.managers).map((m) => Number(m.entry[pointsIndex]) || 0)
        : undefined;

      const accuracy = scoreGameweek({
        season,
        gameweek,
        stats,
        forecasts,
        epNext,
        eliteManagerPoints,
        eliteAvailableManagerCount: snapshot?.availableManagerCount,
      });
      await writeAccuracy(accuracy);
      scored.push(accuracy);
    }

    const history = await readAccuracyHistory(season);
    return NextResponse.json({ season, scored, promotion: evaluatePromotion(history) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Backtest failed' }, { status: 500 });
  }
}
