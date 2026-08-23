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
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-full font-bold text-xs animate-pulse-rise">
            <TrendingUp className="w-4 h-4" />
            <span>เตือน: คาดว่าราคาจะขึ้น (£+0.1m) เร็วๆ นี้!</span>
          </div>
        );
      case 'likely_riser':
        return (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-semibold">
            <TrendingUp className="w-4 h-4" />
            <span>แนวโน้มราคาขึ้นเรื่อยๆ</span>
          </div>
        );
      case 'falling_soon':
        return (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 rounded-full font-bold text-xs animate-pulse-fall">
            <TrendingDown className="w-4 h-4" />
            <span>เตือน: เสี่ยงราคาตก (£-0.1m) คืนนี้!</span>
          </div>
        );
      case 'likely_faller':
        return (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 rounded-full text-xs font-semibold">
            <TrendingDown className="w-4 h-4" />
            <span>ยอดขายออกสูง มีแนวโน้มราคาตก</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-100 dark:bg-pastel-darkPill text-gray-600 dark:text-gray-300 rounded-full text-xs font-medium">
            <Minus className="w-4 h-4" />
            <span>ราคาตลาดคงที่</span>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#171a23] border border-black/5 dark:border-white/10 rounded-3xl p-6 shadow-2xl text-[#111318] dark:text-white max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-[#111318] dark:hover:text-white rounded-full bg-gray-100 dark:bg-white/5 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Jersey & Name */}
        <div className="flex items-center gap-4 mb-5">
          <div className="p-3 bg-pastel-bg dark:bg-pastel-darkPill rounded-2xl">
            <PlayerJersey teamCode={element.team_code} isGkp={elementType.id === 1} className="w-14 h-14" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#111318] text-white dark:bg-white dark:text-[#111318]">
                {elementType.singular_name_short}
              </span>
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{team.name}</span>
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
            <h2 className="text-xl sm:text-2xl font-black mt-1 text-[#111318] dark:text-white">{priceAnalysis.fullName}</h2>
            <p className="text-xs text-gray-400">ID: {element.id} • {element.web_name}</p>
          </div>
        </div>

        {/* Price Alert Status Pill */}
        <div className="mb-5">{getStatusBadge()}</div>

        {/* Injury / News Alert if any */}
        {element.news && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-800 dark:text-rose-200 font-medium leading-relaxed">{element.news}</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5 text-center">
          <div className="p-3 bg-pastel-bg dark:bg-pastel-darkPill rounded-2xl">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5 font-semibold">ราคาปัจจุบัน</span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">£{priceAnalysis.currentCost.toFixed(1)}m</span>
          </div>

          <div className="p-3 bg-pastel-bg dark:bg-pastel-darkPill rounded-2xl">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5 font-semibold">แต้มรวม</span>
            <span className="text-lg font-black text-[#111318] dark:text-white">{element.total_points}</span>
          </div>

          <div className="p-3 bg-pastel-bg dark:bg-pastel-darkPill rounded-2xl">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5 font-semibold">ฟอร์ม (Form)</span>
            <span className="text-lg font-black text-pastel-blueDark dark:text-pastel-blue">{element.form}</span>
          </div>

          <div className="p-3 bg-pastel-bg dark:bg-pastel-darkPill rounded-2xl">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5 font-semibold">การถือครอง</span>
            <span className="text-lg font-black text-pastel-orangeDark dark:text-pastel-orange">{priceAnalysis.selectedByPercent}%</span>
          </div>
        </div>

        {/* Transfer Velocity & Price Change Prediction Meter */}
        <div className="p-4 bg-pastel-bg dark:bg-pastel-darkPill rounded-2xl mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-pastel-blueDark dark:text-pastel-blue" />
              ดัชนีราคา (Price Momentum)
            </span>
            <span className={`text-xs font-black ${
              priceAnalysis.changeScore > 0 ? 'text-emerald-600 dark:text-emerald-400' : priceAnalysis.changeScore < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500'
            }`}>
              {priceAnalysis.changeScore > 0 ? `+${priceAnalysis.changeScore}` : priceAnalysis.changeScore}%
            </span>
          </div>

          {/* Meter Bar */}
          <div className="relative w-full h-2.5 bg-gray-200 dark:bg-black/40 rounded-full overflow-hidden mb-3">
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
            <div className="p-2 bg-white dark:bg-[#171a23] rounded-xl shadow-sm">
              <span className="text-gray-400 text-[10px] block font-medium">ซื้อเข้า GW นี้</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">+{priceAnalysis.transfersInEvent.toLocaleString()}</span>
            </div>
            <div className="p-2 bg-white dark:bg-[#171a23] rounded-xl shadow-sm">
              <span className="text-gray-400 text-[10px] block font-medium">ขายออก GW นี้</span>
              <span className="font-black text-rose-600 dark:text-rose-400">-{priceAnalysis.transfersOutEvent.toLocaleString()}</span>
            </div>
            <div className="p-2 bg-white dark:bg-[#171a23] rounded-xl shadow-sm">
              <span className="text-gray-400 text-[10px] block font-medium">สุทธิ</span>
              <span className={`font-black ${priceAnalysis.netTransfers >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {priceAnalysis.netTransfers >= 0 ? `+${priceAnalysis.netTransfers.toLocaleString()}` : priceAnalysis.netTransfers.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Next Fixture */}
        {nextFixture && (
          <div className="p-3.5 bg-pastel-bg dark:bg-pastel-darkPill rounded-2xl flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">นัดถัดไป (Next Fixture)</div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xs sm:text-sm text-[#111318] dark:text-white">
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
      </div>
    </div>
  );
}
