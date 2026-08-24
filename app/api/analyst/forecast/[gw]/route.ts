import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { getAdminDb, isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';
import { ANALYST_ENABLED, ANALYST_DISABLED_MESSAGE, gwDocId, seasonKey } from '@/lib/analyst';
import { analystPaths } from '@/lib/analyst-store';
import { loadFeatureInputs } from '@/lib/forecast-inputs';
import { buildFeatures } from '@/lib/feature-builder';
import { forecast } from '@/lib/forecast-engine';
import { LookaheadError } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Generates an expected-points forecast for one gameweek.
 *
 * GET previews without storing, so a forecast can be inspected before it is
 * committed. POST persists to forecasts/{season}/gameweeks/gw_{n}, which is
 * what makes accuracy measurable later — a prediction nobody wrote down cannot
 * be scored.
 *
 * `includeElite` defaults to FALSE in both. Elite Cohort Signals are a
 * hypothesis under test, and they earn a place in the numbers only by beating
 * the base model over at least 8 finalised gameweeks.
 */
async function run(req: NextRequest, gwParam: string, persist: boolean) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ANALYST_ENABLED) {
    return NextResponse.json({ error: ANALYST_DISABLED_MESSAGE }, { status: 503 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }

  const gameweek = Number(gwParam);
  if (!Number.isInteger(gameweek) || gameweek < 1 || gameweek > 38) {
    return NextResponse.json({ error: 'Gameweek must be 1-38' }, { status: 400 });
  }

  const includeElite = req.nextUrl.searchParams.get('includeElite') === 'true';
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 40, 200);

  try {
    const bootstrap = await fetchFPLBootstrap();
    const season = seasonKey(bootstrap);

    const inputs = await loadFeatureInputs(bootstrap, season, gameweek, { includeElite });
    const features = buildFeatures(inputs, { includeElite });
    const result = forecast(features, {
      fixtures: inputs.fixtures,
      teams: bootstrap.teams,
      scoring: bootstrap.scoring,
      calibration: inputs.calibration,
    });

    if (persist) {
      await getAdminDb()
        .doc(analystPaths.forecasts(season))
        .collection('gameweeks')
        .doc(gwDocId(gameweek))
        .set(result);
      await getAdminDb()
        .doc(analystPaths.forecasts(season))
        .set({ season, updatedAt: result.generatedAt, lastGameweek: gameweek }, { merge: true });
    }

    // The response carries a ranked top-N for display; the stored document
    // holds every player, because scoring later needs the whole population.
    const names = new Map(bootstrap.elements.map((e) => [e.id, e]));
    const teams = new Map(bootstrap.teams.map((t) => [t.id, t.short_name]));
    const top = Object.entries(result.predictions)
      .map(([id, p]) => {
        const el = names.get(Number(id));
        return {
          elementId: Number(id),
          name: el?.web_name ?? id,
          team: el ? teams.get(el.team) ?? '' : '',
          position: el?.element_type ?? 0,
          cost: el ? el.now_cost / 10 : 0,
          epNext: el?.ep_next ? Number(el.ep_next) : null,
          ...p,
        };
      })
      .sort((a, b) => b.xPts - a.xPts)
      .slice(0, limit);

    return NextResponse.json({
      season,
      gameweek,
      generatedAt: result.generatedAt,
      model: result.model,
      includeElite,
      persisted: persist,
      // Surfaced rather than buried: a forecast built on no history is a
      // structural guess, and the caller should be able to see that.
      qualityFlags: result.qualityFlags,
      featureSources: result.featureSources,
      playerCount: Object.keys(result.predictions).length,
      top,
    });
  } catch (err: any) {
    if (err instanceof LookaheadError) {
      return NextResponse.json({ error: err.message, kind: 'lookahead' }, { status: 422 });
    }
    return NextResponse.json({ error: err.message || 'Forecast failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ gw: string }> }) {
  return run(req, (await params).gw, false);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ gw: string }> }) {
  return run(req, (await params).gw, true);
}
