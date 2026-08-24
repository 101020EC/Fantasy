'use client';

import React, { useState } from 'react';
import { Sparkles, AlertTriangle, Loader2 } from 'lucide-react';

interface AnalysisResponse {
  analysis?: string;
  ungroundedNumbers?: string[];
  model?: string;
  provider?: string;
  squadUsed?: boolean;
  eliteUsed?: boolean;
  error?: string;
  configured?: boolean;
  status?: string;
  forecastReady?: boolean;
  budget?: { limitUsd: number; spentUsd: number; remainingUsd: number; month: string };
}

/**
 * Written commentary on the forecast.
 *
 * Loaded on demand rather than with the page: it costs a model call, and the
 * numbers above are the product — this explains them. If no key is configured
 * the panel says so and the rest of the page is unaffected.
 */
export default function AnalysisPanel({
  gameweek,
  teamId,
}: {
  gameweek: number;
  teamId?: string;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [question, setQuestion] = useState('');

  async function run() {
    setState('loading');
    try {
      const res = await fetch('/api/analyst/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameweek, teamId, question: question.trim() || undefined }),
      });
      const json: AnalysisResponse = await res.json();
      setData(json);
      setState(res.ok ? 'done' : 'error');
    } catch (err: any) {
      setData({ error: err?.message ?? 'Could not reach the server' });
      setState('error');
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 mb-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#38003c] flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <p className="font-black text-[#111318] text-sm">What the numbers say</p>
          <p className="text-[11px] text-black/45 leading-snug">
            Written from the projections above. The model explains them — it never produces them.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Optional: ask something specific, e.g. who should I captain?"
          className="flex-1 px-3.5 py-2.5 rounded-2xl bg-pastel-bg border border-black/5 text-sm font-medium outline-none focus:border-[#38003c]/25"
        />
        <button
          type="button"
          onClick={run}
          disabled={state === 'loading'}
          className="px-4 py-2.5 rounded-2xl bg-[#38003c] text-white text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
        >
          {state === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
          {state === 'loading' ? 'Reading' : 'Explain'}
        </button>
      </div>

      {/* The ceiling is a stop, not a fault: say what still works rather than
          presenting it as a broken request. */}
      {state === 'error' && data?.status === 'AI_BUDGET_EXCEEDED' ? (
        <div className="mt-3 text-[12px] text-sky-900 bg-sky-50 border border-sky-200 rounded-2xl p-3 leading-snug">
          <p className="font-black mb-1">Monthly AI budget reached</p>
          <p>{data.error}</p>
          {data.forecastReady && (
            <p className="mt-1.5 text-sky-800">
              The projections above are unaffected — they are computed without a model — and nothing
              already saved has been changed. Raise the budget above, or wait for the 1st.
            </p>
          )}
        </div>
      ) : (
        state === 'error' &&
        data?.error && (
          <p className="mt-3 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-3 leading-snug">
            {data.error}
          </p>
        )
      )}

      {state === 'done' && data?.analysis && (
        <div className="mt-3">
          {/* Surfaced, not hidden: a figure the model stated that was not in
              its inputs is the one failure worth seeing immediately. */}
          {data.ungroundedNumbers && data.ungroundedNumbers.length > 0 && (
            <div className="mb-3 flex items-start gap-2 text-[12px] text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="leading-snug">
                These figures do not appear in the data the model was given:{' '}
                <strong>{data.ungroundedNumbers.join(', ')}</strong>. Treat them as unverified.
              </p>
            </div>
          )}

          <div className="text-[13px] text-[#111318]/85 leading-relaxed space-y-2.5">
            {data.analysis.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          <p className="mt-3 text-[10px] text-black/35">
            {data.provider} · {data.model}
            {data.squadUsed ? ' · your squad included' : ''}
            {data.eliteUsed ? ' · Elite Cohort context included' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
