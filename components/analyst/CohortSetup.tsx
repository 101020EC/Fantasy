'use client';

import React, { useState } from 'react';
import { Users, Loader2, Check } from 'lucide-react';

interface Result {
  cohortSize?: number;
  resolved?: number;
  unresolved?: number[];
  source?: string;
  error?: string;
}

/**
 * One-click setup for the Elite Cohort.
 *
 * The roster has to be written once per Firebase project, and it is the only
 * manual step between a fresh deployment and the nightly job doing its work —
 * without it the capture reports "no cohort configured" every night, quietly.
 * A button beats a curl command with a session cookie pasted into it.
 */
export default function CohortSetup({ seedSize }: { seedSize: number }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<Result | null>(null);

  async function seed() {
    setState('working');
    try {
      const res = await fetch('/api/analyst/cohort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json: Result = await res.json();
      setResult(json);
      setState(res.ok ? 'done' : 'error');
      if (res.ok) setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      setResult({ error: err?.message ?? 'Request failed' });
      setState('error');
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 mb-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
          {state === 'done' ? <Check className="w-4 h-4" /> : <Users className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-[#111318] text-sm">Elite Cohort not set up here</p>
          <p className="text-[12px] text-black/50 mt-1 leading-snug">
            {seedSize} managers, each with at least one Top 1K finish, are listed in the code and
            need writing to this database once. Their squads are then captured every time FPL
            finalises a gameweek.
          </p>
          <p className="text-[11px] text-amber-700 mt-1.5 leading-snug">
            Worth doing sooner than later: if a manager deletes their team, their past gameweeks
            stop being fetchable and cannot be recovered from anywhere.
          </p>

          {state === 'done' && result && (
            <p className="text-[12px] text-emerald-700 font-bold mt-2">
              Wrote {result.resolved} of {result.cohortSize} managers
              {result.unresolved?.length ? ` — could not resolve ${result.unresolved.join(', ')}` : ''}. Reloading…
            </p>
          )}
          {state === 'error' && result && (
            <p className="text-[12px] text-rose-700 mt-2">{result.error ?? 'Could not write the cohort.'}</p>
          )}

          {state !== 'done' && (
            <button
              type="button"
              onClick={seed}
              disabled={state === 'working'}
              className="mt-3 px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-black disabled:opacity-50 flex items-center gap-2"
            >
              {state === 'working' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {state === 'working' ? 'Resolving each manager…' : 'Set up the cohort'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
