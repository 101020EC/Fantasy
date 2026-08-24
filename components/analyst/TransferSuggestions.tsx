'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Info } from 'lucide-react';

interface Suggestion {
  out: { name: string; teamShort: string; xPts: number };
  in: { name: string; teamShort: string; cost: number; xPts: number };
  gain: number;
  netGain: number;
  costsHit: boolean;
  bankAfter: number;
  reason: string;
}

interface Response {
  fromGameweek?: number;
  horizon?: number;
  bank?: number;
  freeTransfers?: number;
  assumedFreeTransfers?: boolean;
  note?: string;
  suggestions?: Suggestion[];
  error?: string;
}

/**
 * Ranked swaps for the tracked squad.
 *
 * Fetched on the client rather than rendered on the server: it needs the FPL
 * picks endpoint plus one forecast per gameweek in the horizon, which is too
 * slow to hold up the page for something not everyone will look at.
 */
export default function TransferSuggestions({ teamId }: { teamId: string }) {
  const [data, setData] = useState<Response | null>(null);
  const [horizon, setHorizon] = useState(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analyst/transfers?teamId=${encodeURIComponent(teamId)}&horizon=${horizon}`)
      .then((r) => r.json())
      .then((j) => !cancelled && setData(j))
      .catch((e) => !cancelled && setData({ error: e?.message ?? 'Request failed' }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [teamId, horizon]);

  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 mb-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="font-black text-[#111318] text-sm">Transfer suggestions</p>
          <p className="text-[11px] text-black/45 leading-snug">
            Single swaps ranked by points gained over the horizon, within budget and the
            three-per-club limit.
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {[1, 3, 5].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition ${
                horizon === h ? 'bg-[#38003c] text-white' : 'bg-pastel-bg text-[#38003c]'
              }`}
            >
              {h} GW
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-[12px] text-black/45 py-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Projecting {horizon} gameweeks…
        </p>
      )}

      {!loading && data?.error && (
        <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          {data.error}
        </p>
      )}

      {!loading && data?.suggestions && (
        <>
          {data.suggestions.length === 0 ? (
            <p className="text-[12px] text-black/45 py-2">
              No swap gains enough to be worth making over the next {data.horizon} gameweeks.
            </p>
          ) : (
            <div className="space-y-2">
              {data.suggestions.map((s, i) => (
                <div key={i} className="rounded-2xl bg-pastel-bg p-3">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-bold text-black/50 line-through">{s.out.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-black/30" />
                    <span className="font-black text-[#111318]">{s.in.name}</span>
                    <span className="text-[11px] font-bold text-black/40">
                      {s.in.teamShort} · £{(s.in.cost / 10).toFixed(1)}m
                    </span>
                    <span
                      className={`ml-auto px-2 py-0.5 rounded-full text-[11px] font-black ${
                        s.netGain > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {s.netGain > 0 ? '+' : ''}
                      {s.netGain.toFixed(1)} pts
                    </span>
                  </div>
                  <p className="text-[11px] text-black/45 mt-1">
                    {s.reason}
                    {s.costsHit && ' · after a 4-point hit'} · £{s.bankAfter.toFixed(1)}m left
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Assumptions stated, because acting on them costs points. */}
          <div className="flex items-start gap-2 text-[11px] text-black/45 mt-3 leading-snug">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>
              {data.note ? `${data.note} ` : ''}
              {data.assumedFreeTransfers &&
                'FPL does not publish banked free transfers, so one is assumed. '}
              Selling price uses the current price, which understates the budget for a player who
              has risen.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
