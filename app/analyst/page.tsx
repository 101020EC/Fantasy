import React from 'react';
import Link from 'next/link';
import { Brain, Users, Database, AlertCircle, Target } from 'lucide-react';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { ANALYST_ENABLED, currentEvent, finalisedEvents, seasonKey } from '@/lib/analyst';
import { readAccuracyHistory, readEliteCohort, readPlayerPriors, storedEliteGameweeks, storedPlayerStatGameweeks } from '@/lib/analyst-store';
import { loadFeatureInputs } from '@/lib/forecast-inputs';
import { buildFeatures } from '@/lib/feature-builder';
import { forecast } from '@/lib/forecast-engine';
import ForecastTable, { ForecastRow } from '@/components/analyst/ForecastTable';
import AnalysisPanel from '@/components/analyst/AnalysisPanel';
import AccuracyPanel from '@/components/analyst/AccuracyPanel';
import TransferSuggestions from '@/components/analyst/TransferSuggestions';
import AnalystSetup from '@/components/analyst/AnalystSetup';
import AiBudgetPanel from '@/components/analyst/AiBudgetPanel';
import { ELITE_COHORT_IDS } from '@/lib/elite-cohort-seed';
import { evaluatePromotion } from '@/lib/backtest';
import { getLLMConfig } from '@/lib/openai';
import { getTelegramConfig } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

/**
 * A separate page rather than new columns on the existing ones.
 *
 * /prices and /team are used every day and work; the analyst is new, its
 * numbers are not yet calibrated, and its collections may be empty. Keeping it
 * apart means nothing here can break a page someone relies on, and the existing
 * components stay untouched until the forecast has a track record.
 */
export default async function AnalystPage() {
  if (!ANALYST_ENABLED) {
    return (
      <Shell>
        <Notice
          title="Analyst is switched off"
          body="Set ANALYST_ENABLED=true to turn on forecasting, player stats capture and the Elite Cohort. Everything else in the app works exactly as before while it is off."
        />
      </Shell>
    );
  }

  let body: React.ReactNode;

  try {
    const bootstrap = await fetchFPLBootstrap();
    const season = seasonKey(bootstrap);
    const finalised = finalisedEvents(bootstrap).map((e) => e.id);
    const current = currentEvent(bootstrap);
    // Forecast the gameweek that has not started: the next one if the current
    // is under way, otherwise the current one.
    const target = bootstrap.events.find((e) => e.is_next)?.id ?? current?.id ?? 1;

    if (!isAdminConfigured) {
      body = <Notice title="Firestore is not configured" body="Set FIREBASE_SERVICE_ACCOUNT to store and read analyst data." />;
    } else {
      const [storedStats, storedElite, cohort, llm] = await Promise.all([
        storedPlayerStatGameweeks(season).catch((): number[] => []),
        storedEliteGameweeks(season).catch((): number[] => []),
        readEliteCohort(season).catch(() => null),
        getLLMConfig().catch(() => null),
      ]);
      const priors = await readPlayerPriors(season).catch(() => null);
      const accuracy = await readAccuracyHistory(season).catch(() => []);

      // The team the app already tracks, rather than a second place to
      // configure one. Absent simply means the prose covers the forecast
      // without a squad section.
      const trackedTeamId = await getTelegramConfig()
        .then((c) => c.teamId || undefined)
        .catch(() => undefined);

      const inputs = await loadFeatureInputs(bootstrap, season, target, { includeElite: false });
      const features = buildFeatures(inputs, { includeElite: false });
      const result = forecast(features, {
        fixtures: inputs.fixtures,
        teams: bootstrap.teams,
        scoring: bootstrap.scoring,
        calibration: inputs.calibration,
      });

      // Weighted across every scored gameweek, and drawn from `as_published`
      // where it exists — the forecast the app really showed, rather than the
      // replay, which is rebuilt with today's engine and so flatters itself
      // every time the engine improves.
      const headline = (() => {
        let hits = 0;
        let considered = 0;
        let gameweeks = 0;
        let series: 'published' | 'replay' | null = null;
        for (const row of accuracy) {
          const score = row.models.as_published ?? row.models.base;
          if (!score || !score.nConsidered) continue;
          if (row.models.as_published) series = 'published';
          else if (series === null) series = 'replay';
          hits += score.within2Considered * score.nConsidered;
          considered += score.nConsidered;
          gameweeks += 1;
        }
        return considered ? { pct: hits / considered, gameweeks, series } : null;
      })();

      const elements = new Map(bootstrap.elements.map((e) => [e.id, e]));
      const teams = new Map(bootstrap.teams.map((t) => [t.id, t.short_name]));
      const rows: ForecastRow[] = Object.entries(result.predictions)
        .map(([id, p]) => {
          const el = elements.get(Number(id));
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
        .filter((r) => r.minutesProb > 0.2)
        .sort((a, b) => b.xPts - a.xPts)
        .slice(0, 100);

      body = (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat
              icon={<Database className="w-4 h-4" />}
              tone="indigo"
              label="Finalised gameweeks"
              value={finalised.length ? `${storedStats.length} of ${finalised.length} captured` : 'None yet'}
              hint={
                finalised.length
                  ? 'Match stats stored per finalised gameweek.'
                  : 'FPL keeps scores provisional until a gameweek is data-checked.'
              }
            />
            <Stat
              icon={<Users className="w-4 h-4" />}
              tone="emerald"
              label="Elite Cohort"
              value={cohort ? `${cohort.cohortSize} managers` : 'Not configured'}
              hint={
                cohort
                  ? `${storedElite.length} gameweek${storedElite.length === 1 ? '' : 's'} captured. A ~20-manager sample, not a Top 1K population statistic.`
                  : 'POST /api/analyst/cohort to define it.'
              }
            />
            <Stat
              icon={<Brain className="w-4 h-4" />}
              tone="purple"
              label="Model"
              value={result.model === 'elite' ? 'Base + Elite' : 'Base'}
              hint="Elite Cohort Signals stay out of the numbers until they beat this over at least 8 gameweeks."
            />
            {/* A bare percentage would be meaningless for a points projection,
                so the tolerance and the population travel with it. */}
            <Stat
              icon={<Target className="w-4 h-4" />}
              tone="amber"
              label="Accuracy"
              value={headline ? `${Math.round(headline.pct * 100)}%` : 'Not measured yet'}
              hint={
                headline
                  ? `Within 2 points, over players projected at 3+, across ${headline.gameweeks} scored gameweek${headline.gameweeks === 1 ? '' : 's'}${headline.series === 'replay' ? ' (replayed, not as published)' : ''}.`
                  : 'Scoring starts once FPL finalises a gameweek. Nothing is measured before then.'
              }
            />
          </div>

          <AnalystSetup
            needsPriors={!priors?.playerCount}
            needsCohort={!cohort?.managerIds?.length}
            seedSize={ELITE_COHORT_IDS.length}
          />

          {/* Beside the panel that spends it, and only when there is a key to
              spend with — a ceiling on nothing is noise. */}
          {llm?.configured && <AiBudgetPanel />}

          {llm?.configured ? (
            <AnalysisPanel gameweek={target} teamId={trackedTeamId} />
          ) : (
            <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 mb-5">
              <p className="font-black text-[#111318] text-sm">Written analysis is off</p>
              <p className="text-[12px] text-black/50 mt-1 leading-snug">
                Add a key with <code className="text-[11px]">PUT /api/analyst/llm-settings</code> or set
                OPENAI_API_KEY to have the projections explained in prose. The forecast below does not
                need it — no language model is involved in producing these numbers.
              </p>
            </div>
          )}

          {trackedTeamId && <TransferSuggestions teamId={trackedTeamId} />}

          <AccuracyPanel history={accuracy} promotion={evaluatePromotion(accuracy)} />

          <ForecastTable
            rows={rows}
            qualityFlags={result.qualityFlags}
            gameweek={target}
            calibration={
              inputs.calibration
                ? {
                    sourceGameweeks: inputs.calibration.sourceGameweeks,
                    notes: inputs.calibration.notes,
                  }
                : null
            }
          />
        </>
      );
    }
  } catch (err: any) {
    body = <Notice title="Could not build a forecast" body={err?.message ?? 'Unknown error'} />;
  }

  return <Shell>{body}</Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-2xl sm:text-4xl font-black text-[#111318] tracking-tight">Analyst</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-[#38003c] text-xs font-black">
            Expected points
          </span>
        </div>
        <Link
          href="/prices"
          className="text-xs font-black text-[#38003c] px-3 py-2 rounded-2xl bg-white border border-black/5 shadow-sm"
        >
          Market
        </Link>
      </div>
      {children}
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-5 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
        <AlertCircle className="w-4 h-4" />
      </div>
      <div>
        <p className="font-black text-[#111318]">{title}</p>
        <p className="text-sm text-black/55 mt-1 leading-snug">{body}</p>
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  indigo: 'bg-indigo-100 text-indigo-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  purple: 'bg-purple-100 text-[#38003c]',
  amber: 'bg-amber-100 text-amber-600',
};

function Stat({
  icon, tone, label, value, hint,
}: {
  icon: React.ReactNode; tone: string; label: string; value: string; hint: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-3.5">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${TONES[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide font-black text-black/40">{label}</p>
          <p className="font-black text-[#111318] text-sm truncate">{value}</p>
        </div>
      </div>
      <p className="text-[11px] text-black/45 mt-2 leading-snug">{hint}</p>
    </div>
  );
}
