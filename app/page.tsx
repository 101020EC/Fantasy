'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import {
  Trophy,
  Users,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Shield,
  Loader2,
  Calendar,
  Layers,
  Activity,
  AlertCircle,
  CheckCircle2,
  Search,
  X,
} from 'lucide-react';
import PlayerJersey from '@/components/pitch/PlayerJersey';

export default function HistoryPage() {
  const { savedTeamId, setSavedTeamId } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Team & History State
  const [entryData, setEntryData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any>(null);
  const [transfersData, setTransfersData] = useState<any[]>([]);
  const [bootstrapData, setBootstrapData] = useState<any>(null);
  const [selectedGw, setSelectedGw] = useState<number>(27);
  const [gwPicks, setGwPicks] = useState<any[]>([]);
  const [gwPicksLoading, setGwPicksLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Team Setup Modal State
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [newTeamInput, setNewTeamInput] = useState('');
  const [previewNewEntry, setPreviewNewEntry] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Load Team Data & History
  useEffect(() => {
    if (!savedTeamId) {
      setLoading(false);
      setIsSetupModalOpen(true);
      return;
    }

    setLoading(true);
    Promise.all([
      fetch(`/api/fpl/entry/${savedTeamId}`).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/fpl/bootstrap').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(async ([entry, bootstrap]) => {
        setEntryData(entry);
        setBootstrapData(bootstrap);

        const curEvent =
          bootstrap?.events?.find((e: any) => e.is_current) ||
          bootstrap?.events?.find((e: any) => e.is_next) ||
          bootstrap?.events?.[0];
        const latestGw = entry?.current_event || curEvent?.id || 27;
        setSelectedGw(latestGw);

        // Fetch History & Transfers
        try {
          const histRes = await fetch(`https://fantasy.premierleague.com/api/entry/${savedTeamId}/history/`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          if (histRes.ok) {
            const hist = await histRes.json();
            setHistoryData(hist);
          }
        } catch {}

        try {
          const transRes = await fetch(`https://fantasy.premierleague.com/api/entry/${savedTeamId}/transfers/`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          if (transRes.ok) {
            const trans = await transRes.json();
            setTransfersData(trans);
          }
        } catch {}
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [savedTeamId]);

  // Load Picks whenever selectedGw changes
  useEffect(() => {
    if (!savedTeamId || !selectedGw) return;
    setGwPicksLoading(true);
    fetch(`/api/fpl/picks/${savedTeamId}/${selectedGw}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setGwPicks(data?.picks || []);
      })
      .catch(() => setGwPicks([]))
      .finally(() => setGwPicksLoading(false));
  }, [savedTeamId, selectedGw]);

  // Preview new team before confirmation
  const handleCheckNewTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamInput.trim()) return;

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewNewEntry(null);

    try {
      const res = await fetch(`/api/fpl/entry/${newTeamInput.trim()}`);
      if (!res.ok) throw new Error('ไม่พบ Team ID นี้ในระบบ');
      const data = await res.json();
      setPreviewNewEntry(data);
    } catch (err: any) {
      setPreviewError(err.message || 'ไม่พบข้อมูลทีม');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Confirm Team Switch
  const handleConfirmSwitch = () => {
    if (previewNewEntry) {
      const newId = String(previewNewEntry.id);
      setSavedTeamId(newId);
      setIsSetupModalOpen(false);
      setPreviewNewEntry(null);
      setNewTeamInput('');
      router.push(`/team/${newId}`);
    }
  };

  // Find stats for currently selected GW
  const currentGwStats = historyData?.current?.find((h: any) => h.event === selectedGw);
  const maxAvailableGw = entryData?.current_event || 27;

  // Build mapped squad players for selected GW
  const elementMap = new Map(bootstrapData?.elements?.map((el: any) => [el.id, el]) || []);
  const teamMap = new Map(bootstrapData?.teams?.map((t: any) => [t.id, t]) || []);

  const starters = gwPicks.filter((p) => p.position <= 11);
  const bench = gwPicks.filter((p) => p.position > 11);

  // Transfers for this GW
  const gwTransfers = transfersData.filter((t) => t.event === selectedGw);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      {/* 1. Dark Yellow / Amber Top Banner */}
      <div className="rounded-3xl p-5 sm:p-7 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-xl relative overflow-hidden transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Avatar + Manager Name + Team Name */}
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/90 text-amber-600 flex items-center justify-center text-3xl font-black shrink-0 shadow-lg">
              👑
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-3 py-0.5 rounded-full bg-black/30 backdrop-blur-sm text-white text-[11px] font-mono font-black">
                  ID #{entryData?.id || savedTeamId || '-'}
                </span>
                {entryData?.player_region_name && (
                  <span className="text-xs text-amber-100 font-semibold">
                    • {entryData.player_region_name}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                {entryData?.name || 'My Fantasy Team'}
              </h1>
              <p className="text-xs sm:text-sm text-amber-100 font-semibold">
                {entryData ? `${entryData.player_first_name} ${entryData.player_last_name}` : 'Manager'}
              </p>
            </div>
          </div>

          {/* Team Setup Button */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                setNewTeamInput('');
                setPreviewNewEntry(null);
                setPreviewError(null);
                setIsSetupModalOpen(true);
              }}
              type="button"
              className="px-5 py-2.5 rounded-full bg-white text-[#111318] hover:bg-amber-50 font-black text-xs sm:text-sm shadow-md transition active:scale-95 flex items-center gap-2"
            >
              <ArrowRightLeft className="w-4 h-4 text-amber-600 stroke-[2.5]" />
              <span>Team Setup</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Gameweek Horizontal Capsule Scroll Bar */}
      <div className="pastel-card p-2.5 sm:p-3 shadow-sm flex items-center overflow-x-auto gap-2 scrollbar-none">
        {Array.from({ length: 38 }, (_, i) => i + 1).map((gw) => {
          const isSelected = gw === selectedGw;
          const isFinished = gw <= maxAvailableGw;

          return (
            <button
              key={gw}
              onClick={() => setSelectedGw(gw)}
              type="button"
              className={`flex-shrink-0 min-w-[65px] text-center py-2 px-2 rounded-full text-xs transition active:scale-95 ${
                isSelected
                  ? 'bg-[#38003c] text-white font-black shadow-md ring-2 ring-purple-300'
                  : isFinished
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold border border-amber-200'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-400 font-medium'
              }`}
            >
              <span className="block text-[8px] uppercase opacity-75">
                {gw === maxAvailableGw ? 'Current' : isFinished ? 'Done' : 'Upcoming'}
              </span>
              <span className="text-xs font-black">GW {gw}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Gameweek History Detailed Content */}
      <div className="space-y-4">
        {/* GW Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="pastel-card p-4 text-center">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">แต้ม GW {selectedGw}</span>
            <span className="text-2xl font-black text-[#38003c]">
              {currentGwStats?.points ?? '-'}
            </span>
          </div>

          <div className="pastel-card p-4 text-center">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">แต้มสะสมรวม</span>
            <span className="text-2xl font-black text-[#111318]">
              {currentGwStats?.total_points ?? '-'}
            </span>
          </div>

          <div className="pastel-card p-4 text-center">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">อันดับ GW {selectedGw}</span>
            <span className="text-base font-black text-amber-700 truncate block">
              {currentGwStats?.rank ? `#${currentGwStats.rank.toLocaleString()}` : '-'}
            </span>
          </div>

          <div className="pastel-card p-4 text-center">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">อันดับโลก (OR)</span>
            <span className="text-base font-black text-[#111318] truncate block">
              {currentGwStats?.overall_rank ? `#${currentGwStats.overall_rank.toLocaleString()}` : '-'}
            </span>
          </div>

          <div className="pastel-card p-4 text-center">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">การเปลี่ยนตัว</span>
            <span className="text-base font-black text-purple-700">
              {currentGwStats ? `${currentGwStats.event_transfers} (${currentGwStats.event_transfers_cost}pt)` : '-'}
            </span>
          </div>

          <div className="pastel-card p-4 text-center">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">แต้มตัวสำรอง</span>
            <span className="text-base font-black text-emerald-600">
              {currentGwStats?.points_on_bench ?? '-'} pt
            </span>
          </div>
        </div>

        {/* Squad Lineup in this GW */}
        <div className="pastel-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-[#38003c] flex items-center justify-center font-bold">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#111318]">
                  รายชื่อนักเตะ 15 คน (Gameweek {selectedGw})
                </h3>
                <p className="text-xs text-gray-500">11 ตัวจริง และ 4 ตัวสำรอง</p>
              </div>
            </div>
            {gwPicksLoading && <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />}
          </div>

          {gwPicks.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              ยังไม่มีข้อมูลการจัดตัวใน Gameweek {selectedGw}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Starters Grid */}
              <div>
                <span className="text-xs font-black uppercase text-gray-400 mb-2 block">11 ตัวจริง</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {starters.map((p) => {
                    const el = elementMap.get(p.element) as any;
                    const team = teamMap.get(el?.team) as any;

                    return (
                      <div
                        key={p.element}
                        className="p-2.5 rounded-2xl bg-gray-50 border border-black/5 flex items-center gap-2.5"
                      >
                        <PlayerJersey teamCode={el?.team_code || 1} isGkp={el?.element_type === 1} className="w-8 h-8 shrink-0" />
                        <div className="truncate">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs text-[#111318] truncate block">
                              {el?.web_name || `Player #${p.element}`}
                            </span>
                            {p.is_captain && (
                              <span className="px-1.5 py-0.2 bg-[#38003c] text-white text-[9px] font-black rounded-full">
                                C
                              </span>
                            )}
                            {p.is_vice_captain && (
                              <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[9px] font-black rounded-full">
                                V
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {team?.short_name || 'CLB'} &bull; £{((el?.now_cost || 50) / 10).toFixed(1)}m
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bench Grid */}
              <div className="pt-2 border-t border-black/5">
                <span className="text-xs font-black uppercase text-gray-400 mb-2 block">ตัวสำรอง</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {bench.map((p, idx) => {
                    const el = elementMap.get(p.element) as any;
                    const team = teamMap.get(el?.team) as any;

                    return (
                      <div
                        key={p.element}
                        className="p-2.5 rounded-2xl bg-gray-50/70 border border-black/5 flex items-center gap-2.5 opacity-90"
                      >
                        <PlayerJersey teamCode={el?.team_code || 1} isGkp={el?.element_type === 1} className="w-8 h-8 shrink-0" />
                        <div className="truncate">
                          <span className="font-bold text-xs text-[#111318] truncate block">
                            {idx === 0 ? 'GK: ' : `Sub ${idx}: `}{el?.web_name || `Player #${p.element}`}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {team?.short_name || 'CLB'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Private Leagues Standings */}
        <div className="pastel-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#111318]">อันดับในมินิลีกต่างๆ</h3>
                <p className="text-xs text-gray-500">สถานะคะแนนและอันดับในแต่ละมินิลีก</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {((entryData as any)?.leagues?.classic || []).slice(0, 8).map((league: any) => {
              const rank = league.entry_rank || 1;
              const lastRank = league.entry_last_rank || rank;
              const rankDiff = lastRank - rank;

              return (
                <div
                  key={league.id}
                  className="p-3.5 rounded-2xl bg-gray-50 border border-black/5 flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <span className="font-bold text-xs text-[#111318] block truncate">{league.name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">ID: {league.id}</span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-[#38003c] block">อันดับ #{rank}</span>
                    <div className="flex items-center justify-end gap-1 text-[10px] font-bold">
                      {rankDiff > 0 ? (
                        <span className="text-emerald-600 flex items-center font-black">
                          <ArrowUp className="w-2.5 h-2.5" /> +{rankDiff}
                        </span>
                      ) : rankDiff < 0 ? (
                        <span className="text-rose-600 flex items-center font-black">
                          <ArrowDown className="w-2.5 h-2.5" /> {rankDiff}
                        </span>
                      ) : (
                        <span className="text-gray-400 flex items-center font-medium">
                          <Minus className="w-2.5 h-2.5" /> คงที่
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transfers in this Gameweek if any */}
        {gwTransfers.length > 0 && (
          <div className="pastel-card p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/5">
              <ArrowRightLeft className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-black text-[#111318]">
                การย้ายตัวใน Gameweek {selectedGw} ({gwTransfers.length} รายการ)
              </h3>
            </div>
            <div className="space-y-2">
              {gwTransfers.map((t: any, idx: number) => {
                const elIn = elementMap.get(t.element_in) as any;
                const elOut = elementMap.get(t.element_out) as any;

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-gray-50 border border-black/5 flex items-center justify-between text-xs font-bold"
                  >
                    <div className="flex items-center gap-2 text-emerald-700">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">IN</span>
                      <span>{elIn?.web_name || `Player #${t.element_in}`}</span>
                      <span className="text-gray-400 font-mono text-[11px]">£{(t.element_in_cost / 10).toFixed(1)}m</span>
                    </div>

                    <div className="flex items-center gap-2 text-rose-700">
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px]">OUT</span>
                      <span>{elOut?.web_name || `Player #${t.element_out}`}</span>
                      <span className="text-gray-400 font-mono text-[11px]">£{(t.element_out_cost / 10).toFixed(1)}m</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Team Setup Modal with Confirmation */}
      {isSetupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-white border border-black/5 rounded-4xl p-6 sm:p-7 shadow-2xl text-[#111318]">
            <button
              onClick={() => setIsSetupModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-[#111318] rounded-full bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#111318]">Team Setup</h2>
                <p className="text-xs text-gray-500">กรอก Team ID ที่ต้องการสลับเปลี่ยน</p>
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleCheckNewTeam} className="space-y-3 mb-4">
              <div className="relative">
                <input
                  type="number"
                  value={newTeamInput}
                  onChange={(e) => setNewTeamInput(e.target.value)}
                  placeholder="กรอกหมายเลข FPL Team ID (เช่น 12345)..."
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-black/10 rounded-full text-base font-bold text-[#111318] focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              </div>

              {previewError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{previewError}</span>
                </div>
              )}

              {!previewNewEntry && (
                <button
                  type="submit"
                  disabled={previewLoading}
                  className="w-full py-3 bg-[#111318] text-white font-black text-xs rounded-full shadow-md hover:opacity-90 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ค้นหาทีม'}
                </button>
              )}
            </form>

            {/* Confirmation Box when team is found */}
            {previewNewEntry && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 mb-4 animate-fadeIn">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>พบข้อมูลทีมใหม่! ยืนยันการเปลี่ยนทีม:</span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-amber-200/80 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">ทีมเดิม:</span>
                    <span className="font-bold text-[#111318]">#{savedTeamId || '-'} ({entryData?.name || '-'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">ทีมใหม่:</span>
                    <span className="font-black text-[#38003c]">#{previewNewEntry.id} ({previewNewEntry.name})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">ผู้จัดการ:</span>
                    <span className="font-bold text-gray-700">{previewNewEntry.player_first_name} {previewNewEntry.player_last_name}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmSwitch}
                    type="button"
                    className="flex-1 py-2.5 bg-[#38003c] text-white font-black text-xs rounded-full shadow-md active:scale-95 transition"
                  >
                    ยืนยันเปลี่ยนเป็นทีมนี้
                  </button>
                  <button
                    onClick={() => setPreviewNewEntry(null)}
                    type="button"
                    className="px-4 py-2.5 bg-gray-200 text-gray-700 font-bold text-xs rounded-full transition"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
