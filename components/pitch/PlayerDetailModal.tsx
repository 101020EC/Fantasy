import React from 'react';
import { TeamSquadPlayer } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, Activity, ShieldAlert } from 'lucide-react';
import PlayerJersey from './PlayerJersey';
import Modal from '../ui/Modal';

interface PlayerDetailModalProps {
  player: TeamSquadPlayer | null;
  onClose: () => void;
}

export default function PlayerDetailModal({ player, onClose }: PlayerDetailModalProps) {
  if (!player) return null;

  const { element, team, elementType, priceAnalysis, nextFixture, pick } = player;

  const getStatusBadge = () => {
    switch (priceAnalysis.status) {
      case 'rising_soon':
        return (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs animate-pulse-rise">
            <TrendingUp className="w-4 h-4" />
            <span>Alert: Expected to Rise (£+0.1m) Tonight!</span>
          </div>
        );
      case 'likely_riser':
        return (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
            <TrendingUp className="w-4 h-4" />
            <span>Trending upward in market transfers</span>
          </div>
        );
      case 'falling_soon':
        return (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-100 text-rose-800 rounded-full font-bold text-xs animate-pulse-fall">
            <TrendingDown className="w-4 h-4" />
            <span>Alert: At Risk of Falling (£-0.1m) Tonight!</span>
          </div>
        );
      case 'likely_faller':
        return (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 text-rose-700 rounded-full text-xs font-semibold">
            <TrendingDown className="w-4 h-4" />
            <span>High net sales, trending downward</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
            <Minus className="w-4 h-4" />
            <span>Stable market price</span>
          </div>
        );
    }
  };

  return (
    <Modal isOpen onClose={onClose} labelledBy="player-detail-title" className="max-w-lg">
        {/* Header with Jersey & Name */}
        <div className="flex items-center gap-4 mb-5">
          <div className="p-3 bg-pastel-bg rounded-2xl">
            <PlayerJersey teamCode={element.team_code} isGkp={elementType.id === 1} className="w-14 h-14" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#111318] text-white">
                {elementType.singular_name_short}
              </span>
              <span className="text-xs font-bold text-gray-500">{team.name}</span>
              {pick.is_captain && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pastel-blue text-[#111318]">
                  CAPTAIN
                </span>
              )}
              {pick.is_vice_captain && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pastel-orange text-[#111318]">
                  VICE
                </span>
              )}
            </div>
            <h2 id="player-detail-title" className="text-xl sm:text-2xl font-black mt-1 text-[#111318]">{priceAnalysis.fullName}</h2>
            <p className="text-xs text-gray-400">ID: {element.id} • {element.web_name}</p>
          </div>
        </div>

        {/* Price Alert Status Pill */}
        <div className="mb-5">{getStatusBadge()}</div>

        {/* Injury / News Alert if any */}
        {element.news && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-800 font-medium leading-relaxed">{element.news}</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5 text-center">
          <div className="p-3 bg-pastel-bg rounded-2xl">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">Current Price</span>
            <span className="text-lg font-black text-emerald-600">£{priceAnalysis.currentCost.toFixed(1)}m</span>
          </div>

          <div className="p-3 bg-pastel-bg rounded-2xl">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">Total Points</span>
            <span className="text-lg font-black text-[#111318]">{element.total_points}</span>
          </div>

          <div className="p-3 bg-pastel-bg rounded-2xl">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">Form</span>
            <span className="text-lg font-black text-pastel-blueDark">{element.form}</span>
          </div>

          <div className="p-3 bg-pastel-bg rounded-2xl">
            <span className="text-[11px] text-gray-500 block mb-0.5 font-semibold">Selected By</span>
            <span className="text-lg font-black text-pastel-orangeDark">{priceAnalysis.selectedByPercent}%</span>
          </div>
        </div>

        {/* Transfer Velocity & Price Change Prediction Meter */}
        <div className="p-4 bg-pastel-bg rounded-2xl mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-pastel-blueDark" />
              Target % (Price Momentum)
            </span>
            <span className={`text-xs font-black ${
              priceAnalysis.changeScore > 0 ? 'text-emerald-600' : priceAnalysis.changeScore < 0 ? 'text-rose-600' : 'text-gray-500'
            }`}>
              {priceAnalysis.changeScore > 0 ? `+${priceAnalysis.changeScore}` : priceAnalysis.changeScore}%
            </span>
          </div>

          {/* Meter Bar */}
          <div className="relative w-full h-2.5 bg-gray-200 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-500 ${
                priceAnalysis.changeScore > 0
                  ? 'bg-emerald-500'
                  : priceAnalysis.changeScore < 0
                  ? 'bg-rose-500'
                  : 'bg-gray-400'
              }`}
              style={{
                width: `${Math.min(100, Math.max(10, Math.abs(priceAnalysis.changeScore)))}%`,
                marginLeft: priceAnalysis.changeScore < 0 ? 'auto' : '0',
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <span className="text-gray-400 text-[10px] block font-medium">Transfers In</span>
              <span className="font-black text-emerald-600">+{priceAnalysis.transfersInEvent.toLocaleString()}</span>
            </div>
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <span className="text-gray-400 text-[10px] block font-medium">Transfers Out</span>
              <span className="font-black text-rose-600">-{priceAnalysis.transfersOutEvent.toLocaleString()}</span>
            </div>
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <span className="text-gray-400 text-[10px] block font-medium">Net</span>
              <span className={`font-black ${priceAnalysis.netTransfers >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {priceAnalysis.netTransfers >= 0 ? `+${priceAnalysis.netTransfers.toLocaleString()}` : priceAnalysis.netTransfers.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Next Fixture */}
        {nextFixture && (
          <div className="p-3.5 bg-pastel-bg rounded-2xl flex items-center justify-between">
            <div className="text-xs text-gray-500 font-medium">Next Fixture</div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xs sm:text-sm text-[#111318]">
                {nextFixture.isHome ? `${nextFixture.opponent.short_name} (H)` : `${nextFixture.opponent.short_name} (A)`}
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white ${
                  nextFixture.difficulty <= 2
                    ? 'bg-emerald-500'
                    : nextFixture.difficulty === 3
                    ? 'bg-gray-500'
                    : nextFixture.difficulty === 4
                    ? 'bg-rose-500'
                    : 'bg-rose-900'
                }`}
              >
                FDR {nextFixture.difficulty}
              </span>
            </div>
          </div>
        )}
    </Modal>
  );
}
