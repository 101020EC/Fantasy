'use client';

import React, { useState } from 'react';

/**
 * FPL always sends `chance_of_playing_next_round` alongside a flag — 0 for out,
 * 25/50/75 for doubtful — so the percentage is a complete summary on its own.
 * The sentence behind it ("Thigh injury - 75% chance of playing") repeats the
 * number and costs a whole line, so it stays folded until asked for.
 */
function tone(chance: number) {
  if (chance <= 0) return 'bg-rose-100 text-rose-700 hover:bg-rose-200';
  if (chance <= 25) return 'bg-rose-50 text-rose-600 hover:bg-rose-100';
  if (chance <= 50) return 'bg-orange-100 text-orange-700 hover:bg-orange-200';
  return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
}

export default function AvailabilityChip({
  chance,
  news,
}: {
  chance: number | null;
  news: string;
}) {
  const [open, setOpen] = useState(false);
  if (!news && chance === null) return null;

  const pct = chance ?? 0;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? 'Hide details' : news}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black transition ${tone(pct)}`}
      >
        <span className="text-[10px] leading-none">⚠️</span>
        <span>{pct}%</span>
      </button>

      {open && news && (
        <p className="mt-1 text-[10px] text-rose-600 font-medium leading-snug max-w-[280px] sm:max-w-[420px]">
          {news}
        </p>
      )}
    </div>
  );
}
