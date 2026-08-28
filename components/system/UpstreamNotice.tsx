'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react';

function ago(iso: string | null): string {
  if (!iso) return 'a while ago';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(mins) || mins < 1) return 'moments ago';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function RetryButton({ dark }: { dark?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        router.refresh();
        // The refresh resolves on the server; this only clears the spinner if
        // the page does not re-render, which happens when nothing changed.
        setTimeout(() => setBusy(false), 4000);
      }}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-xs transition disabled:opacity-60 ${
        dark
          ? 'bg-[#111318] text-white hover:scale-105'
          : 'bg-amber-900/10 text-amber-900 hover:bg-amber-900/20'
      }`}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
      <span>{busy ? 'Retrying…' : 'Try again'}</span>
    </button>
  );
}

/**
 * Shown when the page rendered from a saved copy because FPL would not answer.
 *
 * The point is that the numbers below it are real but old. Saying nothing would
 * present last hour's prices as current, which is worse than an error page —
 * an error is obviously wrong, stale data looks right.
 */
export function StaleNotice({ capturedAt }: { capturedAt: string | null }) {
  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black text-amber-900">
          Showing saved data from {ago(capturedAt)}
        </p>
        <p className="text-[11px] text-amber-800/80 font-semibold mt-0.5 leading-snug">
          FPL is not responding right now, so this is the last copy we could confirm. Prices and
          points may have moved since.
        </p>
      </div>
      <RetryButton />
    </div>
  );
}

/**
 * Shown when there is no saved copy either. Distinct from "team not found":
 * this one is not the reader's fault and there is nothing for them to correct,
 * so it offers a retry rather than a search box.
 */
export function FplUnavailable({ status, detail }: { status?: number; detail?: string }) {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="p-8 rounded-4xl bg-white border border-amber-200 shadow-xl">
        <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <CloudOff className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-[#111318] mb-2">FPL is not responding</h2>
        <p className="text-xs text-gray-500 mb-2 leading-relaxed">
          {detail || 'The official Fantasy Premier League API is refusing requests right now.'}
          {status ? ` (HTTP ${status})` : ''}
        </p>
        <p className="text-[11px] text-gray-400 mb-6 leading-relaxed">
          Nothing is wrong with your team or your ID — this is upstream, and it usually clears on
          its own within a few minutes.
        </p>
        <RetryButton dark />
      </div>
    </div>
  );
}
