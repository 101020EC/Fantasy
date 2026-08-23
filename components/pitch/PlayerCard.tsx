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

  const renderPriceBadge = () => {
    if (priceAnalysis.status === 'rising_soon') {
      return (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-emerald-500 text-white rounded-full font-black text-[10px] shadow-md animate-pulse-rise" title="เสี่ยงราคาขึ้นคืนนี้!">
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
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-rose-500 text-white rounded-full font-black text-[10px] shadow-md animate-pulse-fall" title="เสี่ยงราคาตกคืนนี้!">
          <TrendingDown className="w-3 h-3 stroke-[3]" />
        </span>
      );
    }
    if (priceAnalysis.status === 'likely_faller') {
      return (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-orange-500 text-white rounded-full text-[9px] shadow" title="มีแนวโน้มราคาลง">
          <TrendingDown className="w-2.5 h-2.5 stroke-[2.5]" />
        </span>
      );
    }
    return null;
  };

  const getFDRBadgeColor = (diff: number) => {
    switch (diff) {
      case 1:
      case 2:
        return 'bg-emerald-500 text-white';
      case 3:
        return 'bg-gray-500 text-white';
      case 4:
        return 'bg-rose-500 text-white';
      case 5:
        return 'bg-rose-900 text-rose-100';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  return (
    <button
      onClick={() => onClick(player)}
      className={`group relative flex flex-col items-center w-[76px] sm:w-24 md:w-28 transition-transform transform active:scale-95 focus:outline-none ${
        isBench ? 'opacity-90 hover:opacity-100' : 'hover:scale-105'
      }`}
    >
      {/* Jersey + Badges Container */}
      <div className="relative flex items-center justify-center mb-1">
        <PlayerJersey
          teamCode={element.team_code}
          isGkp={elementType.id === 1}
          className="w-10 h-10 sm:w-13 sm:h-13 drop-shadow-md group-hover:scale-105 transition-all"
        />

        {/* Captain / Vice Captain Badge */}
        {pick.is_captain && (
          <span className="absolute -bottom-1 -left-1 bg-[#111318] text-white font-black text-[9px] sm:text-[10px] w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border-2 border-white shadow">
            C
          </span>
        )}
        {pick.is_vice_captain && (
          <span className="absolute -bottom-1 -left-1 bg-pastel-orange text-[#111318] font-black text-[9px] sm:text-[10px] w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border-2 border-white shadow">
            V
          </span>
        )}

        {/* Price Trend Radar Badge */}
        {renderPriceBadge()}

        {/* Injury / Doubt flag */}
        {element.status !== 'a' && (
          <span
            className={`absolute top-0 -left-1 px-1 py-0.2 rounded-full text-[8px] font-bold text-white shadow ${
              element.status === 'd' ? 'bg-amber-500' : 'bg-rose-500'
            }`}
          >
            !
          </span>
        )}
      </div>

      {/* Player Info Squircle Box */}
      <div className="w-full bg-white/95 dark:bg-[#171a23]/95 border border-black/5 dark:border-white/10 rounded-xl sm:rounded-2xl overflow-hidden shadow-md group-hover:ring-2 group-hover:ring-pastel-blue transition">
        {/* Name and Team Tag */}
        <div className="px-1 py-0.5 text-center bg-gray-50 dark:bg-pastel-darkPill border-b border-black/5 dark:border-white/5 flex items-center justify-center">
          <span className="text-[10px] sm:text-xs font-black text-[#111318] dark:text-white truncate max-w-[65px] sm:max-w-[85px]">
            {element.web_name}
          </span>
        </div>

        {/* Price & GW Points */}
        <div className="px-1 py-0.5 flex items-center justify-between text-[9px] sm:text-[10px] font-bold bg-white dark:bg-[#171a23]">
          <span className="text-gray-600 dark:text-gray-300 font-mono">£{priceAnalysis.currentCost.toFixed(1)}</span>
          <span className="text-[#111318] dark:text-white px-1.5 py-0.2 rounded-full bg-pastel-blueLight dark:bg-pastel-darkPill font-black text-[9px]">
            {element.event_points}pt
          </span>
        </div>

        {/* Next Fixture & FDR */}
        {nextFixture && (
          <div className="px-1 py-0.5 text-[8px] sm:text-[9px] flex items-center justify-between border-t border-black/5 dark:border-white/5 bg-gray-50/80 dark:bg-[#12151c]/80">
            <span className="text-gray-500 dark:text-gray-400 font-semibold truncate">
              {nextFixture.opponent.short_name} ({nextFixture.isHome ? 'H' : 'A'})
            </span>
            <span className={`px-1 py-0.2 rounded-full font-bold text-[8px] ${getFDRBadgeColor(nextFixture.difficulty)}`}>
              {nextFixture.difficulty}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
