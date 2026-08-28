import React from 'react';
import { Crown, ArrowRightLeft, Users, TrendingUp } from 'lucide-react';

export interface EliteRow {
  elementId: number;
  name: string;
  club: string;
  position: string;
  owned: number;
  captained: number;
  transferredIn: number;
  transferredOut: number;
  effectiveOwnershipPct: number | null;
  generalPct: number;
  deltaEO: number | null;
}

function Bar({ value, tone }: { value: number; tone: 'purple' | 'amber' | 'emerald' }) {
  const bg = { purple: 'bg-[#38003c]', amber: 'bg-amber-500', emerald: 'bg-emerald-500' }[tone];
  return (
    <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
      <div
        className={`h-full rounded-full ${bg}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function PlayerLine({
  row,
  right,
  sub,
  bar,
}: {
  row: EliteRow;
  right: React.ReactNode;
  sub?: React.ReactNode;
  bar?: { value: number; tone: 'purple' | 'amber' | 'emerald' };
}) {
  return (
    <li className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-[#111318] text-[13px] truncate">{row.name}</p>
          <p className="text-[10px] text-gray-400 font-semibold">
            {row.position} {row.club}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-black text-[13px] text-[#111318]">{right}</div>
          {sub && <div className="text-[10px] text-gray-400 font-semibold">{sub}</div>}
        </div>
      </div>
      {bar && <div className="mt-1.5">{<Bar {...bar} />}</div>}
    </li>
  );
}

function Section({
  title,
  hint,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  empty?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="pastel-card overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-black/5">
        <h2 className="font-black text-[#111318] text-sm flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#38003c]" />
          {title}
        </h2>
        <p className="text-[11px] text-gray-400 font-semibold mt-0.5 leading-snug">{hint}</p>
      </div>
      {empty ? (
        <p className="px-4 py-6 text-center text-xs text-gray-400 font-bold leading-snug">{empty}</p>
      ) : (
        <ul className="divide-y divide-black/5">{children}</ul>
      )}
    </section>
  );
}

export default function EliteSummary({
  rows,
  available,
  gameweek,
}: {
  rows: EliteRow[];
  available: number;
  gameweek: number;
}) {
  const pct = (n: number) => (available > 0 ? (n / available) * 100 : 0);

  const template = [...rows].sort((a, b) => b.owned - a.owned).slice(0, 12);
  const captains = rows.filter((r) => r.captained > 0).sort((a, b) => b.captained - a.captained);
  const movedIn = rows
    .filter((r) => r.transferredIn > 0)
    .sort((a, b) => b.transferredIn - a.transferredIn)
    .slice(0, 10);
  const movedOut = rows
    .filter((r) => r.transferredOut > 0)
    .sort((a, b) => b.transferredOut - a.transferredOut)
    .slice(0, 10);
  const ahead = [...rows]
    .filter((r) => r.deltaEO !== null)
    .sort((a, b) => (b.deltaEO ?? 0) - (a.deltaEO ?? 0))
    .slice(0, 10);

  return (
    <div className="space-y-3">
      <Section
        title="The template"
        hint={`Players the cohort holds in common, out of ${available} managers.`}
        icon={Users}
      >
        {template.map((r) => (
          <PlayerLine
            key={r.elementId}
            row={r}
            right={`${r.owned}/${available}`}
            sub={`${pct(r.owned).toFixed(0)}%`}
            bar={{ value: pct(r.owned), tone: 'purple' }}
          />
        ))}
      </Section>

      <Section
        title="Captains"
        hint="Where the cohort concentrates its risk. A captain counts twice toward rank."
        icon={Crown}
        empty={captains.length ? undefined : 'No captain recorded for this gameweek.'}
      >
        {captains.map((r) => (
          <PlayerLine
            key={r.elementId}
            row={r}
            right={`${r.captained}/${available}`}
            sub={`${pct(r.captained).toFixed(0)}%`}
            bar={{ value: pct(r.captained), tone: 'amber' }}
          />
        ))}
      </Section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Section
          title="Transferred in"
          hint={`Bought for GW${gameweek}.`}
          icon={ArrowRightLeft}
          empty={
            movedIn.length
              ? undefined
              : gameweek === 1
              ? 'Nobody transfers into the first gameweek — every squad here is an opening squad.'
              : 'No transfers recorded for this gameweek.'
          }
        >
          {movedIn.map((r) => (
            <PlayerLine key={r.elementId} row={r} right={`+${r.transferredIn}`} />
          ))}
        </Section>

        <Section
          title="Transferred out"
          hint={`Sold before GW${gameweek}.`}
          icon={ArrowRightLeft}
          empty={
            movedOut.length
              ? undefined
              : gameweek === 1
              ? 'Nothing to sell yet.'
              : 'No transfers recorded for this gameweek.'
          }
        >
          {movedOut.map((r) => (
            <PlayerLine key={r.elementId} row={r} right={`−${r.transferredOut}`} />
          ))}
        </Section>
      </div>

      <Section
        title="Ahead of the crowd"
        hint="Cohort effective ownership minus general ownership, in percentage points. The gap is the point: it is where these managers differ from everyone else, not merely who they own."
        icon={TrendingUp}
      >
        {ahead.map((r) => (
          <PlayerLine
            key={r.elementId}
            row={r}
            right={<span className="text-emerald-600">+{(r.deltaEO ?? 0).toFixed(0)}</span>}
            sub={`${(r.effectiveOwnershipPct ?? 0).toFixed(0)}% vs ${r.generalPct.toFixed(1)}%`}
            bar={{ value: r.deltaEO ?? 0, tone: 'emerald' }}
          />
        ))}
      </Section>
    </div>
  );
}
