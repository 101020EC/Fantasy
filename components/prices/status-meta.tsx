import React from 'react';
import { Leaf, Rocket, TrendingDown, TrendingUp } from 'lucide-react';
import { PriceStatus } from '@/lib/types';

/**
 * One place deciding how each price status looks. The market table, the filter
 * chips and the summary cards all read from here, so a label and its icon can
 * never drift apart.
 *
 * Rocket and leaf blink; the two "trending" states do not. Blinking fades
 * opacity rather than animating transform — the earlier pulse fought the
 * leaf's rotation and cancelled it. Keyframes live in globals.css and honour
 * prefers-reduced-motion.
 */
export interface StatusMeta {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Extra classes for the icon — colour, rotation, pulse. */
  iconClass: string;
  /** Pill styling when the status is shown as a badge. */
  pillClass: string;
}

export const STATUS_META: Record<PriceStatus, StatusMeta> = {
  rising_soon: {
    label: 'Rising Tonight',
    Icon: Rocket,
    iconClass: 'text-emerald-600 animate-blink',
    pillClass: 'bg-emerald-600 text-white shadow-sm',
  },
  likely_riser: {
    label: 'Trending Up',
    Icon: TrendingUp,
    iconClass: 'text-emerald-600',
    pillClass: 'bg-emerald-100 text-emerald-800',
  },
  stable: {
    label: 'Neutral',
    Icon: TrendingUp,
    iconClass: 'text-gray-300',
    pillClass: 'bg-gray-100 text-gray-500',
  },
  likely_faller: {
    label: 'Trending Down',
    Icon: TrendingDown,
    iconClass: 'text-rose-600',
    pillClass: 'bg-rose-100 text-rose-800',
  },
  falling_soon: {
    label: 'Falling Tonight',
    // A leaf tipped off its stem — the falling-leaf reading, without a custom asset.
    Icon: Leaf,
    iconClass: 'text-rose-600 rotate-[135deg] animate-blink',
    pillClass: 'bg-rose-600 text-white shadow-sm',
  },
};

/** Status pill with its icon, used in the table's last column. */
export function StatusPill({ status }: { status: PriceStatus }) {
  const meta = STATUS_META[status];
  const showIcon = status !== 'stable';

  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${meta.pillClass}`}
    >
      <span>{meta.label}</span>
      {showIcon && (
        <meta.Icon
          className={`w-3.5 h-3.5 shrink-0 ${
            meta.pillClass.includes('text-white') ? 'text-white' : meta.iconClass
          }`}
        />
      )}
    </span>
  );
}
