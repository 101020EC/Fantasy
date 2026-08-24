'use client';

import React, { useEffect, useState } from 'react';
import { Wallet, Loader2, Check } from 'lucide-react';

interface BudgetView {
  month: string;
  limitUsd: number;
  spentUsd: number;
  reservedUsd: number;
  remainingUsd: number;
  calls: number;
  state: 'ok' | 'low' | 'exhausted';
  source: 'firestore' | 'default';
  presets: number[];
  maxUsd: number;
  storable: boolean;
  error?: string;
}

const money = (v: number) => `$${v.toFixed(v < 1 ? 4 : 2).replace(/0+$/, '').replace(/\.$/, '')}`;

const STATE_STYLE: Record<BudgetView['state'], { chip: string; label: string }> = {
  ok: { chip: 'bg-emerald-100 text-emerald-700', label: 'Within budget' },
  low: { chip: 'bg-amber-100 text-amber-700', label: 'Nearly spent' },
  exhausted: { chip: 'bg-rose-100 text-rose-700', label: 'Budget reached' },
};

/**
 * The monthly language-model ceiling.
 *
 * Shown beside the panel that spends it, because a cap nobody can see is a cap
 * nobody trusts. Reaching it stops further model calls and changes nothing
 * else: the forecast, the captured gameweeks and any explanation already
 * written are untouched, and the counter starts again next calendar month.
 */
export default function AiBudgetPanel() {
  const [data, setData] = useState<BudgetView | null>(null);
  const [saving, setSaving] = useState(false);
  const [custom, setCustom] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  async function load() {
    try {
      const res = await fetch('/api/analyst/ai-budget');
      setData(await res.json());
    } catch (err: any) {
      setData((d) => (d ? { ...d, error: err?.message } : null));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(limitUsd: number) {
    setSaving(true);
    try {
      const res = await fetch('/api/analyst/ai-budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyLimitUsd: limitUsd }),
      });
      const json = await res.json();
      if (res.ok) {
        setData((d) => (d ? { ...d, ...json } : d));
        setSavedAt(Date.now());
        setCustom('');
      } else {
        setData((d) => (d ? { ...d, error: json.error } : d));
      }
    } finally {
      setSaving(false);
    }
  }

  if (!data) return null;

  const style = STATE_STYLE[data.state] ?? STATE_STYLE.ok;
  const usedPct = data.limitUsd > 0 ? Math.min(100, (data.spentUsd / data.limitUsd) * 100) : 100;

  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 mb-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <p className="font-black text-[#111318] text-sm">AI budget</p>
            <p className="text-[11px] text-black/45 leading-snug">
              {data.month} · resets on the 1st · {data.calls} call{data.calls === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${style.chip}`}>
          {style.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          ['Budget', money(data.limitUsd)],
          ['Used', money(data.spentUsd)],
          ['Remaining', money(data.remainingUsd)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-pastel-bg border border-black/5 p-2.5">
            <p className="text-[10px] uppercase tracking-wide font-black text-black/40">{label}</p>
            <p className="font-black text-[#111318] text-sm tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="h-1.5 rounded-full bg-black/5 overflow-hidden mb-3">
        <div
          className={`h-full ${data.state === 'exhausted' ? 'bg-rose-500' : data.state === 'low' ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${usedPct}%` }}
        />
      </div>

      {data.storable ? (
        <div className="flex flex-wrap items-center gap-2">
          {data.presets.map((p) => (
            <button
              key={p}
              type="button"
              disabled={saving}
              onClick={() => save(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition disabled:opacity-50 ${
                data.limitUsd === p
                  ? 'bg-[#38003c] text-white'
                  : 'bg-white text-[#38003c] border border-black/5 hover:bg-purple-50'
              }`}
            >
              ${p}
            </button>
          ))}
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            inputMode="decimal"
            placeholder="Custom"
            className="w-24 px-3 py-1.5 rounded-full bg-pastel-bg border border-black/5 text-xs font-bold outline-none focus:border-[#38003c]/25"
          />
          <button
            type="button"
            disabled={saving || !custom.trim()}
            onClick={() => save(Number(custom))}
            className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-black disabled:opacity-40 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Set
          </button>
          {savedAt > 0 && !saving && (
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-black/45">
          Firestore is not configured, so the ceiling is the {money(data.limitUsd)} default and cannot
          be changed here.
        </p>
      )}

      {data.error && (
        <p className="mt-2 text-[11px] text-rose-700">{data.error}</p>
      )}

      <p className="text-[11px] text-black/40 mt-3 leading-snug">
        Costs are estimated from published per-token prices, so the provider&apos;s own dashboard is
        the authority on what was billed. Reaching the ceiling stops new model calls only — the
        forecast is computed without a model and keeps working.
      </p>
    </div>
  );
}
