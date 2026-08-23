'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Loader2, AlertCircle, Check, Search, History, Save } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import PlayerSeriesChart, { SeriesPoint } from '@/components/backup/PlayerSeriesChart';

interface Status {
  configured: boolean;
  message?: string;
  dayCount?: number;
  firstDate?: string | null;
  lastDate?: string | null;
  missingDates?: string[];
  lastCapturedAt?: string | null;
  roster?: {
    playerCount: number;
    updatedAt: string;
    fields: string[];
    players: Record<string, (string | number | null)[]>;
  } | null;
  leagues?: { leagueId: string; leagueName: string; gameweeks: number[]; reconstructed: number }[];
}

export default function BackupPage() {
  const { savedTeamId } = useAuth();

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ id: number; name: string; club: string } | null>(null);
  const [series, setSeries] = useState<SeriesPoint[] | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);

  const [leagues, setLeagues] = useState<any[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [backfillError, setBackfillError] = useState(false);

  const refreshStatus = useCallback(() => {
    setLoading(true);
    fetch('/api/market/status')
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refreshStatus, [refreshStatus]);

  // Only invitational leagues can be rebuilt — a system league runs to millions
  // of members and reconstruction costs one request each.
  useEffect(() => {
    if (!savedTeamId) return;
    fetch(`/api/fpl/entry/${savedTeamId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((entry) => {
        const priv = (entry?.leagues?.classic ?? []).filter((l: any) => l.league_type === 'x');
        setLeagues(priv);
        try {
          const saved = localStorage.getItem(`fpl_selected_leagues_${savedTeamId}`);
          setPicked(saved ? JSON.parse(saved) : priv.map((l: any) => Number(l.id)));
        } catch {
          setPicked(priv.map((l: any) => Number(l.id)));
        }
      })
      .catch(() => setLeagues([]));
  }, [savedTeamId]);

  const roster = status?.roster;

  const matches = useMemo(() => {
    if (!roster || query.trim().length < 2) return [];
    const fields = roster.fields;
    const nameAt = fields.indexOf('web_name');
    const teamAt = fields.indexOf('team');
    const q = query.trim().toLowerCase();

    return Object.entries(roster.players)
      .filter(([, v]) => String(v[nameAt] ?? '').toLowerCase().includes(q))
      .slice(0, 8)
      .map(([id, v]) => ({ id: Number(id), name: String(v[nameAt]), club: String(v[teamAt] ?? '') }));
  }, [roster, query]);

  const openPlayer = (p: { id: number; name: string; club: string }) => {
    setSelected(p);
    setQuery('');
    setSeriesLoading(true);
    fetch(`/api/market/player?id=${p.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSeries(d?.series ?? []))
      .catch(() => setSeries([]))
      .finally(() => setSeriesLoading(false));
  };

  const togglePick = (id: number) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    setPicked(next);
    if (savedTeamId) {
      localStorage.setItem(`fpl_selected_leagues_${savedTeamId}`, JSON.stringify(next));
    }
  };

  const runBackfill = async () => {
    setBackfilling(true);
    setBackfillResult(null);
    setBackfillError(false);
    try {
      const res = await fetch('/api/leagues/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueIds: picked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rebuild failed');

      const written = (data.results ?? []).reduce((n: number, r: any) => n + (r.written ?? 0), 0);
      const skipped = (data.results ?? []).reduce((n: number, r: any) => n + (r.skipped ?? 0), 0);
      setBackfillResult(
        data.message ??
          `Wrote ${written} gameweek${written === 1 ? '' : 's'} across ${data.results.length} league${
            data.results.length === 1 ? '' : 's'
          }${skipped ? `, leaving ${skipped} captured live untouched` : ''}.`
      );
      refreshStatus();
    } catch (err: any) {
      setBackfillError(true);
      setBackfillResult(err.message);
    } finally {
      setBackfilling(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-16 flex justify-center">
        <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-4xl bg-white border border-amber-200 shadow-xl">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Database className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-[#111318] mb-2">Backup is not set up</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            {status?.message ?? 'The server has no Firebase credentials.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111318] tracking-tight">Backup</h1>
          <p className="text-xs text-gray-500">What has been captured, and what it shows</p>
        </div>
      </div>

      {/* Archive health */}
      <div className="pastel-card p-5 sm:p-6 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          <Stat label="Days captured" value={String(status.dayCount ?? 0)} />
          <Stat label="First" value={status.firstDate ?? '—'} />
          <Stat label="Latest" value={status.lastDate ?? '—'} />
          <Stat label="Players tracked" value={String(status.roster?.playerCount ?? 0)} />
        </div>

        {(status.missingDates?.length ?? 0) > 0 ? (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {status.missingDates!.length} day
              {status.missingDates!.length === 1 ? '' : 's'} missing between the first and latest
              capture — the nightly job did not run on {status.missingDates!.slice(0, 5).join(', ')}
              {status.missingDates!.length > 5 ? ' and others' : ''}.
            </span>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>No gaps. Every day between the first and latest capture is stored.</span>
          </div>
        )}
      </div>

      {/* Player history */}
      <div className="pastel-card p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-purple-600" />
          <h2 className="text-base font-black text-[#111318]">Player history</h2>
        </div>

        <div className="relative mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a player by name..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-black/5 rounded-full text-base sm:text-sm text-[#111318] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />

          {matches.length > 0 && (
            <div className="absolute z-10 mt-1.5 w-full bg-white border border-black/10 rounded-2xl shadow-xl overflow-hidden">
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => openPlayer(m)}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-[#111318] hover:bg-purple-50 transition"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {selected ? (
          <>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-lg font-black text-[#111318]">{selected.name}</span>
              <span className="text-xs text-gray-400 font-mono">#{selected.id}</span>
            </div>
            {seriesLoading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
              </div>
            ) : (
              <PlayerSeriesChart series={series ?? []} />
            )}
          </>
        ) : (
          <p className="py-8 text-center text-xs text-gray-400">
            Search a player to see how their price, transfers and ownership have moved.
          </p>
        )}
      </div>

      {/* League rebuild */}
      <div className="pastel-card p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Save className="w-4 h-4 text-indigo-600" />
          <h2 className="text-base font-black text-[#111318]">Back up leagues</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Rebuilds every finalised gameweek&apos;s table from each member&apos;s own history.
          Private leagues only — a system league runs to millions of entries.
        </p>

        {leagues.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">
            {savedTeamId ? 'No private leagues on this team.' : 'Pick a team first.'}
          </p>
        ) : (
          <>
            <div className="space-y-2 mb-4 max-h-56 overflow-y-auto pr-1">
              {leagues.map((l: any) => {
                const stored = status.leagues?.find((s) => s.leagueId === String(l.id));
                const isPicked = picked.includes(Number(l.id));
                return (
                  <button
                    key={l.id}
                    onClick={() => togglePick(Number(l.id))}
                    className={`w-full p-3 rounded-2xl border transition flex items-center justify-between gap-2 text-left ${
                      isPicked ? 'border-indigo-300 bg-indigo-50/50' : 'border-black/5 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          isPicked ? 'bg-indigo-600 text-white' : 'border border-gray-300 bg-white text-transparent'
                        }`}
                      >
                        ✓
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-[#111318] block truncate">{l.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono">ID: {l.id}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 shrink-0">
                      {stored ? `${stored.gameweeks.length} GW stored` : 'nothing stored'}
                    </span>
                  </button>
                );
              })}
            </div>

            {backfillResult && (
              <div
                className={`mb-3 p-3 rounded-2xl border text-xs font-bold flex items-start gap-2 ${
                  backfillError
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {backfillError ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <span>{backfillResult}</span>
              </div>
            )}

            <button
              onClick={runBackfill}
              disabled={backfilling || picked.length === 0}
              className="w-full py-3.5 bg-[#38003c] hover:bg-[#520258] text-white font-black text-sm rounded-full shadow-lg flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
            >
              {backfilling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Rebuilding…</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Back Up {picked.length} League{picked.length === 1 ? '' : 's'}</span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3.5 rounded-2xl bg-pastel-bg text-center">
      <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">{label}</span>
      <span className="text-base font-black text-[#111318] truncate block">{value}</span>
    </div>
  );
}
