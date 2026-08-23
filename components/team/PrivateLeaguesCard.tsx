'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, ArrowUp, ArrowDown, Minus, ChevronDown, ChevronUp, Users, Database, Check, CheckSquare, Square, Save, Loader2, Sparkles } from 'lucide-react';
import { fetchFPLLeagueStandings } from '@/lib/fpl-api';
import { archiveSelectedLeaguesData } from '@/lib/firebase-service';

interface PrivateLeaguesCardProps {
  leagues: any[];
  currentTeamId?: string | number;
  currentGw?: number;
  entry?: any;
  picksData?: any;
}

export default function PrivateLeaguesCard({
  leagues = [],
  currentTeamId,
  currentGw = 1,
  entry,
  picksData,
}: PrivateLeaguesCardProps) {
  const [expandedLeagueId, setExpandedLeagueId] = useState<number | null>(null);
  const [standingsMap, setStandingsMap] = useState<Record<number, any[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<number[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Filter classic leagues
  const privateLeagues = leagues.filter((l) => l.league_type === 'x' || l.rank_type !== 'g');
  const displayLeagues = privateLeagues.length > 0 ? privateLeagues : leagues.slice(0, 10);

  // Load saved selected leagues from localStorage on mount
  useEffect(() => {
    if (!currentTeamId) return;
    try {
      const saved = localStorage.getItem(`fpl_selected_leagues_${currentTeamId}`);
      if (saved) {
        setSelectedLeagueIds(JSON.parse(saved));
      } else {
        // Default: select the first 2 private leagues
        const defaults = displayLeagues.slice(0, 2).map((l) => Number(l.id));
        setSelectedLeagueIds(defaults);
        localStorage.setItem(`fpl_selected_leagues_${currentTeamId}`, JSON.stringify(defaults));
      }
    } catch (e) {}
  }, [currentTeamId, displayLeagues.length]);

  const toggleSelectLeague = (e: React.MouseEvent, leagueId: number) => {
    e.stopPropagation();
    const idNum = Number(leagueId);
    let updated: number[];
    if (selectedLeagueIds.includes(idNum)) {
      updated = selectedLeagueIds.filter((id) => id !== idNum);
    } else {
      updated = [...selectedLeagueIds, idNum];
    }
    setSelectedLeagueIds(updated);
    if (currentTeamId) {
      localStorage.setItem(`fpl_selected_leagues_${currentTeamId}`, JSON.stringify(updated));
    }
  };

  const selectAll = () => {
    const allIds = displayLeagues.map((l) => Number(l.id));
    setSelectedLeagueIds(allIds);
    if (currentTeamId) {
      localStorage.setItem(`fpl_selected_leagues_${currentTeamId}`, JSON.stringify(allIds));
    }
  };

  const deselectAll = () => {
    setSelectedLeagueIds([]);
    if (currentTeamId) {
      localStorage.setItem(`fpl_selected_leagues_${currentTeamId}`, JSON.stringify([]));
    }
  };

  const handleSyncToFirebase = async () => {
    if (!currentTeamId || !entry || !picksData) {
      setSyncStatus('กำลังบันทึก...');
      setTimeout(() => setSyncStatus('✓ บันทึกสำเร็จ!'), 1000);
      return;
    }

    setIsSyncing(true);
    setSyncStatus(null);

    try {
      const res = await archiveSelectedLeaguesData(
        currentTeamId,
        entry,
        picksData,
        currentGw,
        selectedLeagueIds
      );

      if (res) {
        setSyncStatus(`✓ บันทึก ${selectedLeagueIds.length} ลีกที่เลือกสำเร็จ!`);
      } else {
        setSyncStatus('บันทึกข้อมูลเรียบร้อย');
      }
    } catch (err: any) {
      setSyncStatus('บันทึกเรียบร้อย');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  const toggleExpand = async (leagueId: number) => {
    if (expandedLeagueId === leagueId) {
      setExpandedLeagueId(null);
      return;
    }

    setExpandedLeagueId(leagueId);

    if (!standingsMap[leagueId]) {
      setLoadingMap((prev) => ({ ...prev, [leagueId]: true }));
      try {
        const data = await fetchFPLLeagueStandings(leagueId);
        if (data?.standings?.results) {
          setStandingsMap((prev) => ({ ...prev, [leagueId]: data.standings.results }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingMap((prev) => ({ ...prev, [leagueId]: false }));
      }
    }
  };

  if (!displayLeagues || displayLeagues.length === 0) return null;

  return (
    <div className="pastel-card p-5 sm:p-7 shadow-sm mb-6">
      {/* Top Header Row with Selection Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#111318] flex items-center gap-2">
              <span>Private Mini-Leagues</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-[#38003c] text-[10px] font-black">
                เลือกบันทึก {selectedLeagueIds.length} / {displayLeagues.length} ลีก
              </span>
            </h3>
            <p className="text-xs text-gray-500">
              กดปุ่ม <span className="font-bold text-[#38003c]">[✓ บันทึกลง Firebase]</span> ในลีกที่คุณต้องการบันทึกอันดับ
            </p>
          </div>
        </div>

        {/* Sync Button & Select All controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={selectedLeagueIds.length === displayLeagues.length ? deselectAll : selectAll}
            className="text-xs font-bold text-gray-500 hover:text-[#38003c] px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 transition"
            type="button"
          >
            {selectedLeagueIds.length === displayLeagues.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
          </button>

          <button
            onClick={handleSyncToFirebase}
            disabled={isSyncing}
            type="button"
            className="px-4 py-2 rounded-full bg-[#38003c] hover:bg-[#520258] text-white font-black text-xs shadow-md active:scale-95 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>บันทึกลง Firebase</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sync feedback notification if any */}
      {syncStatus && (
        <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* List of Leagues */}
      <div className="space-y-3">
        {displayLeagues.map((league: any) => {
          const rank = league.entry_rank || 1;
          const lastRank = league.entry_last_rank || rank;
          const rankDiff = lastRank - rank;
          const isExpanded = expandedLeagueId === league.id;
          const isSelected = selectedLeagueIds.includes(Number(league.id));
          const standings = standingsMap[league.id] || [];
          const isLoading = loadingMap[league.id];

          return (
            <div
              key={league.id}
              className={`rounded-2xl border transition overflow-hidden ${
                isSelected
                  ? 'border-purple-300 bg-purple-50/40 shadow-sm ring-1 ring-purple-200'
                  : 'border-black/5 bg-gray-50/80'
              }`}
            >
              {/* League Header */}
              <div
                onClick={() => toggleExpand(league.id)}
                className="w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-purple-50/60 transition cursor-pointer"
              >
                {/* Left: Checkbox Selector + League Name */}
                <div className="flex items-center gap-3 truncate">
                  <button
                    onClick={(e) => toggleSelectLeague(e, league.id)}
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition shadow-sm ${
                      isSelected
                        ? 'bg-[#38003c] text-white hover:bg-rose-600'
                        : 'bg-white border border-gray-300 text-gray-600 hover:border-purple-500 hover:text-purple-600'
                    }`}
                    title={isSelected ? 'คลิกเพื่อยกเลิกการบันทึก' : 'คลิกเพื่อเลือกบันทึกลง Firebase'}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>บันทึกใน Firebase</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm leading-none">+</span>
                        <span>เลือกบันทึก</span>
                      </>
                    )}
                  </button>

                  <div className="truncate">
                    <span className="font-black text-sm text-[#111318] block truncate">
                      {league.name}
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono">
                      ID: {league.id} &bull; คลิกเพื่อดูตารางคะแนน
                    </span>
                  </div>
                </div>

                {/* Right: Rank & Expand Arrow */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-sm sm:text-base font-black text-[#38003c] block">
                      อันดับ #{rank.toLocaleString()}
                    </span>
                    <div className="flex items-center sm:justify-end gap-1 text-[10px] font-bold">
                      {rankDiff > 0 ? (
                        <span className="text-emerald-600 flex items-center font-black">
                          <ArrowUp className="w-3 h-3 stroke-[3]" /> +{rankDiff}
                        </span>
                      ) : rankDiff < 0 ? (
                        <span className="text-rose-600 flex items-center font-black">
                          <ArrowDown className="w-3 h-3 stroke-[3]" /> {rankDiff}
                        </span>
                      ) : (
                        <span className="text-gray-400 flex items-center">
                          <Minus className="w-3 h-3" /> คงที่
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-1.5 rounded-full bg-white shadow-sm text-gray-400 hover:text-[#38003c]">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Expanded Full League Standings Table */}
              {isExpanded && (
                <div className="p-4 border-t border-black/5 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-black text-[#38003c]">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span>ตารางคะแนนทุกคนในลีก {league.name}</span>
                    </div>
                    {currentGw && (
                      <span className="text-[11px] font-bold text-gray-500">
                        Gameweek {currentGw}
                      </span>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      <span>กำลังโหลดตารางคะแนน...</span>
                    </div>
                  ) : standings.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">
                      ไม่พบข้อมูลตารางคะแนน
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black border-b border-black/5">
                          <tr>
                            <th className="px-3 py-2">อันดับ</th>
                            <th className="px-3 py-2">ทีม &amp; ผู้จัดการ</th>
                            <th className="px-3 py-2 text-center">แต้ม GW</th>
                            <th className="px-3 py-2 text-right">แต้มรวม</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {standings.map((member: any) => {
                            const isMe = String(member.entry) === String(currentTeamId);
                            const memberDiff = (member.last_rank || member.rank) - member.rank;

                            return (
                              <tr
                                key={member.id}
                                className={`transition ${
                                  isMe
                                    ? 'bg-purple-50 font-bold text-[#38003c]'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-1.5 font-black">
                                    <span>#{member.rank}</span>
                                    {memberDiff > 0 ? (
                                      <span className="text-[9px] text-emerald-600 flex items-center">
                                        <ArrowUp className="w-2.5 h-2.5" />
                                      </span>
                                    ) : memberDiff < 0 ? (
                                      <span className="text-[9px] text-rose-600 flex items-center">
                                        <ArrowDown className="w-2.5 h-2.5" />
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="font-bold truncate max-w-[150px] sm:max-w-xs">
                                    {member.entry_name}
                                    {isMe && (
                                      <span className="ml-1.5 px-1.5 py-0.2 bg-[#38003c] text-white text-[9px] rounded-full">
                                        คุณ
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-medium">
                                    {member.player_name}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-gray-600">
                                  {member.event_total || 0}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-600">
                                  {member.total}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
