import React from 'react';
import { FPLElement, FPLEntry, FPLPicksResponse } from '@/lib/types';
import { squadValue } from '@/lib/squad-value';

interface TeamHeaderProps {
  entry: FPLEntry;
  picksData: FPLPicksResponse;
  /** True when previewing a gameweek that has not been played yet. */
  isPreview?: boolean;
  /** The gameweek the squad belongs to — the last one with picks. */
  squadGw?: number;
  /** The gameweek being previewed, when that is a different one. */
  shownGw?: number;
  elements?: FPLElement[];
  /** From /entry/{id}/transfers/, for purchase prices. Absent is fine. */
  transfers?: any[];
}

function money(tenths: number): string {
  return (tenths / 10).toFixed(1);
}

function Tile({
  label,
  value,
  note,
  tone = 'plain',
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  tone?: 'plain' | 'blue' | 'emerald' | 'purple' | 'orange';
}) {
  const valueTone =
    tone === 'emerald'
      ? 'text-emerald-600'
      : tone === 'purple'
      ? 'text-purple-600'
      : tone === 'orange'
      ? 'text-pastel-orangeDark'
      : 'text-[#111318]';
  return (
    <div className={`p-3.5 rounded-2xl text-center ${tone === 'blue' ? 'bg-pastel-blueLight' : 'bg-pastel-bg'}`}>
      <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">{label}</span>
      <span className={`text-base font-black truncate block ${valueTone}`}>{value}</span>
      {note && <span className="block text-[10px] text-gray-400 font-semibold mt-0.5">{note}</span>}
    </div>
  );
}

/**
 * Two clocks, two headings.
 *
 * These numbers do not all describe the same period: total points and rank are
 * the season to date, gameweek points belong to one week. Printed side by side
 * with no heading they contradicted each other on sight — "53 points" next to a
 * dash for a week that has not kicked off reads as points appearing out of
 * nowhere.
 */
export default function TeamHeader({
  entry,
  picksData,
  isPreview = false,
  squadGw,
  shownGw,
  elements = [],
  transfers = [],
}: TeamHeaderProps) {
  const history = picksData?.entry_history;
  const dash = '—';

  const bank =
    history?.bank != null
      ? money(history.bank)
      : entry.last_deadline_bank != null
      ? money(entry.last_deadline_bank)
      : '0.0';

  const gwPoints = history?.points ?? entry.summary_event_points ?? 0;
  const totalPoints = history?.total_points ?? entry.summary_overall_points ?? 0;
  const overallRank = history?.overall_rank ?? entry.summary_overall_rank ?? null;
  const gwRank = history?.rank ?? entry.summary_event_rank ?? null;

  // Selling value, not market value. FPL gives back half of a rise, rounded
  // down, and none of a fall — so a squad whose players have all risen 0.1 is
  // worth exactly what it was. Summing `now_cost` would claim otherwise, and
  // the deadline figure this used to show goes stale the moment a price moves.
  const computed = elements.length ? squadValue(picksData?.picks, elements, transfers) : null;
  const market = computed
    ? (picksData?.picks ?? []).reduce((sum, p) => {
        const el = elements.find((e) => e.id === p.element);
        return sum + (el?.now_cost ?? 0);
      }, 0)
    : 0;
  const lockedIn = computed ? market - computed.selling : 0;

  const value = computed
    ? money(computed.selling)
    : history?.value
    ? money(history.value)
    : entry.last_deadline_value
    ? money(entry.last_deadline_value)
    : '100.0';

  // The question this answers: "prices moved, why has my value not?" Because
  // FPL rounds the manager's half down, and small rises are worth nothing until
  // they add up.
  const valueNote = computed
    ? lockedIn > 0
      ? `£${money(market)}m on the market · £${money(lockedIn)}m not yet realisable`
      : computed.profit > 0
      ? `£${money(computed.profit)}m of profit banked`
      : 'Sell value — half of every rise, all of every fall'
    : undefined;

  return (
    <div className="pastel-card p-5 sm:p-7 shadow-sm mb-6 transition-colors space-y-5">
      <section>
        <h3 className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2 px-1">
          {shownGw ? `Gameweek ${shownGw}` : 'This gameweek'}
          {isPreview && <span className="text-gray-300 normal-case"> · not played yet</span>}
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <Tile label="GW Points" value={isPreview ? dash : gwPoints} tone="blue" />
          <Tile
            label="GW Rank"
            value={isPreview ? dash : gwRank ? `#${gwRank.toLocaleString()}` : '-'}
            tone="orange"
          />
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2 px-1">
          Season so far
          {squadGw && <span className="text-gray-300 normal-case"> · through GW{squadGw}</span>}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Tile label="Total Points" value={totalPoints} />
          <Tile
            label="Overall Rank"
            value={overallRank ? `#${overallRank.toLocaleString()}` : '-'}
          />
          <Tile label="Squad Value" value={`£${value}m`} note={valueNote} tone="emerald" />
          <Tile label="In The Bank" value={`£${bank}m`} tone="purple" />
        </div>
      </section>
    </div>
  );
}
