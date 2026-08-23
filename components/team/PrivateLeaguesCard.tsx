'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, ArrowUp, ArrowDown, Minus, ChevronDown, ChevronUp, Users, Database } from 'lucide-react';
import { fetchFPLLeagueStandings } from '@/lib/fpl-api';

interface PrivateLeaguesCardProps {
  leagues: any[];
  currentTeamId?: string | number;
  currentGw?: number;
}

export default function PrivateLeaguesCard({
  leagues = [],
  currentTeamId,
  currentGw,
}: PrivateLeaguesCardProps) {
  const [expandedLeagueId, setExpandedLeagueId] = useState<number | null>(null);
  const [standingsMap, setStandingsMap] = useState<Record<number, any[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});

  const privateLeagues = leagues.filter((l) => l.league_type === 'x' || l.rank_type !== 'g');
  const displayLeagues = privateLeagues.length > 0 ? privateLeagues : leagues.slice(0, 8);

  const toggleExpand = async (leagueId: number) => {
    if (expandedLeagueId === leagueId) {
      setExpandedLeagueId(null);
      return;
    }

    setExpandedLeagueId(leagueId);

    // Fetch standings if not yet cached in state
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
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#111318] flex items-center gap-2">
              <span>Private Mini-Leagues</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                <Database className="w-2.5 h-2.5" /> Firebase Sync
              </span>
            </h3>
            <p className="text-xs text-gray-500">
              กดที่ชื่อลีกเพื่อดูอันดับคะแนนของทุกคนในลีกประจำสัปดาห์ (บันทึกลง Firebase)
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-gray-400 font-mono">
          {displayLeagues.length} ลีก
        </span>
      </div>

      <div className="space-y-3">
        {displayLeagues.map((league: any) => {
          const rank = league.entry_rank || 1;
          const lastRank = league.entry_last_rank || rank;
          const rankDiff = lastRank - rank;
          const isExpanded = expandedLeagueId === league.id;
          const standings = standingsMap[league.id] || [];
          const isLoading = loadingMap[league.id];

          return (
            <div
              key={league.id}
              className="rounded-2xl border border-black/5 bg-gray-50/80 overflow-hidden transition"
            >
              {/* League Header Card */}
              <button
                onClick={() => toggleExpand(league.id)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-purple-50/50 transition cursor-pointer"
              >
                <div className="truncate pr-2">
                  <span className="font-black text-sm text-[#111318] block truncate">
                    {league.name}
                  </span>
                  <span className="text-[11px] text-gray-400 font-mono">
                    ID: {league.id} &bull; คลิกเพื่อดูตารางอันดับทุกคน
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-base font-black text-[#38003c] block">
                      อันดับ #{rank.toLocaleString()}
                    </span>
                    <div className="flex items-center justify-end gap-1 text-[10px] font-bold">
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

                  <div className="p-1 rounded-full bg-white shadow-sm text-gray-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {/* Expanded Full League Standings Table */}
              {isExpanded && (
                <div className="p-4 border-t border-black/5 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-black text-[#38003c]">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span>ตารางคะแนนทุกคนในลีก (Standings)</span>
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
                      <span>กำลังโหลดตารางคะแนนจาก FPL API &amp; Firebase...</span>
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
