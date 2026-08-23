'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Bell, LogOut, Send } from 'lucide-react';
import { useAuth } from './AuthContext';
import TelegramSettingsModal from './telegram/TelegramSettingsModal';
import PremierLeagueLogo from './PremierLeagueLogo';

export default function Navbar() {
  const [quickTeamId, setQuickTeamId] = useState('');
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const router = useRouter();
  const { savedTeamId, logout } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickTeamId.trim()) {
      router.push(`/team/${quickTeamId.trim()}`);
      setQuickTeamId('');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-black/5 px-4 sm:px-8 py-3 transition-colors shadow-sm">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Official Premier League Logo + FPL Radar Brand Name */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <PremierLeagueLogo className="w-9 h-9 sm:w-10 sm:h-10 drop-shadow-sm group-hover:scale-105 transition-transform" />
            <div>
              <div className="flex items-center gap-1">
                <span className="text-base sm:text-lg font-black text-[#38003c] tracking-tight">
                  FPL Radar
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5"></span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium hidden sm:block">
                Fantasy Premier League Radar
              </p>
            </div>
          </Link>

          {/* Search Pill (Desktop) */}
          <form onSubmit={handleSearch} className="hidden sm:flex items-center relative max-w-xs w-full">
            <input
              type="number"
              value={quickTeamId}
              onChange={(e) => setQuickTeamId(e.target.value)}
              placeholder="Search Team ID..."
              className="w-full pl-9 pr-14 py-2 text-base sm:text-xs bg-gray-50 border border-black/5 rounded-full text-[#111318] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 shadow-sm transition"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5" />
            <button
              type="submit"
              className="absolute right-1 top-1 bottom-1 px-3 bg-[#38003c] text-white font-bold text-[11px] rounded-full hover:opacity-90 transition"
            >
              Go
            </button>
          </form>

          {/* Right Action Icons: Telegram, Bell, and Sign Out */}
          <div className="flex items-center gap-2">
            {/* Telegram Alert Button */}
            <button
              onClick={() => setIsTelegramOpen(true)}
              className="w-9 h-9 rounded-full bg-gray-50 hover:bg-sky-50 border border-black/5 text-gray-700 hover:text-sky-600 shadow-sm flex items-center justify-center transition hover:scale-105 active:scale-95"
              title="ตั้งค่าแจ้งเตือน Telegram"
              type="button"
            >
              <Send className="w-4 h-4" />
            </button>

            {/* Notification Bell with indicator */}
            <Link
              href="/prices"
              className="relative w-9 h-9 rounded-full bg-gray-50 hover:bg-purple-50 border border-black/5 text-gray-700 hover:text-[#38003c] shadow-sm flex items-center justify-center transition hover:scale-105 active:scale-95"
              title="กระดานราคาปรับคืนนี้"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border border-white"></span>
            </Link>

            {/* Sign Out (Logout) Icon Button */}
            <button
              onClick={logout}
              className="w-9 h-9 rounded-full bg-gray-50 hover:bg-rose-50 border border-black/5 text-gray-600 hover:text-rose-600 shadow-sm flex items-center justify-center transition hover:scale-105 active:scale-95"
              title="ออกจากระบบ (Sign Out)"
              type="button"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <TelegramSettingsModal
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
      />
    </>
  );
}
