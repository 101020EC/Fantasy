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
  const pct = (v: number | undefined) => (v === undefined ? '—' : `${Math.round(v * 100)}%`);
  const signed = (v: number | undefined) =>
    v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
  const anyPublished = history.some((h) => h.models.as_published);

  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 mb-5">
      <p className="font-black text-[#111318] text-sm mb-0.5">Accuracy</p>
      <p className="text-[11px] text-black/45 mb-3">
        Mean absolute error, lower is better. Scored on {history[0].population.replace(/_/g, ' ')}.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-black/45 border-b border-black/5">
              <th className="py-2 pr-3 font-black">GW</th>
              {/* As published first: it is the record of what the app showed. */}
              <th className="py-2 pr-3 font-black text-right">Shown</th>
              <th className="py-2 pr-3 font-black text-right">Replay</th>
              <th className="py-2 pr-3 font-black text-right">+ Elite</th>
              <th className="py-2 pr-3 font-black text-right">FPL ep</th>
              <th className="py-2 pr-3 font-black text-right">±2 pts</th>
              <th className="py-2 pr-3 font-black text-right">Bias</th>
              <th className="py-2 pr-3 font-black text-right">Rank ρ</th>
              <th className="py-2 font-black text-right">Cohort</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.gameweek} className="border-b border-black/5 last:border-0">
                <td className="py-2 pr-3 font-black">{h.gameweek}</td>
                <td className="py-2 pr-3 text-right tabular-nums font-black">
                  {fmt(h.models.as_published?.mae)}
                  {h.publishedCoverage !== undefined && h.publishedCoverage < 1 && (
                    <span className="ml-1 text-[10px] font-bold text-amber-600">
                      {Math.round(h.publishedCoverage * 100)}%
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums font-bold">{fmt(h.models.base?.mae)}</td>
                <td className="py-2 pr-3 text-right tabular-nums font-bold">{fmt(h.models.elite?.mae)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-black/50">{fmt(h.models.ep_next?.mae)}</td>
                {/* Of the players projected at 3+, the set you actually pick from. */}
                <td className="py-2 pr-3 text-right tabular-nums font-bold">
                  {pct((h.models.as_published ?? h.models.base)?.within2Considered)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-black/50">
                  {signed((h.models.as_published ?? h.models.base)?.bias)}
                </td>
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

      <div className="text-[11px] text-black/45 mt-3 leading-snug space-y-1.5">
        <p>
          <strong className="text-black/60">Shown</strong> scores the forecast that was stored before
          the deadline — what the app actually said.{' '}
          <strong className="text-black/60">Replay</strong> rebuilds the same gameweek with today&apos;s
          engine from data that predates it. They diverge whenever the model changes, and only Shown
          is a record; a replay improves every time the engine does.
          {!anyPublished && ' No stored forecast has been scored yet, so Shown is empty.'}
        </p>
        <p>
          <strong className="text-black/60">±2 pts</strong> is how often the projection landed within
          two points, counting only players projected at 3 or more — the ones you would consider.{' '}
          <strong className="text-black/60">Bias</strong> is mean predicted minus actual, so a
          positive number means the model runs high; it is what the per-position correction is
          fitted on.
        </p>
        <p>
          <strong className="text-black/60">{promotion.eligible ? 'Elite signals qualify' : 'Elite signals on hold'}:</strong>{' '}
          {promotion.reason} The cohort column is manager-level and is not comparable to the
          player-level errors beside it.
        </p>
      </div>
    </div>
  );
}
