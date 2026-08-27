'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, TrendingDown, TrendingUp } from 'lucide-react';
import { PriceChangeDay } from '@/lib/price-changes';
import { PriceAnalysis } from '@/lib/types';

interface PriceChangesProps {
  days: PriceChangeDay[];
  /** Used only to put a name and a club against an element id. */
  analyses: PriceAnalysis[];
}

/** A change that has been resolved to a player. */
interface Row {
  id: number;
  name: string;
  club: string;
  position: string;
  from: number;
  to: number;
  delta: number;
}

function money(tenths: number): string {
  // Tenths throughout, divided only here: 0.1 + 0.1 !== 0.2, and these get summed.
  return `£${(tenths / 10).toFixed(1)}m`;
}

function prettyDate(iso: string): string {
  const at = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(at.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(at);
}

/**
 * Price changes that have already happened, newest day first.
 *
 * Distinct from the rest of this page in tense, and the wording keeps that
 * separation: everything else here is a *prediction* about tonight, this is a
 * *record* of what FPL actually did. Merging them into one list would make a
 * player who already rose look like one about to.
 *
 * History starts at the second stored snapshot — one snapshot cannot be
 * diffed — so an empty state here is a real answer, not a failure.
 */
export default function PriceChanges({ days, analyses }: PriceChangesProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const lookup = useMemo(() => {
    const map = new Map<number, PriceAnalysis>();
    for (const a of analyses) map.set(a.elementId, a);
    return map;
  }, [analyses]);

  const resolved = useMemo(
    () =>
      days.map((day) => {
        const rows: Row[] = day.changes.map((c) => {
          const player = lookup.get(c.id);
          return {
            id: c.id,
            name: player?.webName ?? `#${c.id}`,
            club: player?.team.short_name ?? '',
            position: player?.elementType.singular_name_short ?? '',
            from: c.from,
            to: c.to,
            delta: c.delta,
          };
        });
        // Rises first, then falls; biggest mover leads each group.
        rows.sort((a, b) => b.delta - a.delta || Math.abs(b.delta) - Math.abs(a.delta));
        return { day, rows };
      }),
    [days, lookup]
  );

  if (!days.length) {
    return (
      <div className="pastel-card p-8 text-center shadow-sm">
        <CalendarClock className="w-8 h-8 mx-auto mb-3 text-gray-300" />
        <p className="font-black text-[#111318] text-sm">No price history yet</p>
        <p className="text-xs text-gray-500 mt-1.5 leading-snug max-w-md mx-auto">
          A change is the difference between two daily snapshots, so the first one appears the day
          after a second snapshot has been captured. Nothing is missing — there is simply nothing
          to compare yet.
        </p>
      </div>
    );
  }

  const earliest = resolved[resolved.length - 1]?.day.changedOn;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-400 font-bold px-1">
        History from {earliest ? prettyDate(earliest) : '—'}. Prices change daily between 08:30 and
        09:30 Bangkok.
      </p>

      {resolved.map(({ day, rows }) => {
        const isOpen = expanded.has(day.date);
        const shown = isOpen ? rows : rows.slice(0, 8);

        return (
          <div key={day.date} className="pastel-card overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-black text-[#111318] text-sm">{prettyDate(day.changedOn)}</p>
                <p className="text-[11px] text-gray-400 font-semibold">
                  {day.gameweek ? `Gameweek ${day.gameweek} · ` : ''}
                  {day.comparedPlayers.toLocaleString()} players compared
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
                  <TrendingUp className="w-3 h-3" />
                  {day.risesCount}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black">
                  <TrendingDown className="w-3 h-3" />
                  {day.fallsCount}
                </span>
              </div>
            </div>

            {/* A gap between snapshots compresses more than one night into a
                single delta. Saying so is the difference between a number and
                a misleading number. */}
            {day.spansGap && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900 font-bold leading-snug">
                  No snapshot between {prettyDate(day.previousDate)} and {prettyDate(day.date)}, so
                  these totals may cover more than one night.
                </p>
              </div>
            )}

            {rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-gray-400 font-bold">
                No prices moved on this day.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-black/5">
                  {shown.map((row) => {
                    const up = row.delta > 0;
                    return (
                      <li
                        key={row.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-sm ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {up ? '🔺' : '🔻'}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-[#111318] text-[13px] truncate">
                              {row.name}
                            </p>
                            <p className="text-[10px] text-gray-400 font-semibold">
                              {row.position} {row.club}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                          <span className="text-gray-400">{money(row.from)}</span>
                          <span className="text-gray-300">→</span>
                          <span className="font-black text-[#111318]">{money(row.to)}</span>
                          <span
                            className={`font-black w-14 text-right ${
                              up ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {up ? '+' : '−'}
                            {money(Math.abs(row.delta))}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {rows.length > 8 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(day.date)) next.delete(day.date);
                        else next.add(day.date);
                        return next;
                      })
                    }
                    className="w-full py-2.5 text-[11px] font-black text-[#38003c] hover:bg-purple-50 transition border-t border-black/5"
                  >
                    {isOpen ? 'Show fewer' : `Show all ${rows.length}`}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
