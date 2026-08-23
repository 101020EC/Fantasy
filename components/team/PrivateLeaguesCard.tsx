'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, ArrowUp, ArrowDown, Minus, ChevronDown, ChevronUp, Users, Edit3, Check } from 'lucide-react';
import { fetchFPLLeagueStandings } from '@/lib/fpl-api';

interface PrivateLeaguesCardProps {
  leagues: any[];
  currentTeamId?: string | number;
  currentGw?: number;
}

export default function PrivateLeaguesCard({
  leagues = [],
  currentTeamId,
  currentGw = 1,
}: PrivateLeaguesCardProps) {
  const [expandedLeagueId, setExpandedLeagueId] = useState<number | null>(null);
  const [standingsMap, setStandingsMap] = useState<Record<number, any[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});
  const [orderedLeagues, setOrderedLeagues] = useState<any[]>([]);
  const [isReorderMode, setIsReorderMode] = useState(false);

  // Filter classic leagues
  const privateLeagues = leagues.filter((l) => l.league_type === 'x' || l.rank_type !== 'g');
  const baseLeagues = privateLeagues.length > 0 ? privateLeagues : leagues.slice(0, 10);

  // Initialize and load custom order from localStorage
  useEffect(() => {
    if (!currentTeamId || baseLeagues.length === 0) {
      setOrderedLeagues(baseLeagues);
      return;
    }

    try {
      const savedOrder = localStorage.getItem(`fpl_leagues_order_${currentTeamId}`);
      if (savedOrder) {
        const orderIds: number[] = JSON.parse(savedOrder);
        const sorted = [...baseLeagues].sort((a, b) => {
          const idxA = orderIds.indexOf(Number(a.id));
          const idxB = orderIds.indexOf(Number(b.id));
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
        setOrderedLeagues(sorted);
      } else {
        setOrderedLeagues(baseLeagues);
      }
    } catch (e) {
      setOrderedLeagues(baseLeagues);
    }
  }, [currentTeamId, leagues.length]);

  const saveOrder = (newList: any[]) => {
    setOrderedLeagues(newList);
    if (currentTeamId) {
      const orderIds = newList.map((l) => Number(l.id));
      localStorage.setItem(`fpl_leagues_order_${currentTeamId}`, JSON.stringify(orderIds));
    }
  };

  const moveLeagueUp = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (index <= 0) return;
    const updated = [...orderedLeagues];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    saveOrder(updated);
  };

  const moveLeagueDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (index >= orderedLeagues.length - 1) return;
    const updated = [...orderedLeagues];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    saveOrder(updated);
  };

  const toggleExpand = async (leagueId: number) => {
    if (isReorderMode) return;

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

  if (!orderedLeagues || orderedLeagues.length === 0) return null;

  return (
    <div className="pastel-card p-5 sm:p-7 shadow-sm mb-6">
      {/* Header with Private Mini-Leagues and Edit button */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-black text-[#111318]">Private Mini-Leagues</h3>
            
            {/* Edit Button */}
            <button
              onClick={() => setIsReorderMode(!isReorderMode)}
              type="button"
              className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 transition active:scale-95 shadow-sm ${
                isReorderMode
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-gray-100 hover:bg-purple-100 text-[#38003c]'
              }`}
            >
              {isReorderMode ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Done</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </>
              )}
            </button>
          </div>
        </div>

        <span className="text-xs font-bold text-gray-400 font-mono">
          {orderedLeagues.length} leagues
        </span>
      </div>

      {/* List of Leagues */}
      <div className="space-y-3">
        {orderedLeagues.map((league: any, idx: number) => {
          const rank = league.entry_rank || 1;
          const lastRank = league.entry_last_rank || rank;
          const rankDiff = lastRank - rank;
          const isExpanded = expandedLeagueId === league.id;
          const standings = standingsMap[league.id] || [];
          const isLoading = loadingMap[league.id];

          return (
            <div
              key={league.id}
              className={`rounded-2xl border transition overflow-hidden ${
                isReorderMode ? 'border-purple-300 bg-purple-50/20' : 'border-black/5 bg-gray-50/80'
              }`}
            >
              {/* League Header */}
              <div
                onClick={() => toggleExpand(league.id)}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-2 text-left hover:bg-purple-50/50 transition cursor-pointer"
              >
                {/* Left: Reorder arrows + Name */}
                <div className="flex items-center gap-2.5 sm:gap-3 truncate">
                  {isReorderMode && (
                    <div className="flex flex-col gap-0.5 shrink-0 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => moveLeagueUp(e, idx)}
                        disabled={idx === 0}
                        className="p-1 rounded-md bg-white border border-black/10 text-[#38003c] hover:bg-purple-100 disabled:opacity-25 transition shadow-sm"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                      <button
                        onClick={(e) => moveLeagueDown(e, idx)}
                        disabled={idx === orderedLeagues.length - 1}
                        className="p-1 rounded-md bg-white border border-black/10 text-[#38003c] hover:bg-purple-100 disabled:opacity-25 transition shadow-sm"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    </div>
                  )}

                  <div className="truncate">
                    <span className="font-black text-xs sm:text-sm text-[#111318] block truncate">
                      {league.name}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      ID: {league.id} &bull; Tap to view standings
                    </span>
                  </div>
                </div>

                {/* Right: Rank & Expand Arrow */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-sm sm:text-base font-black text-[#38003c] block">
                      Rank #{rank.toLocaleString()}
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
                          <Minus className="w-3 h-3" /> Same
                        </span>
                      )}
                    </div>
                  </div>

                  {!isReorderMode && (
                    <div className="p-1.5 rounded-full bg-white shadow-sm text-gray-400 hover:text-[#38003c]">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Full League Standings Table */}
              {isExpanded && !isReorderMode && (
                <div className="p-4 border-t border-black/5 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-black text-[#38003c]">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span>Standings for {league.name}</span>
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
                      <span>Loading standings...</span>
                    </div>
                  ) : standings.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">
                      No standings data found
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black border-b border-black/5">
                          <tr>
                            <th className="px-3 py-2">Rank</th>
                            <th className="px-3 py-2">Team &amp; Manager</th>
                            <th className="px-3 py-2 text-center">GW Pts</th>
                            <th className="px-3 py-2 text-right">Total Pts</th>
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
                                        You
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
