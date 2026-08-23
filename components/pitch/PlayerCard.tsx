import React from 'react';
import { TeamSquadPlayer } from '@/lib/types';
import PlayerJersey from './PlayerJersey';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PlayerCardProps {
  player: TeamSquadPlayer;
  onClick: (player: TeamSquadPlayer) => void;
  isBench?: boolean;
}

export default function PlayerCard({ player, onClick, isBench = false }: PlayerCardProps) {
  const { element, team, elementType, priceAnalysis, nextFixture, pick } = player;

  // Render price indicator icon
  const renderPriceBadge = () => {
    if (priceAnalysis.status === 'rising_soon') {
      return (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-emerald-500 text-purple-950 rounded-full font-black text-[10px] shadow-lg animate-pulse-rise" title="เสี่ยงราคาขึ้นคืนนี้!">
          <TrendingUp className="w-3 h-3 stroke-[3]" />
        </span>
      );
    }
    if (priceAnalysis.status === 'likely_riser') {
      return (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-emerald-600 text-white rounded-full text-[9px] shadow" title="มีแนวโน้มราคาขึ้น">
          <TrendingUp className="w-2.5 h-2.5 stroke-[2.5]" />
        </span>
      );
    }
    if (priceAnalysis.status === 'falling_soon') {
      return (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-rose-500 text-white rounded-full font-black text-[10px] shadow-lg animate-pulse-fall" title="เสี่ยงราคาตกคืนนี้!">
          <TrendingDown className="w-3 h-3 stroke-[3]" />
        </span>
      );
    }
    if (priceAnalysis.status === 'likely_faller') {
      return (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-orange-600 text-white rounded-full text-[9px] shadow" title="มีแนวโน้มราคาลง">
          <TrendingDown className="w-2.5 h-2.5 stroke-[2.5]" />
        </span>
      );
    }
    return null;
  };

  // FDR Color Pill
  const getFDRBadgeColor = (diff: number) => {
    switch (diff) {
      case 1:
      case 2:
        return 'bg-emerald-600 text-white';
      case 3:
        return 'bg-slate-600 text-white';
      case 4:
        return 'bg-rose-600 text-white';
      case 5:
        return 'bg-rose-950 text-rose-200 border border-rose-700';
      default:
        return 'bg-gray-700 text-gray-200';
    }
  };

  return (
    <button
      onClick={() => onClick(player)}
      className={`group relative flex flex-col items-center w-20 sm:w-24 md:w-28 transition-transform transform active:scale-95 focus:outline-none ${
        isBench ? 'opacity-90 hover:opacity-100' : 'hover:scale-105'
      }`}
    >
      {/* Jersey + Badges Container */}
      <div className="relative flex items-center justify-center mb-1">
        <PlayerJersey
          teamCode={element.team_code}
          isGkp={elementType.id === 1}
          className="w-11 h-11 sm:w-14 sm:h-14 drop-shadow-md group-hover:drop-shadow-[0_4px_10px_rgba(0,255,135,0.4)] transition-all"
        />

        {/* Captain / Vice Captain Badge */}
        {pick.is_captain && (
          <span className="absolute -bottom-1 -left-1 bg-fpl-cyan text-fpl-purple font-black text-[9px] sm:text-[10px] w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border border-white shadow">
            C
          </span>
        )}
        {pick.is_vice_captain && (
          <span className="absolute -bottom-1 -left-1 bg-amber-400 text-fpl-purple font-black text-[9px] sm:text-[10px] w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border border-white shadow">
            V
          </span>
        )}

        {/* Price Trend Radar Badge */}
        {renderPriceBadge()}

        {/* Injury / Doubt flag */}
        {element.status !== 'a' && (
          <span
            className={`absolute top-0 -left-1 px-1 py-0.2 rounded text-[8px] font-bold text-white shadow ${
              element.status === 'd' ? 'bg-amber-500' : 'bg-rose-600'
            }`}
          >
            !
          </span>
        )}
      </div>

      {/* Player Info Box */}
      <div className="w-full bg-[#12011b]/95 border border-purple-800/80 rounded-md overflow-hidden shadow-lg group-hover:border-fpl-green/60 transition">
        {/* Name and Team Tag */}
        <div className="px-1 py-0.5 bg-gradient-to-r from-purple-950 via-purple-900 to-purple-950 text-center border-b border-purple-800/40 flex items-center justify-center gap-1">
          <span className="text-[10px] sm:text-xs font-bold text-white truncate max-w-[70px] sm:max-w-[85px]">
            {element.web_name}
          </span>
        </div>

        {/* Price & GW Points */}
        <div className="px-1 py-0.5 flex items-center justify-between text-[9px] sm:text-[10px] font-bold bg-black/40">
          <span className="text-fpl-green">£{priceAnalysis.currentCost.toFixed(1)}m</span>
          <span className="text-white px-1 rounded bg-purple-800/60 font-black">
            {element.event_points} pt
          </span>
        </div>

        {/* Next Fixture & FDR */}
        {nextFixture && (
          <div className="px-1 py-0.5 text-[8px] sm:text-[9px] flex items-center justify-between border-t border-purple-900/50 bg-[#1e022b]/80">
            <span className="text-gray-300 font-medium truncate">
              {nextFixture.opponent.short_name} ({nextFixture.isHome ? 'H' : 'A'})
            </span>
            <span className={`px-1 rounded font-bold text-[8px] ${getFDRBadgeColor(nextFixture.difficulty)}`}>
              {nextFixture.difficulty}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
