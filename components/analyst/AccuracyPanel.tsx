import React from 'react';
import { GameweekAccuracy } from '@/lib/types';

/**
 * Measured accuracy per gameweek, with FPL's own projection alongside.
 *
 * Both model variants are always shown, never only the better one: the elite
 * variant is a hypothesis under test, and hiding it when it loses would defeat
 * the point of testing it.
 */
export default function AccuracyPanel({
  history,
  promotion,
}: {
  history: GameweekAccuracy[];
  promotion: { eligible: boolean; reason: string };
}) {
  if (!history.length) {
    return (
      <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 mb-5">
        <p className="font-black text-[#111318] text-sm">Accuracy</p>
        <p className="text-[12px] text-black/50 mt-1 leading-snug">
          Nothing scored yet. Scoring begins once FPL finalises a gameweek — and starts at GW2,
          since a GW1 forecast has no earlier gameweek behind it.
        </p>
      </div>
    );
  }

  const fmt = (v: number | undefined) => (v === undefined ? '—' : v.toFixed(2));

  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 mb-5">
      <p className="font-black text-[#111318] text-sm mb-0.5">Accuracy</p>
      <p className="text-[11px] text-black/45 mb-3">
        Mean absolute error, lower is better. Scored on {history[0].population.replace(/_/g, ' ')}.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-black/45 border-b border-black/5">
              <th className="py-2 pr-3 font-black">GW</th>
              <th className="py-2 pr-3 font-black text-right">Base</th>
              <th className="py-2 pr-3 font-black text-right">+ Elite</th>
              <th className="py-2 pr-3 font-black text-right">FPL ep</th>
              <th className="py-2 pr-3 font-black text-right">Rank ρ</th>
              <th className="py-2 font-black text-right">Cohort</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.gameweek} className="border-b border-black/5 last:border-0">
                <td className="py-2 pr-3 font-black">{h.gameweek}</td>
                <td className="py-2 pr-3 text-right tabular-nums font-bold">{fmt(h.models.base?.mae)}</td>
                <td className="py-2 pr-3 text-right tabular-nums font-bold">{fmt(h.models.elite?.mae)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-black/50">{fmt(h.models.ep_next?.mae)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-black/50">{fmt(h.models.base?.spearman)}</td>
                {/* Manager-level, so it sits apart from the player-level columns. */}
                <td className="py-2 text-right tabular-nums text-black/50">
                  {h.eliteActual ? `${h.eliteActual.median} med` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-black/45 mt-3 leading-snug">
        <strong className="text-black/60">{promotion.eligible ? 'Elite signals qualify' : 'Elite signals on hold'}:</strong>{' '}
        {promotion.reason} The cohort column is manager-level and is not comparable to the
        player-level errors beside it.
      </p>
    </div>
  );
}
