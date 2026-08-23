'use client';

import React, { useState } from 'react';
import { TeamSquadPlayer } from '@/lib/types';
import PlayerCard from './PlayerCard';
import BenchList from './BenchList';
import PlayerDetailModal from './PlayerDetailModal';

interface FootballPitchProps {
  players: TeamSquadPlayer[];
}

export default function FootballPitch({ players }: FootballPitchProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<TeamSquadPlayer | null>(null);

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
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">แผนการเล่น:</span>
          <span className="px-3 py-0.5 rounded-full bg-[#111318] text-white dark:bg-white dark:text-[#111318] text-xs font-black">
            {formation}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-600 dark:text-gray-300 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            🚀 ราคาจะขึ้น
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            ⚠️ ราคาจะตก
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
            <PlayerCard key={player.element.id} player={player} onClick={setSelectedPlayer} />
          ))}
        </div>

        {/* Row 2: Defenders */}
        <div className="relative z-10 flex justify-around items-center py-1 gap-1">
          {def.map((player) => (
            <PlayerCard key={player.element.id} player={player} onClick={setSelectedPlayer} />
          ))}
        </div>

        {/* Row 3: Midfielders */}
        <div className="relative z-10 flex justify-around items-center py-1 gap-1">
          {mid.map((player) => (
            <PlayerCard key={player.element.id} player={player} onClick={setSelectedPlayer} />
          ))}
        </div>

        {/* Row 4: Forwards */}
        <div className="relative z-10 flex justify-around items-center py-1 gap-1">
          {fwd.map((player) => (
            <PlayerCard key={player.element.id} player={player} onClick={setSelectedPlayer} />
          ))}
        </div>
      </div>

      {/* Bench */}
      <BenchList benchPlayers={bench} onPlayerClick={setSelectedPlayer} />

      {/* Player Modal */}
      <PlayerDetailModal
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
}
