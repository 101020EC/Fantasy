import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap, fetchFPLEntry, fetchFPLPicks, fetchFPLTransfers } from '@/lib/fpl-api';
import { squadSellingPrices } from '@/lib/squad-value';
import { isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';
import { ANALYST_ENABLED, ANALYST_DISABLED_MESSAGE, seasonKey } from '@/lib/analyst';
import { loadFeatureInputs, ReadMemo } from '@/lib/forecast-inputs';
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
/**
 * Each step's duration, sent as a `Server-Timing` header so the browser's
 * network panel shows where the time goes. Parallel steps are timed on their
 * own, so they can add up to more than `total`.
 */
function stepTimer() {
  const started = performance.now();
  const steps: string[] = [];
  return {
    async time<T>(name: string, run: () => Promise<T> | T): Promise<T> {
      const s = performance.now();
      try {
        return await run();
      } finally {
        steps.push(`${name};dur=${(performance.now() - s).toFixed(1)}`);
      }
    },
    header: () => [...steps, `total;dur=${(performance.now() - started).toFixed(1)}`].join(', '),
  };
}

export async function GET(req: NextRequest) {
  const timer = stepTimer();
  if (!(await timer.time('auth', () => requireSession()))) {
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
    const bootstrap = await timer.time('bootstrap', () => fetchFPLBootstrap());
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
    const latestPicks = async () => {
      for (let gw = next - 1; gw >= Math.max(1, next - 3); gw--) {
        const p = await fetchFPLPicks(teamId, gw).catch(() => null);
        if (p) return p;
      }
      return null;
    };

    // One memo for this request: the horizon gameweeks share most of their reads.
    const reads: ReadMemo = new Map();
    const horizonGws: number[] = [];
    for (let gw = next; gw < next + horizon && gw <= 38; gw++) horizonGws.push(gw);

    // None of these depend on each other: the squad, the bank and each
    // gameweek's inputs are fetched together rather than one after another.
    const [picks, entry, transfers, inputsByGw] = await Promise.all([
      timer.time('picks', latestPicks),
      timer.time('entry', () => fetchFPLEntry(teamId).catch(() => null)),
      timer.time('transfers', () => fetchFPLTransfers(teamId)),
      timer.time('inputs', () =>
        Promise.all(
          horizonGws.map((gw) =>
            loadFeatureInputs(bootstrap, season, gw, { includeElite: false, memo: reads })
          )
        )
      ),
    ]);

    if (!picks?.picks?.length) {
      return NextResponse.json(
        { error: `No confirmed squad found for team ${teamId} in the last three gameweeks.` },
        { status: 404 }
      );
    }

    const bank = Number((picks as any).entry_history?.bank ?? entry?.last_deadline_bank ?? 0);

    // FPL does not expose banked free transfers, so it is assumed to be one
    // and stated rather than guessed at silently.
    const freeTransfers = Math.max(0, Math.min(Number(params.get('freeTransfers')) || 1, 5));

    const forecasts: GameweekForecast[] = await timer.time('forecast', () =>
      inputsByGw.map((inputs) =>
        forecast(buildFeatures(inputs, { includeElite: false }), {
          fixtures: inputs.fixtures,
          teams: bootstrap.teams,
          scoring: bootstrap.scoring,
          calibration: inputs.calibration,
        })
      )
    );

    // What a sale actually frees: FPL returns only half of a rise, rounded down.
    // `now_cost` would overstate the budget and suggest swaps that cannot be made.
    const selling = squadSellingPrices(picks.picks, bootstrap.elements, transfers);
    const squad: SquadPlayer[] = picks.picks.map((p) => ({
      elementId: p.element,
      sellingPrice: selling.get(p.element) ?? 0,
    }));

    const priceAnalyses = new Map<number, PriceAnalysis>();
    const analyses = await timer.time('prices', () => getAllMarketPriceAnalyses(bootstrap));
    for (const a of analyses) priceAnalyses.set(a.elementId, a);

    const result = await timer.time('optimise', () =>
      optimiseTransfers({
        bootstrap,
        forecasts,
        squad,
        bank,
        freeTransfers,
        priceAnalyses,
      })
    );

    const res = NextResponse.json({
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
    res.headers.set('Server-Timing', timer.header());
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not build suggestions' }, { status: 500 });
  }
}
