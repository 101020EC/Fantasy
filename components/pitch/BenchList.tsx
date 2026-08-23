import React from 'react';
import { TeamSquadPlayer } from '@/lib/types';
import PlayerCard from './PlayerCard';

interface BenchListProps {
  benchPlayers: TeamSquadPlayer[];
  onPlayerClick: (player: TeamSquadPlayer) => void;
}

export default function BenchList({ benchPlayers, onPlayerClick }: BenchListProps) {
  return (
    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-b from-[#180024]/90 to-[#100017] border border-purple-800/60 shadow-xl">
      <div className="flex items-center justify-between mb-3 px-2">
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          ตัวสำรอง (Substitutes)
        </h3>
        <span className="text-[11px] text-gray-400">เรียงตามลำดับ 1 - 4</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 py-2">
        {benchPlayers.map((player, idx) => (
          <div key={player.element.id} className="flex flex-col items-center">
            <div className="text-[10px] font-bold text-gray-400 mb-1">
              {idx === 0 ? 'GK' : `Sub ${idx}`}
            </div>
            <PlayerCard player={player} onClick={onPlayerClick} isBench={true} />
          </div>
        ))}
      </div>
    </div>
  );
}
