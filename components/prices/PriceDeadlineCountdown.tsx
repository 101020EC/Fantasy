'use client';

import React from 'react';
import { Clock } from 'lucide-react';

/**
 * Time remaining until FPL next moves prices.
 *
 * The deadline comes from FPL (`game_config.settings.price_change_deadlines`),
 * not from a constant here. This box used to read "01:30 - 02:30 UTC" — true
 * when it was written, and quietly wrong once the game moved the window to
 * 23:00Z, with nothing in the app able to notice.
 *
 * A client component because the page is a `force-dynamic` server render: the
 * server can supply the instant, but only the browser can count down to it.
 */
export default function PriceDeadlineCountdown({ deadline }: { deadline: string | null }) {
  const target = React.useMemo(() => (deadline ? Date.parse(deadline) : NaN), [deadline]);
  // Rendered empty on the server and on the first client paint, then filled in:
  // any clock-derived text differs between the two and would be a hydration
  // mismatch. The box keeps its size either way, so nothing jumps.
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!Number.isFinite(target)) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!Number.isFinite(target)) return null;

  const localTime = new Date(target).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  let remaining = '';
  if (now !== null) {
    const left = Math.max(0, target - now);
    const pad = (n: number) => String(n).padStart(2, '0');
    remaining = `${pad(Math.floor(left / 3600000))}:${pad(
      Math.floor(left / 60000) % 60
    )}:${pad(Math.floor(left / 1000) % 60)}`;
  }

  return (
    <div className="px-3 py-1.5 rounded-2xl bg-white border border-black/5 flex items-center gap-2 text-xs shadow-sm shrink-0">
      <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold shrink-0">
        <Clock className="w-3.5 h-3.5" />
      </div>
      <div className="leading-tight">
        <span className="font-black text-[#111318] block text-[10px] sm:text-xs">
          Next Price Change
        </span>
        <span className="block text-[10px] sm:text-xs font-bold text-[#38003c] tabular-nums">
          {remaining || ' '}
        </span>
        <span className="block text-gray-400 text-[9px] sm:text-[10px]">
          {localTime} local
        </span>
      </div>
    </div>
  );
}
