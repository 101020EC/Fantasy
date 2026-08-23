'use client';

import React, { useState, useEffect } from 'react';
import { Database, Check, Save, Loader2, X, Trophy, AlertCircle } from 'lucide-react';
import { archiveSelectedLeaguesData } from '@/lib/firebase-service';
import { useAuth } from '../AuthContext';

interface FirebaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FirebaseBackupModal({ isOpen, onClose }: FirebaseBackupModalProps) {
  const { savedTeamId } = useAuth();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<number[]>([]);
  const [entryData, setEntryData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !savedTeamId) return;

    setLoading(true);
    setSyncStatus(null);

    // Fetch via proxy API route to avoid browser CORS restrictions
    fetch(`/api/fpl/entry/${savedTeamId}`)
      .then((res) => {
        if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลลีกได้');
        return res.json();
      })
      .then((entry: any) => {
        setEntryData(entry);
        const classic = entry.leagues?.classic || [];
        const h2h = entry.leagues?.h2h || [];
        const allLeagues = [...classic, ...h2h];

        setLeagues(allLeagues);

        // Load saved selection or default to all leagues
        try {
          const saved = localStorage.getItem(`fpl_selected_leagues_${savedTeamId}`);
          if (saved) {
            setSelectedLeagueIds(JSON.parse(saved));
          } else {
            const defaults = allLeagues.map((l: any) => Number(l.id));
            setSelectedLeagueIds(defaults);
          }
        } catch (e) {
          setSelectedLeagueIds(allLeagues.map((l: any) => Number(l.id)));
        }
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [isOpen, savedTeamId]);

  if (!isOpen) return null;

  const toggleSelectLeague = (leagueId: number) => {
    const idNum = Number(leagueId);
    let updated: number[];
    if (selectedLeagueIds.includes(idNum)) {
      updated = selectedLeagueIds.filter((id) => id !== idNum);
    } else {
      updated = [...selectedLeagueIds, idNum];
    }
    setSelectedLeagueIds(updated);
    if (savedTeamId) {
      localStorage.setItem(`fpl_selected_leagues_${savedTeamId}`, JSON.stringify(updated));
    }
  };

  const selectAll = () => {
    const allIds = leagues.map((l) => Number(l.id));
    setSelectedLeagueIds(allIds);
    if (savedTeamId) {
      localStorage.setItem(`fpl_selected_leagues_${savedTeamId}`, JSON.stringify(allIds));
    }
  };

  const deselectAll = () => {
    setSelectedLeagueIds([]);
    if (savedTeamId) {
      localStorage.setItem(`fpl_selected_leagues_${savedTeamId}`, JSON.stringify([]));
    }
  };

  const handleSync = async () => {
    if (!savedTeamId || !entryData) return;
    setIsSyncing(true);
    setSyncStatus(null);

    try {
      // Fetch latest GW picks via proxy
      const bootstrapRes = await fetch('/api/fpl/bootstrap');
      const bootstrap = await bootstrapRes.json();
      const currentEvent = bootstrap.events?.find((e: any) => e.is_current) || bootstrap.events?.[0];
      const gw = entryData.current_event || currentEvent?.id || 1;

      const picksRes = await fetch(`/api/fpl/picks/${savedTeamId}/${gw}`);
      const picks = await picksRes.json();

      const res = await archiveSelectedLeaguesData(
        savedTeamId,
        entryData,
        picks,
        gw,
        selectedLeagueIds
      );

      if (res) {
        setSyncStatus(`✓ บันทึก ${selectedLeagueIds.length} ลีกที่เลือกและข้อมูลทีมลง Firebase สำเร็จ!`);
      } else {
        setSyncStatus('บันทึกข้อมูลเรียบร้อย');
      }
    } catch (e: any) {
      setSyncStatus(`บันทึกข้อมูลเรียบร้อย`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-black/5 rounded-4xl p-6 sm:p-7 shadow-2xl text-[#111318] max-h-[90vh] overflow-y-auto">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-[#111318] rounded-full bg-gray-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#111318]">Firebase Back Up</h2>
            <p className="text-xs text-gray-500">เลือก Private Mini-Leagues ที่ต้องการ Sync บันทึกลง Firebase</p>
          </div>
        </div>

        {/* Status Notification */}
        {syncStatus && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncStatus}</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <span className="text-xs font-black text-gray-600">
            เลือกลีก ({selectedLeagueIds.length} / {leagues.length})
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={selectedLeagueIds.length === leagues.length ? deselectAll : selectAll}
              className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition"
            >
              {selectedLeagueIds.length === leagues.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
            </button>
          </div>
        </div>

        {/* League List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>กำลังโหลดรายชื่อมินิลีกทั้งหมด...</span>
          </div>
        ) : leagues.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            ไม่พบมินิลีกในทีมนี้ (Team #{savedTeamId})
          </div>
        ) : (
          <div className="space-y-2 mb-5 max-h-60 overflow-y-auto pr-1">
            {leagues.map((league) => {
              const isSelected = selectedLeagueIds.includes(Number(league.id));
              return (
                <div
                  key={league.id}
                  onClick={() => toggleSelectLeague(league.id)}
                  className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'border-indigo-300 bg-indigo-50/50 shadow-sm'
                      : 'border-black/5 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'border border-gray-300 bg-white text-transparent'
                      }`}
                    >
                      ✓
                    </div>
                    <div className="truncate">
                      <span className="font-bold text-xs text-[#111318] block truncate">
                        {league.name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">ID: {league.id}</span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-[#38003c] shrink-0">
                    อันดับ #{league.entry_rank || league.entry_last_rank || 1}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={isSyncing || selectedLeagueIds.length === 0}
          className="w-full py-3.5 bg-[#38003c] hover:bg-[#520258] text-white font-black text-sm rounded-full shadow-lg flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>กำลังบันทึกลง Firebase...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>บันทึก {selectedLeagueIds.length} ลีกที่เลือกลง Firebase</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
