import React from 'react';
import { TeamSquadPlayer } from '@/lib/types';
import PlayerCard, { CardMode } from './PlayerCard';

interface BenchListProps {
  benchPlayers: TeamSquadPlayer[];
  onPlayerClick: (player: TeamSquadPlayer) => void;
  mode?: CardMode;
  isPreview?: boolean;
}

export default function BenchList({
  benchPlayers,
  onPlayerClick,
  mode = 'stats',
  isPreview = false,
}: BenchListProps) {
  return (
    <div className="mt-4 p-4 sm:p-5 rounded-3xl pastel-card shadow-sm transition-colors">
      <div className="flex items-center justify-between mb-3 px-2">
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#111318] flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-pastel-orange"></span>
          Substitutes
        </h3>
        <span className="text-[11px] text-gray-400 font-medium">Subs 1 - 4</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 py-2">
        {benchPlayers.map((player, idx) => (
          <div key={player.element.id} className="flex flex-col items-center">
            <div className="text-[10px] font-black text-gray-400 mb-1">
              {idx === 0 ? 'GK' : `Sub ${idx}`}
            </div>
            <PlayerCard player={player} onClick={onPlayerClick} isBench={true} mode={mode} isPreview={isPreview} />
          </div>
        ))}
      </div>
    </div>
  );
}
