import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Crown, Shield } from 'lucide-react';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { ANALYST_ENABLED, seasonKey } from '@/lib/analyst';
import { readEliteCohort, readEliteSnapshot, storedEliteGameweeksAny } from '@/lib/analyst-store';
import { playerLookup, readManager } from '@/lib/elite-view';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gw?: string }>;
}

const CHIP_LABEL: Record<string, string> = {
  bboost: 'Bench Boost',
  '3xc': 'Triple Captain',
  freehit: 'Free Hit',
  wildcard: 'Wildcard',
  manager: 'Manager',
};

/**
 * One cohort manager's squad, from the stored snapshot.
 *
 * Deliberately NOT a link into /team/[id]: that page calls setSavedTeamId on
 * mount, so browsing an elite squad through it would quietly switch the reader's
 * own team to someone else's. It also renders the live squad rather than the
 * gameweek being studied, and would put twenty more teams' worth of traffic on
 * the FPL API for data already sitting in Firestore.
 */
export default async function EliteManagerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { gw } = await searchParams;
  const managerId = Number(id);

  if (!ANALYST_ENABLED || !isAdminConfigured || !Number.isInteger(managerId)) {
    return <Missing message="This manager is not available." />;
  }

  const bootstrap = await fetchFPLBootstrap();
  const season = seasonKey(bootstrap);
  const captured = await storedEliteGameweeksAny(season).catch((): number[] => []);
  if (!captured.length) return <Missing message="No cohort gameweek has been captured yet." />;

  const requested = Number(gw);
  const gameweek = captured.includes(requested) ? requested : captured[captured.length - 1];

  const [snapshot, cohort] = await Promise.all([
    readEliteSnapshot(season, gameweek),
    readEliteCohort(season).catch(() => null),
  ]);
  if (!snapshot) return <Missing message={`No snapshot stored for GW${gameweek}.`} />;

  const rosterEntry: any = (cohort?.managers as any)?.[String(managerId)];
  const manager = readManager(snapshot, managerId, {
    teamName: rosterEntry?.teamName,
    managerName: rosterEntry?.managerName,
    qualification: rosterEntry?.qualification,
  });
  if (!manager) return <Missing message="This manager was not captured for this gameweek." />;

  const look = playerLookup(bootstrap);
  const starters = manager.picks.filter((p) => p.position <= 11);
  const bench = manager.picks.filter((p) => p.position > 11);
  const money = (tenths: number | null) => (tenths == null ? '—' : (tenths / 10).toFixed(1));

  const Row = ({ p, benched }: { p: (typeof manager.picks)[number]; benched?: boolean }) => {
    const info = look(p.element);
    const subbedOn = manager.subbedOn.includes(p.element);
    const subbedOff = manager.subbedOff.includes(p.element);
    return (
      <li className="px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 text-[10px] font-black text-gray-400 shrink-0">{info.position}</span>
          <div className="min-w-0">
            <p className="font-bold text-[#111318] text-[13px] truncate flex items-center gap-1.5">
              {info.name}
              {p.isCaptain && <Crown className="w-3 h-3 text-amber-500" />}
              {p.isViceCaptain && <Shield className="w-3 h-3 text-gray-400" />}
            </p>
            <p className="text-[10px] text-gray-400 font-semibold">
              {info.club}
              {subbedOn && ' · subbed on'}
              {subbedOff && ' · subbed off'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-black text-[12px] text-[#111318]">
            £{info.cost == null ? '—' : info.cost.toFixed(1)}m
          </p>
          {/* multiplier is the authoritative signal: 0 benched, 1 playing,
              2 captain, 3 triple captain — and 1 for all fifteen under Bench
              Boost, which is how that chip reads back. */}
          <p className="text-[10px] text-gray-400 font-semibold">
            {p.multiplier === 0 ? (benched ? 'bench' : 'not played') : `×${p.multiplier}`}
          </p>
        </div>
      </li>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 pt-2 pb-6 sm:pt-3 space-y-3">
      <Link
        href={`/elite?gw=${gameweek}`}
        className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#38003c]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Elite Cohort
      </Link>

      <div className="pastel-card p-5 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-black text-[#111318] tracking-tight">
          {manager.teamName}
        </h1>
        <p className="text-[11px] text-gray-400 font-bold mt-0.5">
          {manager.managerName} · GW{gameweek}
          {!snapshot.dataChecked && ' · provisional'}
          {manager.activeChip ? ` · ${CHIP_LABEL[manager.activeChip] ?? manager.activeChip}` : ''}
        </p>
        {manager.qualification && (
          <p className="text-[10px] text-gray-400 font-semibold mt-1">{manager.qualification}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
          <Tile label="GW Points" value={manager.points ?? '—'} />
          <Tile
            label="Overall Rank"
            value={manager.overallRank ? `#${manager.overallRank.toLocaleString()}` : '—'}
          />
          <Tile label="Squad Value" value={`£${money(manager.value)}m`} />
          <Tile label="In The Bank" value={`£${money(manager.bank)}m`} />
        </div>
      </div>

      {manager.transfers.length > 0 && (
        <section className="pastel-card overflow-hidden shadow-sm">
          <h2 className="px-4 py-3 border-b border-black/5 font-black text-[#111318] text-sm">
            Transfers for GW{gameweek}
          </h2>
          <ul className="divide-y divide-black/5">
            {manager.transfers.map((t, i) => (
              <li key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 text-[13px]">
                <span className="font-bold text-emerald-700">
                  ▲ {look(t.inId).name}{' '}
                  <span className="text-[10px] text-gray-400">£{(t.inCost / 10).toFixed(1)}m</span>
                </span>
                <span className="font-bold text-rose-700">
                  ▼ {look(t.outId).name}{' '}
                  <span className="text-[10px] text-gray-400">£{(t.outCost / 10).toFixed(1)}m</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pastel-card overflow-hidden shadow-sm">
        <h2 className="px-4 py-3 border-b border-black/5 font-black text-[#111318] text-sm">
          Starting XI
        </h2>
        <ul className="divide-y divide-black/5">
          {starters.map((p) => (
            <Row key={p.element} p={p} />
          ))}
        </ul>
      </section>

      <section className="pastel-card overflow-hidden shadow-sm">
        <h2 className="px-4 py-3 border-b border-black/5 font-black text-[#111318] text-sm">
          Substitutes
        </h2>
        <ul className="divide-y divide-black/5">
          {bench.map((p) => (
            <Row key={p.element} p={p} benched />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-3 rounded-2xl bg-pastel-bg text-center">
      <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">{label}</span>
      <span className="text-base font-black text-[#111318] truncate block">{value}</span>
    </div>
  );
}

function Missing({ message }: { message: string }) {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="p-8 rounded-4xl bg-white border border-black/5 shadow-xl">
        <h2 className="text-xl font-black text-[#111318] mb-2">Not available</h2>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">{message}</p>
        <Link
          href="/elite"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#38003c] text-white font-black text-xs"
        >
          Back to the cohort
        </Link>
      </div>
    </div>
  );
}
