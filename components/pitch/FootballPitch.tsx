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

  // Separate starters (first 11 picks, position 1-11) and bench (position 12-15)
  const starters = players.filter((p) => p.pick.position <= 11);
  const bench = players.filter((p) => p.pick.position > 11);

  // Group starters by position: 1 = GKP, 2 = DEF, 3 = MID, 4 = FWD
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
          <span className="text-xs font-bold text-gray-300">แผนการเล่น:</span>
          <span className="px-2 py-0.5 rounded-full bg-fpl-green/20 text-fpl-green border border-fpl-green/40 text-xs font-black">
            {formation}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-300">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            🚀 ราคาจะขึ้น
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            ⚠️ ราคาจะตก
          </span>
        </div>
      </div>

      {/* Pitch Layout */}
      <div className="fpl-pitch rounded-2xl p-4 sm:p-6 md:p-8 min-h-[580px] sm:min-h-[640px] flex flex-col justify-between overflow-hidden">
        {/* Pitch markings */}
        <div className="absolute inset-x-8 top-0 h-28 border-b-2 border-x-2 pitch-line opacity-40 rounded-b-xl pointer-events-none" />
        <div className="absolute inset-x-20 top-0 h-14 border-b-2 border-x-2 pitch-line opacity-40 rounded-b-lg pointer-events-none" />
        <div className="absolute top-1/2 left-0 right-0 h-0.5 border-t-2 pitch-line opacity-40 -translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 border-2 pitch-line opacity-40 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute inset-x-8 bottom-0 h-28 border-t-2 border-x-2 pitch-line opacity-40 rounded-t-xl pointer-events-none" />
        <div className="absolute inset-x-20 bottom-0 h-14 border-t-2 border-x-2 pitch-line opacity-40 rounded-t-lg pointer-events-none" />

        {/* Row 1: Goalkeeper */}
        <div className="relative z-10 flex justify-center items-center py-2">
          {gk.map((player) => (
            <PlayerCard key={player.element.id} player={player} onClick={setSelectedPlayer} />
          ))}
        </div>

        {/* Row 2: Defenders */}
        <div className="relative z-10 flex justify-around items-center py-2 gap-1">
          {def.map((player) => (
            <PlayerCard key={player.element.id} player={player} onClick={setSelectedPlayer} />
          ))}
        </div>

        {/* Row 3: Midfielders */}
        <div className="relative z-10 flex justify-around items-center py-2 gap-1">
          {mid.map((player) => (
            <PlayerCard key={player.element.id} player={player} onClick={setSelectedPlayer} />
          ))}
        </div>

        {/* Row 4: Forwards */}
        <div className="relative z-10 flex justify-around items-center py-2 gap-1">
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
