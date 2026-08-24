import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap, fetchFPLPicks } from '@/lib/fpl-api';
import { isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';
import { ANALYST_ENABLED, ANALYST_DISABLED_MESSAGE, seasonKey } from '@/lib/analyst';
import { readEliteDerived } from '@/lib/analyst-store';
import { loadFeatureInputs } from '@/lib/forecast-inputs';
import { buildFeatures } from '@/lib/feature-builder';
import { COMPUTE_VERSION, forecast } from '@/lib/forecast-engine';
import {
  AnalysisContext,
  buildAnalysisContext,
  buildUserPrompt,
  findUngroundedNumbers,
  SYSTEM_PROMPT,
} from '@/lib/analysis';
import { complete, getLLMConfig } from '@/lib/openai';
import { AI_BUDGET_EXCEEDED, budgetStatusForDisplay, getBudgetStatus } from '@/lib/ai-budget';
import {
  AiJobRecord,
  JobSpec,
  StepHandler,
  checkResumable,
  jobView,
  runJob,
  startOrRejoinJob,
} from '@/lib/ai-jobs';
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

const JOB_KIND = 'analystExplain';

/**
 * The steps an analysis actually has today.
 *
 * There are two, and only the second costs money. That is the honest count -
 * no step is invented here to make the job look richer than it is. `context`
 * builds the forecast, finds the manager's squad and reads the Elite Cohort
 * signals; it is deterministic and free, and it is a separate step precisely
 * because it is the work that must survive a refusal of the one below it.
 *
 * A third AI step, when there is one, is a line in this array and a handler
 * below. Nothing else changes.
 */
const STEPS: JobSpec['steps'] = [
  { id: 'context', kind: 'compute' },
  { id: 'explain', kind: 'ai' },
];

interface JobInput {
  season: string;
  gameweek: number;
  teamId: number | null;
  question: string | null;
  /** Part of the identity: a different model is a different piece of work. */
  model: string;
}

interface ContextResult {
  ctx: AnalysisContext;
  qualityFlags: string[];
  squadUsed: boolean;
  eliteUsed: boolean;
}

function jobInputOf(job: AiJobRecord): JobInput {
  const i = job.input as Record<string, unknown>;
  return {
    season: String(i.season ?? ''),
    gameweek: Number(i.gameweek) || 1,
    teamId: i.teamId == null ? null : Number(i.teamId),
    question: i.question == null ? null : String(i.question),
    model: String(i.model ?? ''),
  };
}

function handlersFor(input: JobInput): Record<string, StepHandler> {
  return {
    async context() {
      const bootstrap = await fetchFPLBootstrap();
      const { season, gameweek, teamId } = input;

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

      // Elite signals are allowed here even though they stay out of the
      // numbers. "14 of 20 elite managers captain him" is exactly the kind of
      // statement prose should carry, and it is fully verifiable.
      const elite = await readEliteDerived(season, gameweek - 1).catch(() => null);

      const ctx = buildAnalysisContext(result, bootstrap, {
        squadElementIds,
        elite,
        fixtureByClub: fixtureByClub(inputs.fixtures, gameweek),
      });

      const value: ContextResult = {
        ctx,
        qualityFlags: result.qualityFlags,
        squadUsed: Boolean(squadElementIds),
        eliteUsed: Boolean(elite),
      };
      return { status: 'completed', result: value };
    },

    async explain({ results }) {
      const ctx = (results.context as ContextResult | undefined)?.ctx;
      if (!ctx) return { status: 'failed', error: 'The analysis context is missing' };

      const cfg = await getLLMConfig();
      if (!cfg.configured) return { status: 'failed', error: 'No language model is configured' };

      const completion = await complete(
        cfg,
        SYSTEM_PROMPT,
        buildUserPrompt(ctx, input.question ?? undefined),
        { operation: 'analyst.explain' }
      );

      // A refusal by the monthly ceiling is not a failure of the step, it is
      // the step not happening. It goes back to `pending` with a reason, so the
      // next resume runs exactly this and nothing that came before it.
      if (!completion.ok && completion.code === AI_BUDGET_EXCEEDED) {
        return { status: 'blocked', reason: completion.error ?? 'AI budget exceeded' };
      }
      if (!completion.ok) return { status: 'failed', error: completion.error ?? 'The model call failed' };

      return {
        status: 'completed',
        result: {
          analysis: completion.text,
          model: completion.model,
          provider: cfg.provider,
          ungroundedNumbers: findUngroundedNumbers(completion.text!, ctx),
        },
      };
    },
  };
}

/**
 * Explains a forecast in prose, as a resumable job.
 *
 * The forecast is computed first and passed to the model as fact. The model
 * receives numbers and returns sentences; it is never asked what a player will
 * score. What comes back is checked against the numbers that went in, and any
 * figure that did not is reported alongside the text rather than quietly
 * removed - a model inventing projections is precisely the failure worth
 * seeing.
 *
 * Every step of that is recorded in Firestore before the next one starts. Post
 * without a `jobId` to start (or rejoin) the analysis for a gameweek; post with
 * one to resume. Resuming never re-runs a completed step, so the deterministic
 * half is computed once and the model is paid for once, however many times the
 * ceiling interrupts in between.
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

  try {
    let job: AiJobRecord;
    let rejoined = false;

    if (typeof body?.jobId === 'string' && body.jobId) {
      // Resume addresses EXACTLY the job it was given. No id is derived and no
      // other job is looked for, so a resume can never quietly become a
      // different piece of work than the one it is continuing.
      const check = await checkResumable(body.jobId, COMPUTE_VERSION);
      if (!check.ok) {
        return NextResponse.json(
          {
            error: check.message,
            status: check.reason === 'stale' ? 'JOB_STALE' : 'JOB_MISSING',
            job: check.job ? jobView(check.job) : undefined,
            configured: true,
          },
          { status: check.reason === 'stale' ? 409 : 404 }
        );
      }
      job = check.job;
      rejoined = true;
    } else {
      const bootstrap = await fetchFPLBootstrap();
      const season = seasonKey(bootstrap);
      const gameweek =
        Number(body?.gameweek) ||
        bootstrap.events.find((e) => e.is_next)?.id ||
        bootstrap.events.find((e) => e.is_current)?.id ||
        1;
      const input: JobInput = {
        season,
        gameweek,
        teamId: Number(body?.teamId) || null,
        question: typeof body?.question === 'string' ? body.question.slice(0, 400) || null : null,
        model: cfg.model,
      };
      // Starts a new execution unless one for these inputs is still unfinished.
      // A finished job is never handed back here - see lib/ai-jobs.ts.
      const started = await startOrRejoinJob({
        kind: JOB_KIND,
        input: { ...input },
        steps: STEPS,
        computeVersion: COMPUTE_VERSION,
      });
      job = started.job;
      rejoined = started.rejoined;
    }

    const input = jobInputOf(job);
    const run = await runJob(job.jobId, handlersFor(input));
    const view = jobView(run.job);
    const context = run.results.context as ContextResult | undefined;
    const common = {
      season: input.season,
      gameweek: input.gameweek,
      job: view,
      configured: true,
      qualityFlags: context?.qualityFlags ?? [],
      squadUsed: Boolean(context?.squadUsed),
      eliteUsed: Boolean(context?.eliteUsed),
      /** True only when this request continued an execution already under way. */
      rejoined,
    };

    // Another request holds the next step. Nothing was run twice and nothing
    // was charged; the answer is simply not ready yet.
    if (run.contended) {
      return NextResponse.json(
        { ...common, status: 'IN_PROGRESS', error: 'This analysis is already running. Try again in a moment.' },
        { status: 409 }
      );
    }

    // Budget refusal is not a failure of the request, it is the end of the
    // AI-dependent part of it. Everything already completed stays completed and
    // is returned rather than discarded, so reaching the ceiling costs the
    // prose and nothing else - and the resume below pays for that prose once.
    if (run.blocked) {
      const budget = await getBudgetStatus().catch(() => null);
      return NextResponse.json(
        {
          ...common,
          status: AI_BUDGET_EXCEEDED,
          error: run.blocked.reason,
          blockedStep: run.blocked.stepId,
          budget: budget ? budgetStatusForDisplay(budget) : undefined,
          // Proof that the deterministic half ran, is saved, and will not be
          // recomputed or re-charged when the budget is raised.
          forecastReady: Boolean(context),
          topProjections: (context?.ctx.top ?? []).slice(0, 5).map((p) => ({
            name: p.name,
            team: p.team,
            xPts: p.xPts,
          })),
        },
        { status: 402 }
      );
    }

    if (run.failed) {
      return NextResponse.json({ ...common, error: run.failed.error, failedStep: run.failed.stepId }, { status: 502 });
    }

    const explained = run.results.explain as
      | { analysis: string; model: string; provider: string; ungroundedNumbers: string[] }
      | undefined;
    if (!explained) {
      return NextResponse.json({ ...common, error: 'The analysis did not complete' }, { status: 502 });
    }

    const budget = await getBudgetStatus().catch(() => null);
    return NextResponse.json({
      ...common,
      status: 'COMPLETED',
      model: explained.model,
      provider: explained.provider,
      analysis: explained.analysis,
      budget: budget ? budgetStatusForDisplay(budget) : undefined,
      // Empty in the normal case. Non-empty means the model stated a decimal
      // that was not in its inputs, which the reader should know before acting.
      ungroundedNumbers: explained.ungroundedNumbers,
      /**
       * True when some part of this response came from steps persisted by an
       * earlier request on THIS execution. A new analysis always starts with
       * nothing persisted, so it is always false - which is what makes this a
       * resume indicator rather than a cache-hit indicator.
       */
      fromSavedSteps: run.skipped.length > 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Analysis failed' }, { status: 500 });
  }
}
