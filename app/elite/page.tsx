import React from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronRight, Info } from 'lucide-react';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { ANALYST_ENABLED, seasonKey } from '@/lib/analyst';
import {
  readEliteCohort,
  readEliteDerived,
  readEliteSnapshot,
  storedEliteGameweeksAny,
} from '@/lib/analyst-store';
import { ELITE_DERIVED_FIELDS } from '@/lib/types';
import { playerLookup, readAllManagers } from '@/lib/elite-view';
import EliteSummary, { EliteRow } from '@/components/elite/EliteSummary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
  searchParams: Promise<{ gw?: string }>;
}

const CHIP_LABEL: Record<string, string> = {
  bboost: 'Bench Boost',
  '3xc': 'Triple Captain',
  freehit: 'Free Hit',
  wildcard: 'Wildcard',
  manager: 'Manager',
};

export default async function ElitePage({ searchParams }: Props) {
  const { gw } = await searchParams;

  if (!ANALYST_ENABLED || !isAdminConfigured) {
    return <Empty title="Elite Cohort is off" body="ANALYST_ENABLED is false, or Firestore is not configured, so no cohort data is captured." />;
  }

  const bootstrap = await fetchFPLBootstrap();
  const season = seasonKey(bootstrap);
  const captured = await storedEliteGameweeksAny(season).catch((): number[] => []);

  if (!captured.length) {
    return (
      <Empty
        title="Nothing captured yet"
        body="The cohort is configured but no gameweek has been captured. The nightly job captures a gameweek once its deadline has passed."
      />
    );
  }

  const requested = Number(gw);
  const gameweek = captured.includes(requested) ? requested : captured[captured.length - 1];

  const [derived, snapshot, cohort] = await Promise.all([
    readEliteDerived(season, gameweek),
    readEliteSnapshot(season, gameweek),
    readEliteCohort(season).catch(() => null),
  ]);

  if (!derived || !snapshot) {
    return <Empty title={`No data for GW${gameweek}`} body="The snapshot for this gameweek is missing." />;
  }

  const available = derived.availableManagerCount;
  const F = (name: (typeof ELITE_DERIVED_FIELDS)[number]) => derived.fields.indexOf(name);
  const look = playerLookup(bootstrap);
  const general = new Map(
    bootstrap.elements.map((e) => [e.id, Number(e.selected_by_percent) || 0])
  );

  // Counts on disk, percentages here — against the denominator recorded in the
  // same document. A stored percentage goes silently wrong the moment
  // availableManagerCount changes.
  const rows: EliteRow[] = Object.entries(derived.players).map(([id, counts]) => {
    const elementId = Number(id);
    const owned = counts[F('owned')] ?? 0;
    const captained = counts[F('captained')] ?? 0;
    const info = look(elementId);
    const eeo = available > 0 ? ((owned + captained) / available) * 100 : null;
    const generalPct = general.get(elementId) ?? 0;
    return {
      elementId,
      name: info.name,
      club: info.club,
      position: info.position,
      owned,
      captained,
      transferredIn: counts[F('transferredIn')] ?? 0,
      transferredOut: counts[F('transferredOut')] ?? 0,
      effectiveOwnershipPct: eeo,
      generalPct,
      deltaEO: eeo === null ? null : eeo - generalPct,
    };
  });

  const roster = Object.fromEntries(
    Object.entries(cohort?.managers ?? {}).map(([id, m]: [string, any]) => [
      id,
      { teamName: m.teamName, managerName: m.managerName, qualification: m.qualification },
    ])
  );
  const managers = readAllManagers(snapshot, roster);
  const chips = Object.entries(derived.chips ?? {}).filter(([, n]) => n > 0);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-2 pb-6 sm:pt-3 space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#111318] tracking-tight">
            Elite Cohort
          </h1>
          <p className="text-[11px] text-gray-400 font-bold mt-0.5">
            {available} managers · Gameweek {gameweek}
            {!snapshot.dataChecked && ' · provisional'}
          </p>
        </div>
        {captured.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {captured.map((n) => (
              <Link
                key={n}
                href={`/elite?gw=${n}`}
                className={`px-3 py-1.5 rounded-full text-[11px] font-black transition ${
                  n === gameweek
                    ? 'bg-[#111318] text-white'
                    : 'bg-white border border-black/5 text-[#38003c] hover:bg-purple-50'
                }`}
              >
                GW {n}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* What this sample is. Stated before any number, because a
          survivorship-selected group of twenty reads as authority unless it is
          named as a sample. */}
      <div className="rounded-2xl bg-purple-50 border border-purple-200 p-3.5 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#38003c] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#38003c] font-semibold leading-snug">
          Twenty managers picked for <em>past</em> Top 1K finishes. They read the same public
          information as everyone else and their choices correlate, so this is a consensus among
          strong managers — not a population statistic and not proof anyone is right.
          {!snapshot.dataChecked &&
            ' Squads and transfers below are final; points and ranks are still provisional.'}
        </p>
      </div>

      {derived.missing?.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-900 font-bold leading-snug">
            {derived.cohortSize - available} of {derived.cohortSize} managers were unreachable this
            gameweek, so every percentage is out of {available}, not {derived.cohortSize}.
          </p>
        </div>
      )}

      {chips.length > 0 && (
        <div className="pastel-card p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">
            Chips played
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {chips.map(([chip, n]) => (
              <span
                key={chip}
                className="px-3 py-1.5 rounded-full bg-[#38003c] text-white text-[11px] font-black"
              >
                {CHIP_LABEL[chip] ?? chip} · {n}
              </span>
            ))}
          </div>
          {(derived.chips?.bboost ?? 0) > available / 2 && (
            <p className="text-[10px] text-gray-400 font-semibold mt-2 leading-snug">
              Bench Boost counts all fifteen as playing, so &ldquo;started&rdquo; is not a
              meaningful distinction this gameweek.
            </p>
          )}
        </div>
      )}

      <EliteSummary rows={rows} available={available} gameweek={gameweek} />

      <section className="pastel-card overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-black/5">
          <h2 className="font-black text-[#111318] text-sm">The managers</h2>
          <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
            Ranked by overall rank in GW{gameweek}. Open one to see the squad.
          </p>
        </div>
        <ul className="divide-y divide-black/5">
          {managers.map((m) => (
            <li key={m.managerId}>
              <Link
                href={`/elite/${m.managerId}?gw=${gameweek}`}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-purple-50 transition"
              >
                <div className="min-w-0">
                  <p className="font-bold text-[#111318] text-[13px] truncate">{m.teamName}</p>
                  <p className="text-[10px] text-gray-400 font-semibold truncate">
                    {m.managerName}
                    {m.activeChip ? ` · ${CHIP_LABEL[m.activeChip] ?? m.activeChip}` : ''}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-black text-[13px] text-[#111318]">{m.points ?? '—'} pts</p>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      {m.overallRank ? `#${m.overallRank.toLocaleString()}` : '—'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="p-8 rounded-4xl bg-white border border-black/5 shadow-xl">
        <h2 className="text-xl font-black text-[#111318] mb-2">{title}</h2>
        <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
