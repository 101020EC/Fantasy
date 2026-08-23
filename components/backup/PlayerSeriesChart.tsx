'use client';

import React, { useMemo, useState } from 'react';

export interface SeriesPoint {
  date: string;
  price: number;
  netTransfers: number;
  ownership: number;
  status: string;
  news: string;
}

const SERIES = [
  { key: 'price', label: 'Price', unit: '£', colour: '#059669' },
  { key: 'netTransfers', label: 'Net transfers', unit: '', colour: '#7c3aed' },
  { key: 'ownership', label: 'Ownership', unit: '%', colour: '#ea580c' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

const W = 720;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

/**
 * Hand-drawn SVG rather than a charting library: the app ships a deliberately
 * small dependency list, and one line over dates does not justify ~100 kB.
 *
 * Each series is normalised to its own 0..1 range so three quantities with
 * nothing in common — pounds, transfer counts, percent — share one plot. That
 * makes shape and timing comparable, which is the question here (does a
 * transfer spike lead a price move?), not absolute values.
 */
export default function PlayerSeriesChart({ series }: { series: SeriesPoint[] }) {
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    price: true,
    netTransfers: true,
    ownership: false,
  });
  const [hover, setHover] = useState<number | null>(null);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const scales = useMemo(() => {
    const out = {} as Record<SeriesKey, { min: number; max: number }>;
    for (const s of SERIES) {
      const values = series.map((p) => p[s.key]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      // A flat series would divide by zero; give it a band so it draws mid-height.
      out[s.key] = min === max ? { min: min - 1, max: max + 1 } : { min, max };
    }
    return out;
  }, [series]);

  if (series.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-gray-400">
        Nothing captured for this player yet.
      </div>
    );
  }

  const x = (i: number) =>
    PAD.left + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const y = (key: SeriesKey, value: number) => {
    const { min, max } = scales[key];
    return PAD.top + plotH - ((value - min) / (max - min)) * plotH;
  };

  const injuredSpans = series
    .map((p, i) => ({ i, injured: p.status !== 'a' }))
    .filter((p) => p.injured);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setVisible((v) => ({ ...v, [s.key]: !v[s.key] }))}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              visible[s.key] ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            style={visible[s.key] ? { backgroundColor: s.colour } : undefined}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: visible[s.key] ? '#fff' : s.colour }} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[520px]"
          role="img"
          aria-label="Captured history for this player"
          onMouseLeave={() => setHover(null)}
        >
          {/* Horizontal guides */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={PAD.top + f * plotH}
              y2={PAD.top + f * plotH}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}

          {/* Days the player carried an injury flag */}
          {injuredSpans.map(({ i }) => (
            <rect
              key={`inj-${i}`}
              x={x(i) - 3}
              y={PAD.top}
              width={6}
              height={plotH}
              fill="#f43f5e"
              opacity={0.12}
            />
          ))}

          {SERIES.filter((s) => visible[s.key]).map((s) => {
            const d = series
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(s.key, p[s.key]).toFixed(1)}`)
              .join(' ');
            return (
              <g key={s.key}>
                <path d={d} fill="none" stroke={s.colour} strokeWidth="2.5" strokeLinejoin="round" />
                {series.map((p, i) => (
                  <circle key={i} cx={x(i)} cy={y(s.key, p[s.key])} r={series.length > 40 ? 0 : 3} fill={s.colour} />
                ))}
              </g>
            );
          })}

          {/* Hover targets */}
          {series.map((p, i) => (
            <rect
              key={`hit-${i}`}
              x={x(i) - plotW / Math.max(series.length, 1) / 2}
              y={PAD.top}
              width={plotW / Math.max(series.length, 1)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}

          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="#9ca3af"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* First and last date only — enough to place the span */}
          <text x={PAD.left} y={H - 8} fontSize="11" fill="#9ca3af">
            {series[0].date}
          </text>
          {series.length > 1 && (
            <text x={W - PAD.right} y={H - 8} fontSize="11" fill="#9ca3af" textAnchor="end">
              {series[series.length - 1].date}
            </text>
          )}
        </svg>
      </div>

      <div className="mt-3 min-h-[3.5rem] p-3 rounded-2xl bg-gray-50 border border-black/5 text-xs">
        {hover === null ? (
          <span className="text-gray-400">Hover the chart for a day&apos;s numbers.</span>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-black text-[#111318]">{series[hover].date}</span>
            <span className="text-emerald-700 font-bold">£{series[hover].price.toFixed(1)}m</span>
            <span className="text-purple-700 font-bold">
              Net {series[hover].netTransfers > 0 ? '+' : ''}
              {series[hover].netTransfers.toLocaleString()}
            </span>
            <span className="text-orange-700 font-bold">{series[hover].ownership}% owned</span>
            {series[hover].news && (
              <span className="text-rose-600 font-medium">⚠️ {series[hover].news}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
