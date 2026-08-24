import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap, fetchFPLEntry, fetchFPLPicks } from '@/lib/fpl-api';
import { isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';
import { ANALYST_ENABLED, ANALYST_DISABLED_MESSAGE, seasonKey } from '@/lib/analyst';
import { loadFeatureInputs } from '@/lib/forecast-inputs';
import { buildFeatures } from '@/lib/feature-builder';
import { forecast } from '@/lib/forecast-engine';
import { optimiseTransfers, SquadPlayer } from '@/lib/transfer-optimizer';
import { getAllMarketPriceAnalyses } from '@/lib/price-calculator';
import { GameweekForecast, PriceAnalysis } from '@/lib/types';
import { getTelegramConfig } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Ranked transfer suggestions for the tracked team.
 *
 * Multi-gameweek by default: a swap that wins this week and loses the next two
 * is not an improvement, and fixture swings are the main reason to act early.
 * Price movement affects only the timing note, never whether a swap is
 * recommended — buying a player because he is about to rise is how you end up
 * with a squad chosen by the crowd.
 */
export async function GET(req: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ANALYST_ENABLED) {
    return NextResponse.json({ error: ANALYST_DISABLED_MESSAGE }, { status: 503 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }

  const params = req.nextUrl.searchParams;
  const horizon = Math.min(Math.max(Number(params.get('horizon')) || 3, 1), 6);

  try {
    const bootstrap = await fetchFPLBootstrap();
    const season = seasonKey(bootstrap);
    const teamId = params.get('teamId') || (await getTelegramConfig()).teamId;

    if (!teamId) {
      return NextResponse.json(
        { error: 'No team to advise on. Pass ?teamId= or set the tracked team in alert settings.' },
        { status: 400 }
      );
    }

    const next =
      bootstrap.events.find((e) => e.is_next)?.id ??
      bootstrap.events.find((e) => e.is_current)?.id ??
      1;

    // The most recent confirmed squad. Picks for an upcoming gameweek stay
    // private until its deadline passes.
    let picks = null;
    for (let gw = next - 1; gw >= Math.max(1, next - 3) && !picks; gw--) {
      picks = await fetchFPLPicks(teamId, gw).catch(() => null);
    }
    if (!picks?.picks?.length) {
      return NextResponse.json(
        { error: `No confirmed squad found for team ${teamId} in the last three gameweeks.` },
        { status: 404 }
      );
    }

    const entry = await fetchFPLEntry(teamId).catch(() => null);
    const bank = Number((picks as any).entry_history?.bank ?? entry?.last_deadline_bank ?? 0);

    // FPL does not expose banked free transfers, so it is assumed to be one
    // and stated rather than guessed at silently.
    const freeTransfers = Math.max(0, Math.min(Number(params.get('freeTransfers')) || 1, 5));

    const forecasts: GameweekForecast[] = [];
    for (let gw = next; gw < next + horizon && gw <= 38; gw++) {
      const inputs = await loadFeatureInputs(bootstrap, season, gw, { includeElite: false });
      const features = buildFeatures(inputs, { includeElite: false });
      forecasts.push(
        forecast(features, {
          fixtures: inputs.fixtures,
          teams: bootstrap.teams,
          scoring: bootstrap.scoring,
          calibration: inputs.calibration,
        })
      );
    }

    // Selling price is not public, so purchase price is used. That understates
    // the budget for a player who has risen, which errs towards suggesting
    // fewer affordable swaps rather than recommending one the manager cannot make.
    const elements = new Map(bootstrap.elements.map((e) => [e.id, e]));
    const squad: SquadPlayer[] = picks.picks.map((p) => ({
      elementId: p.element,
      sellingPrice: elements.get(p.element)?.now_cost ?? 0,
    }));

    const priceAnalyses = new Map<number, PriceAnalysis>();
    for (const a of getAllMarketPriceAnalyses(bootstrap)) priceAnalyses.set(a.elementId, a);

    const result = optimiseTransfers({
      bootstrap,
      forecasts,
      squad,
      bank,
      freeTransfers,
      priceAnalyses,
    });

    return NextResponse.json({
      season,
      teamId,
      fromGameweek: next,
      horizon: result.horizon,
      bank: bank / 10,
      freeTransfers,
      assumedFreeTransfers: !params.get('freeTransfers'),
      qualityFlags: forecasts[0]?.qualityFlags ?? [],
      note: result.note,
      unassessed: result.unassessed.map((p) => ({ elementId: p.elementId, name: p.name, teamShort: p.teamShort })),
      suggestions: result.suggestions,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not build suggestions' }, { status: 500 });
  }
}
