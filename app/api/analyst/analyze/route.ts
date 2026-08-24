import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap, fetchFPLPicks } from '@/lib/fpl-api';
import { isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';
import { ANALYST_ENABLED, ANALYST_DISABLED_MESSAGE, seasonKey } from '@/lib/analyst';
import { readEliteDerived } from '@/lib/analyst-store';
import { loadFeatureInputs } from '@/lib/forecast-inputs';
import { buildFeatures } from '@/lib/feature-builder';
import { forecast } from '@/lib/forecast-engine';
import { buildAnalysisContext, buildUserPrompt, findUngroundedNumbers, SYSTEM_PROMPT } from '@/lib/analysis';
import { complete, getLLMConfig } from '@/lib/openai';
import { SeasonFixtures } from '@/lib/fixtures-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Which clubs play whom in a gameweek, so the prose can name the opponent. */
function fixtureByClub(fixtures: SeasonFixtures | null, gameweek: number) {
  const out = new Map<number, { opponent: number; isHome: boolean }[]>();
  if (!fixtures) return out;
  const F = (n: string) => fixtures.fields.indexOf(n);
  for (const v of Object.values(fixtures.fixtures)) {
    if (Number(v[F('event')]) !== gameweek) continue;
    const h = Number(v[F('team_h')]);
    const a = Number(v[F('team_a')]);
    if (!out.has(h)) out.set(h, []);
    if (!out.has(a)) out.set(a, []);
    out.get(h)!.push({ opponent: a, isHome: true });
    out.get(a)!.push({ opponent: h, isHome: false });
  }
  return out;
}

/**
 * Explains a forecast in prose.
 *
 * The forecast is computed here first and passed to the model as fact. The
 * model receives numbers and returns sentences; it is never asked what a
 * player will score. What comes back is checked against the numbers that went
 * in, and any figure that did not is reported alongside the text rather than
 * quietly removed — a model inventing projections is precisely the failure
 * worth seeing.
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

  const cfg = await getLLMConfig();
  if (!cfg.configured) {
    // 503 with an explanation, not a crash: the forecast itself works without
    // a key, and only the commentary is unavailable.
    return NextResponse.json(
      {
        error:
          'No language model is configured. Add a key in analyst settings, or set OPENAI_API_KEY. The forecast works without it — only the written explanation needs it.',
        configured: false,
      },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const question = typeof body?.question === 'string' ? body.question.slice(0, 400) : undefined;
  const teamId = Number(body?.teamId) || null;

  try {
    const bootstrap = await fetchFPLBootstrap();
    const season = seasonKey(bootstrap);
    const gameweek =
      Number(body?.gameweek) ||
      bootstrap.events.find((e) => e.is_next)?.id ||
      bootstrap.events.find((e) => e.is_current)?.id ||
      1;

    const inputs = await loadFeatureInputs(bootstrap, season, gameweek, { includeElite: false });
    const features = buildFeatures(inputs, { includeElite: false });
    const result = forecast(features, {
      fixtures: inputs.fixtures,
      teams: bootstrap.teams,
      scoring: bootstrap.scoring,
      calibration: inputs.calibration,
    });

    // The squad is the manager's most recent confirmed picks. Picks for an
    // upcoming gameweek are not public until its deadline passes.
    let squadElementIds: number[] | undefined;
    if (teamId) {
      for (let gw = gameweek - 1; gw >= Math.max(1, gameweek - 3); gw--) {
        const picks = await fetchFPLPicks(teamId, gw).catch(() => null);
        if (picks?.picks?.length) {
          squadElementIds = picks.picks.map((p) => p.element);
          break;
        }
      }
    }

    // Elite signals are allowed here even though they stay out of the numbers.
    // "14 of 20 elite managers captain him" is exactly the kind of statement
    // prose should carry, and it is fully verifiable.
    const elite = await readEliteDerived(season, gameweek - 1).catch(() => null);

    const ctx = buildAnalysisContext(result, bootstrap, {
      squadElementIds,
      elite,
      fixtureByClub: fixtureByClub(inputs.fixtures, gameweek),
    });

    const completion = await complete(cfg, SYSTEM_PROMPT, buildUserPrompt(ctx, question));
    if (!completion.ok) {
      return NextResponse.json({ error: completion.error, configured: true }, { status: 502 });
    }

    const ungrounded = findUngroundedNumbers(completion.text!, ctx);

    return NextResponse.json({
      season,
      gameweek,
      model: completion.model,
      provider: cfg.provider,
      squadUsed: Boolean(squadElementIds),
      eliteUsed: Boolean(elite),
      qualityFlags: result.qualityFlags,
      analysis: completion.text,
      // Empty in the normal case. Non-empty means the model stated a decimal
      // that was not in its inputs, which the reader should know before acting.
      ungroundedNumbers: ungrounded,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Analysis failed' }, { status: 500 });
  }
}
