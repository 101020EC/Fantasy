'use client';

import React, { useState } from 'react';
import { Users, Database, Loader2, Check } from 'lucide-react';

type Step = 'priors' | 'cohort';

interface StepSpec {
  key: Step;
  title: string;
  body: string;
  urgency?: string;
  action: string;
  request: () => Promise<Response>;
  describe: (json: any) => string;
}

/**
 * The setup a fresh database needs before the nightly job can do anything.
 *
 * Both of these used to happen only as a side effect of capturing a finalised
 * gameweek, which meant a new deployment sat idle until FPL data-checked a
 * week — and in the case of prior seasons, projected every player at zero in
 * the meantime, because the model genuinely had no evidence about anybody.
 * Neither actually depends on a gameweek, so neither should wait for one.
 *
 * A card that says what is missing beats a curl command with a session cookie
 * pasted into it, which is the kind of instruction that does not get followed.
 */
export default function AnalystSetup({
  needsPriors,
  needsCohort,
  seedSize,
}: {
  needsPriors: boolean;
  needsCohort: boolean;
  seedSize: number;
}) {
  const [running, setRunning] = useState<Step | null>(null);
  const [done, setDone] = useState<Partial<Record<Step, string>>>({});
  const [failed, setFailed] = useState<Partial<Record<Step, string>>>({});

  const steps: StepSpec[] = [
    {
      key: 'priors',
      title: 'Player history not captured here',
      body:
        "Each player's last completed season — minutes, xG, xA, expected goals conceded — is what lets the model tell a striker from a squad player before a single gameweek has finished. Without it every projection is zero.",
      action: 'Capture player history',
      request: () =>
        fetch('/api/analyst/backfill/player-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }),
      describe: (j) =>
        j?.priors
          ? `Captured ${j.priors.playerCount} players from ${j.priors.sourceSeason}.`
          : 'Player history captured.',
    },
    {
      key: 'cohort',
      title: 'Elite Cohort not set up here',
      body: `${seedSize} managers, each with at least one Top 1K finish, are listed in the code and need writing to this database once. Their squads are then captured every time FPL finalises a gameweek.`,
      urgency:
        'Worth doing sooner than later: if a manager deletes their team, their past gameweeks stop being fetchable and cannot be recovered from anywhere.',
      action: 'Set up the cohort',
      request: () =>
        fetch('/api/analyst/cohort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }),
      describe: (j) =>
        `Wrote ${j?.resolved} of ${j?.cohortSize} managers${
          j?.unresolved?.length ? ` — could not resolve ${j.unresolved.join(', ')}` : ''
        }.`,
    },
  ];

  const pending = steps.filter(
    (s) => (s.key === 'priors' ? needsPriors : needsCohort) && !done[s.key]
  );
  if (!pending.length && !Object.keys(done).length) return null;

  async function run(step: StepSpec) {
    setRunning(step.key);
    setFailed((f) => ({ ...f, [step.key]: undefined }));
    try {
      const res = await step.request();
      const json = await res.json();
      if (res.ok) {
        setDone((d) => ({ ...d, [step.key]: step.describe(json) }));
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setFailed((f) => ({ ...f, [step.key]: json?.error ?? `Failed (${res.status})` }));
      }
    } catch (err: any) {
      setFailed((f) => ({ ...f, [step.key]: err?.message ?? 'Request failed' }));
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 mb-5 space-y-4">
      {steps.map((step) => {
        const needed = step.key === 'priors' ? needsPriors : needsCohort;
        if (!needed && !done[step.key]) return null;
        const complete = Boolean(done[step.key]);
        return (
          <div key={step.key} className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                complete ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
              }`}
            >
              {complete ? (
                <Check className="w-4 h-4" />
              ) : step.key === 'priors' ? (
                <Database className="w-4 h-4" />
              ) : (
                <Users className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-[#111318] text-sm">{step.title}</p>
              <p className="text-[12px] text-black/50 mt-1 leading-snug">{step.body}</p>
              {step.urgency && !complete && (
                <p className="text-[11px] text-amber-700 mt-1.5 leading-snug">{step.urgency}</p>
              )}

              {complete && (
                <p className="text-[12px] text-emerald-700 font-bold mt-2">
                  {done[step.key]} Reloading…
                </p>
              )}
              {failed[step.key] && (
                <p className="text-[12px] text-rose-700 mt-2">{failed[step.key]}</p>
              )}

              {!complete && (
                <button
                  type="button"
                  onClick={() => run(step)}
                  disabled={running !== null}
                  className="mt-3 px-4 py-2 rounded-2xl bg-[#38003c] text-white text-xs font-black disabled:opacity-50 flex items-center gap-2"
                >
                  {running === step.key && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {running === step.key
                    ? step.key === 'priors'
                      ? 'Fetching ~600 players…'
                      : 'Resolving each manager…'
                    : step.action}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
