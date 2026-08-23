'use client';

import React, { useState } from 'react';
import { TeamSquadPlayer } from '@/lib/types';
import PlayerCard, { CardMode } from './PlayerCard';
import BenchList from './BenchList';
import PlayerDetailModal from './PlayerDetailModal';

interface FootballPitchProps {
  players: TeamSquadPlayer[];
  isPreview?: boolean;
}

export default function FootballPitch({ players, isPreview = false }: FootballPitchProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<TeamSquadPlayer | null>(null);
  // Previewing a future gameweek: fixtures are the only thing that differs,
  // so open on the view that shows them.
  const [mode, setMode] = useState<CardMode>(isPreview ? 'fixtures' : 'stats');

  const starters = players.filter((p) => p.pick.position <= 11);
  const bench = players.filter((p) => p.pick.position > 11);

  const gk = starters.filter((p) => p.elementType.id === 1);
  const def = starters.filter((p) => p.elementType.id === 2);
  const mid = starters.filter((p) => p.elementType.id === 3);
  const fwd = starters.filter((p) => p.elementType.id === 4);

  const formation = `${def.length}-${mid.length}-${fwd.length}`;

  return (
    <div className="w-full">
      {/* Pitch Header */}
      <div className="flex items-center justify-between gap-2 mb-3 px-2">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-gray-500 hidden sm:inline">Formation</span>
          <span className="px-3 py-0.5 rounded-full bg-[#111318] text-white text-xs font-black">
            {formation}
          </span>
        </div>

        {/* What the strip under each shirt shows */}
        <div className="flex items-center rounded-full bg-gray-100 p-0.5 shrink-0">
          {(
            [
              { key: 'stats', label: 'A', title: 'Price, points and next opponent' },
              { key: 'fixtures', label: 'B', title: 'The next three matches' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              title={opt.title}
              aria-pressed={mode === opt.key}
              className={`w-7 h-7 rounded-full text-xs font-black transition ${
                mode === opt.key
                  ? 'bg-[#38003c] text-white shadow-sm'
                  : 'text-gray-500 hover:text-[#38003c]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-600 font-medium shrink-0">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
            Rising
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            Falling
          </span>
        </div>
      </div>

      {/* Pitch Layout */}
      <div className="pastel-pitch p-3 sm:p-6 md:p-8 min-h-[560px] sm:min-h-[640px] flex flex-col justify-between overflow-hidden">
        {/* Pitch markings */}
        <div className="absolute inset-x-6 sm:inset-x-8 top-0 h-24 sm:h-28 border-b-2 border-x-2 border-white/20 rounded-b-2xl pointer-events-none" />
        <div className="absolute inset-x-16 sm:inset-x-20 top-0 h-12 sm:h-14 border-b-2 border-x-2 border-white/20 rounded-b-xl pointer-events-none" />
        <div className="absolute top-1/2 left-0 right-0 h-0.5 border-t-2 border-white/20 -translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 w-28 sm:w-32 h-28 sm:h-32 border-2 border-white/20 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute inset-x-6 sm:inset-x-8 bottom-0 h-24 sm:h-28 border-t-2 border-x-2 border-white/20 rounded-t-2xl pointer-events-none" />
        <div className="absolute inset-x-16 sm:inset-x-20 bottom-0 h-12 sm:h-14 border-t-2 border-x-2 border-white/20 rounded-t-xl pointer-events-none" />

        {/* Row 1: Goalkeeper */}
        <div className="relative z-10 flex justify-center items-center py-1">
          {gk.map((player) => (
            <PlayerCard key={player.element.id} player={player} onClick={setSelectedPlayer} mode={mode} isPreview={isPreview} />
          ))}
        </div>

        {/* Row 2: Defenders */}
        <div className="relative z-10 flex justify-around items-center py-1 gap-1">
          {def.map((player) => (
            <PlayerCard key={player.element.id} player={player} onClick={setSelectedPlayer} mode={mode} isPreview={isPreview} />
          ))}
        </div>

        {/* Row 3: Midfielders */}
        <div className="relative z-10 flex justify-around items-center py-1 gap-1">
          {mid.map((player) => (
            <PlayerCard key={player.element.id} player={player} onClick={setSelectedPlayer} mode={mode} isPreview={isPreview} />
          ))}
        </div>

        {/* Row 4: Forwards */}
        <div className="relative z-10 flex justify-around items-center py-1 gap-1">
          {fwd.map((player) => (
            <PlayerCard key={player.element.id} player={player} onClick={setSelectedPlayer} mode={mode} isPreview={isPreview} />
          ))}
        </div>
      </div>

      {/* Bench */}
      <BenchList benchPlayers={bench} onPlayerClick={setSelectedPlayer} mode={mode} isPreview={isPreview} />

      {/* Player Modal */}
      <PlayerDetailModal
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
}
