import React from 'react';
import { TeamSquadPlayer } from '@/lib/types';
import { X, TrendingUp, TrendingDown, Minus, Activity, ShieldAlert, DollarSign, Users, Award } from 'lucide-react';
import PlayerJersey from './PlayerJersey';

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
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full font-bold text-xs animate-pulse-rise">
            <TrendingUp className="w-4 h-4" />
            <span>เตือน: คาดว่าราคาจะขึ้น (£+0.1m) เร็วๆ นี้!</span>
          </div>
        );
      case 'likely_riser':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold">
            <TrendingUp className="w-4 h-4" />
            <span>แนวโน้มราคาขึ้นเรื่อยๆ</span>
          </div>
        );
      case 'falling_soon':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full font-bold text-xs animate-pulse-fall">
            <TrendingDown className="w-4 h-4" />
            <span>เตือน: เสี่ยงราคาตก (£-0.1m) คืนนี้!</span>
          </div>
        );
      case 'likely_faller':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full text-xs font-semibold">
            <TrendingDown className="w-4 h-4" />
            <span>ยอดขายออกสูง มีแนวโน้มราคาตก</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-700/30 text-gray-300 border border-gray-600/30 rounded-full text-xs">
            <Minus className="w-4 h-4" />
            <span>ราคาตลาดคงที่</span>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-purple-950 to-[#12001a] border border-purple-800/80 rounded-2xl p-6 shadow-2xl text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Jersey & Name */}
        <div className="flex items-center gap-4 mb-5">
          <div className="p-3 bg-purple-900/40 border border-purple-700/50 rounded-xl">
            <PlayerJersey teamCode={element.team_code} isGkp={elementType.id === 1} className="w-14 h-14" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-800 text-purple-200">
                {elementType.singular_name_short}
              </span>
              <span className="text-xs font-semibold text-gray-300">{team.name}</span>
              {pick.is_captain && (
                <span className="text-xs font-black px-1.5 py-0.5 rounded bg-fpl-cyan text-fpl-purple">
                  CAPTAIN
                </span>
              )}
              {pick.is_vice_captain && (
                <span className="text-xs font-black px-1.5 py-0.5 rounded bg-amber-400 text-fpl-purple">
                  VICE
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black mt-0.5 text-white">{priceAnalysis.fullName}</h2>
            <p className="text-xs text-gray-400">ID: {element.id} • {element.web_name}</p>
          </div>
        </div>

        {/* Price Alert Status Pill */}
        <div className="mb-5">{getStatusBadge()}</div>

        {/* Injury / News Alert if any */}
        {element.news && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-200 font-medium">{element.news}</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5 text-center">
          <div className="p-3 bg-purple-900/30 border border-purple-800/40 rounded-xl">
            <span className="text-[11px] text-gray-400 block mb-1 font-medium">ราคาปัจจุบัน</span>
            <span className="text-lg font-black text-fpl-green">£{priceAnalysis.currentCost.toFixed(1)}m</span>
          </div>

          <div className="p-3 bg-purple-900/30 border border-purple-800/40 rounded-xl">
            <span className="text-[11px] text-gray-400 block mb-1 font-medium">แต้มรวม</span>
            <span className="text-lg font-black text-white">{element.total_points}</span>
          </div>

          <div className="p-3 bg-purple-900/30 border border-purple-800/40 rounded-xl">
            <span className="text-[11px] text-gray-400 block mb-1 font-medium">ฟอร์ม (Form)</span>
            <span className="text-lg font-black text-fpl-cyan">{element.form}</span>
          </div>

          <div className="p-3 bg-purple-900/30 border border-purple-800/40 rounded-xl">
            <span className="text-[11px] text-gray-400 block mb-1 font-medium">การถือครอง</span>
            <span className="text-lg font-black text-amber-300">{priceAnalysis.selectedByPercent}%</span>
          </div>
        </div>

        {/* Transfer Velocity & Price Change Prediction Meter */}
        <div className="p-4 bg-purple-900/40 border border-purple-800/60 rounded-xl mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-fpl-cyan" />
              ดัชนีแรงขับเคลื่อนราคา (Price Momentum)
            </span>
            <span className={`text-xs font-black ${
              priceAnalysis.changeScore > 0 ? 'text-emerald-400' : priceAnalysis.changeScore < 0 ? 'text-rose-400' : 'text-gray-300'
            }`}>
              {priceAnalysis.changeScore > 0 ? `+${priceAnalysis.changeScore}` : priceAnalysis.changeScore}%
            </span>
          </div>

          {/* Meter Bar */}
          <div className="relative w-full h-3 bg-gray-900 rounded-full overflow-hidden mb-3 border border-purple-900">
            <div
              className={`h-full transition-all duration-500 ${
                priceAnalysis.changeScore > 0
                  ? 'bg-gradient-to-r from-emerald-500 to-fpl-green'
                  : priceAnalysis.changeScore < 0
                  ? 'bg-gradient-to-r from-orange-500 to-rose-500'
                  : 'bg-gray-600'
              }`}
              style={{
                width: `${Math.min(100, Math.max(10, Math.abs(priceAnalysis.changeScore)))}%`,
                marginLeft: priceAnalysis.changeScore < 0 ? 'auto' : '0',
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-purple-950/60 rounded-lg">
              <span className="text-gray-400 text-[10px] block">ซื้อเข้า GW นี้</span>
              <span className="font-bold text-emerald-400">+{priceAnalysis.transfersInEvent.toLocaleString()}</span>
            </div>
            <div className="p-2 bg-purple-950/60 rounded-lg">
              <span className="text-gray-400 text-[10px] block">ขายออก GW นี้</span>
              <span className="font-bold text-rose-400">-{priceAnalysis.transfersOutEvent.toLocaleString()}</span>
            </div>
            <div className="p-2 bg-purple-950/60 rounded-lg">
              <span className="text-gray-400 text-[10px] block">สุทธิ (Net Transfers)</span>
              <span className={`font-bold ${priceAnalysis.netTransfers >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {priceAnalysis.netTransfers >= 0 ? `+${priceAnalysis.netTransfers.toLocaleString()}` : priceAnalysis.netTransfers.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Next Fixture */}
        {nextFixture && (
          <div className="p-3 bg-purple-900/20 border border-purple-800/30 rounded-xl flex items-center justify-between">
            <div className="text-xs text-gray-400">นัดถัดไป (Next Fixture)</div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">
                {nextFixture.isHome ? `${nextFixture.opponent.short_name} (H)` : `${nextFixture.opponent.short_name} (A)`}
              </span>
              <span
                className={`text-xs font-black px-2 py-0.5 rounded text-white ${
                  nextFixture.difficulty <= 2
                    ? 'bg-emerald-600'
                    : nextFixture.difficulty === 3
                    ? 'bg-gray-600'
                    : nextFixture.difficulty === 4
                    ? 'bg-rose-600'
                    : 'bg-rose-900'
                }`}
              >
                FDR {nextFixture.difficulty}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
