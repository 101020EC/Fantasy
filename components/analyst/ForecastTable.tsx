'use client';

import React, { useMemo, useState } from 'react';
import { Info, TrendingUp, AlertTriangle } from 'lucide-react';

export interface ForecastRow {
  elementId: number;
  name: string;
  team: string;
  position: number;
  cost: number;
  epNext: number | null;
  xPts: number;
  floor: number;
  ceiling: number;
  minutesProb: number;
  confidence: number;
}

const POSITIONS = ['', 'GKP', 'DEF', 'MID', 'FWD'];
const POSITION_STYLE: Record<number, string> = {
  1: 'bg-amber-100 text-amber-700',
  2: 'bg-sky-100 text-sky-700',
  3: 'bg-emerald-100 text-emerald-700',
  4: 'bg-rose-100 text-rose-700',
};

/** Explains what a quality flag means, rather than showing the raw slug. */
const FLAG_TEXT: Record<string, string> = {
  no_player_history: 'No finalised gameweek yet — projections come from last season only.',
  short_player_history:
    'Fewer than six finalised gameweeks. Rates lean heavily on last season, and fringe players are over-projected.',
  no_fixtures: 'No stored fixture list, so opponent difficulty is not applied.',
  no_market_snapshot: 'No market snapshot before the deadline — availability is assumed.',
  no_prior_season: 'No prior-season data, so players fall back to position averages.',
  no_elite_data: 'No Elite Cohort data for any earlier gameweek.',
  stale_elite_data: 'The most recent Elite Cohort capture is too old to trust; it was dropped.',
  low_cohort_availability: 'Part of the Elite Cohort could not be reached for the source gameweek.',
  high_chip_volatility:
    'Many cohort managers played Free Hit or Wildcard, so their squad changes reflect a chip, not a trend.',
};

export default function ForecastTable({
  rows,
  qualityFlags,
  gameweek,
}: {
  rows: ForecastRow[];
  qualityFlags: string[];
  gameweek: number;
}) {
  const [position, setPosition] = useState(0);
  const [maxCost, setMaxCost] = useState(0);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => (position === 0 || r.position === position) && (maxCost === 0 || r.cost <= maxCost)
      ),
    [rows, position, maxCost]
  );

  return (
    <div className="space-y-4">
      {qualityFlags.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
            <AlertTriangle className="w-4 h-4" />
            How much to trust this
          </div>
          {qualityFlags.map((flag) => (
            <p key={flag} className="text-[12px] text-amber-800 leading-snug">
              {FLAG_TEXT[flag] ?? flag}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {[0, 1, 2, 3, 4].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPosition(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-black transition ${
              position === p
                ? 'bg-[#38003c] text-white'
                : 'bg-white text-[#38003c] border border-black/5 hover:bg-purple-50'
            }`}
          >
            {p === 0 ? 'All' : POSITIONS[p]}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-black/10" />
        {[0, 5, 7, 9].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setMaxCost(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-black transition ${
              maxCost === c
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-emerald-700 border border-black/5 hover:bg-emerald-50'
            }`}
          >
            {c === 0 ? 'Any price' : `≤ £${c}.0m`}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white border border-black/5 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-black/45 border-b border-black/5">
              <th className="py-2.5 px-3 font-black">#</th>
              <th className="py-2.5 px-3 font-black">Player</th>
              <th className="py-2.5 px-3 font-black">Pos</th>
              <th className="py-2.5 px-3 font-black text-right">Price</th>
              <th className="py-2.5 px-3 font-black text-right">xPts</th>
              <th className="py-2.5 px-3 font-black text-right">Range</th>
              <th className="py-2.5 px-3 font-black text-right">Mins</th>
              <th className="py-2.5 px-3 font-black text-right">FPL ep</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.elementId} className="border-b border-black/5 last:border-0 hover:bg-purple-50/40">
                <td className="py-2 px-3 text-black/35 font-bold text-xs">{i + 1}</td>
                <td className="py-2 px-3">
                  <span className="font-black text-[#111318]">{r.name}</span>
                  <span className="ml-2 text-[11px] font-bold text-black/40">{r.team}</span>
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      POSITION_STYLE[r.position] ?? 'bg-black/5 text-black/50'
                    }`}
                  >
                    {POSITIONS[r.position]}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-bold tabular-nums">£{r.cost.toFixed(1)}</td>
                <td className="py-2 px-3 text-right font-black tabular-nums text-[#38003c]">
                  {r.xPts.toFixed(1)}
                </td>
                <td className="py-2 px-3 text-right text-[11px] font-bold tabular-nums text-black/40">
                  {r.floor.toFixed(1)}–{r.ceiling.toFixed(1)}
                </td>
                <td className="py-2 px-3 text-right text-[11px] font-bold tabular-nums text-black/50">
                  {Math.round(r.minutesProb * 100)}%
                </td>
                {/* FPL's own projection, side by side: the number to beat. */}
                <td className="py-2 px-3 text-right font-bold tabular-nums text-black/45">
                  {r.epNext === null ? '—' : r.epNext.toFixed(1)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-black/40 text-sm font-bold">
                  No players match that filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 text-[11px] text-black/45 leading-snug">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <p>
          <strong className="text-black/60">xPts</strong> is a deterministic projection for GW{gameweek}
          from minutes, xG, xA, expected goals conceded, FPL&apos;s own fixture difficulty for the opponent and
          venue, and FPL&apos;s own scoring rules — no language model is involved in producing it. <strong className="text-black/60">Range</strong>{' '}
          widens when the model knows less. <strong className="text-black/60">FPL ep</strong> is FPL&apos;s
          published estimate, shown as the benchmark to beat rather than as a target to match.
        </p>
      </div>
    </div>
  );
}

export { TrendingUp };
