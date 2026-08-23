'use client';

import React, { useState, useEffect } from 'react';
import { Database, Check, Save, Loader2, AlertCircle } from 'lucide-react';
import { archiveSelectedLeaguesData, fetchArchiveStatus } from '@/lib/firebase-service';
import { useAuth } from '../AuthContext';
import Modal from '../ui/Modal';

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
  const [syncError, setSyncError] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    if (!isOpen || !savedTeamId) return;

    setLoading(true);
    setSyncStatus(null);
    setSyncError(false);

    fetchArchiveStatus().then((s) => setIsConfigured(s.configured));

    // Fetch via proxy API route to avoid browser CORS restrictions
    fetch(`/api/fpl/entry/${savedTeamId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Unable to load leagues');
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
    setSyncError(false);

    try {
      const bootstrapRes = await fetch('/api/fpl/bootstrap');
      if (!bootstrapRes.ok) throw new Error('Could not load the current gameweek');
      const bootstrap = await bootstrapRes.json();
      const currentEvent =
        bootstrap.events?.find((e: any) => e.is_current) || bootstrap.events?.[0];
      const gw = entryData.current_event || currentEvent?.id || 1;

      // The archive route gathers picks, history, transfers and standings
      // server-side, then this writes the result to Firestore.
      const archive = await archiveSelectedLeaguesData(savedTeamId, gw, selectedLeagueIds);

      setSyncStatus(
        `Backed up ${archive.leaguesArchived} leagues ` +
          `(${archive.membersArchived.toLocaleString()} members) for GW ${archive.gameweek}.`
      );
    } catch (e: any) {
      setSyncError(true);
      setSyncStatus(e.message || 'Backup failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} labelledBy="firebase-backup-title" className="max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 id="firebase-backup-title" className="text-xl font-black text-[#111318]">Firebase Backup</h2>
            <p className="text-xs text-gray-500">Select Private Mini-Leagues to sync with Firebase Firestore</p>
          </div>
        </div>

        {/* Status Notification */}
        {syncStatus && (
          <div
            className={`mb-4 p-3 rounded-2xl border text-xs font-bold flex items-start gap-2 ${
              syncError
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}
          >
            {syncError ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <span>{syncStatus}</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <span className="text-xs font-black text-gray-600">
            Selected Leagues ({selectedLeagueIds.length} / {leagues.length})
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={selectedLeagueIds.length === leagues.length ? deselectAll : selectAll}
              className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition"
            >
              {selectedLeagueIds.length === leagues.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        {/* League List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading mini-leagues...</span>
          </div>
        ) : leagues.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            No mini-leagues found for this team (Team #{savedTeamId})
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
                    Rank #{league.entry_rank || league.entry_last_rank || 1}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Firebase not set up yet */}
        {!isConfigured && (
          <div className="mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Backup is unavailable until the server has Firebase credentials. Add
              <code className="mx-1 px-1 rounded bg-white/80 font-mono">FIREBASE_SERVICE_ACCOUNT</code>
              to your environment, then restart.
            </span>
          </div>
        )}

        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={isSyncing || selectedLeagueIds.length === 0 || !isConfigured}
          className="w-full py-3.5 bg-[#38003c] hover:bg-[#520258] text-white font-black text-sm rounded-full shadow-lg flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving to Firebase...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Backup {selectedLeagueIds.length} Leagues to Firebase</span>
            </>
          )}
        </button>
    </Modal>
  );
}
