'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Shield, TrendingUp, Send, Sun, Moon } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeProvider';
import TelegramSettingsModal from './telegram/TelegramSettingsModal';

export default function BottomNav() {
  const pathname = usePathname();
  const { savedTeamId } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);

  const teamHref = savedTeamId ? `/team/${savedTeamId}` : '/?switch=true';
  const isHome = pathname === '/' || pathname === '';
  const isTeam = pathname.startsWith('/team');
  const isPrices = pathname.startsWith('/prices');

  return (
    <>
      <nav className="md:hidden fixed bottom-3 left-4 right-4 z-50 max-w-md mx-auto">
        <div className="bg-white/95 dark:bg-[#171a23]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-2xl rounded-full px-5 py-2.5 flex items-center justify-between">
          {/* Home */}
          <Link
            href="/?switch=true"
            className={`flex flex-col items-center gap-0.5 transition-transform active:scale-90 ${
              isHome && !isTeam ? 'text-[#111318] dark:text-pastel-blue font-black' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`p-1.5 rounded-full ${isHome && !isTeam ? 'bg-pastel-blueLight dark:bg-pastel-darkPill' : ''}`}>
              <Home className="w-4 h-4" />
            </div>
            <span className="text-[10px]">หน้าแรก</span>
          </Link>

          {/* Team / Pitch */}
          <Link
            href={teamHref}
            className={`flex flex-col items-center gap-0.5 transition-transform active:scale-90 ${
              isTeam ? 'text-[#111318] dark:text-pastel-blue font-black' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`p-1.5 rounded-full ${isTeam ? 'bg-pastel-blueLight dark:bg-pastel-darkPill' : ''}`}>
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-[10px]">ทีมฉัน</span>
          </Link>

          {/* Price Radar */}
          <Link
            href="/prices"
            className={`flex flex-col items-center gap-0.5 transition-transform active:scale-90 ${
              isPrices ? 'text-[#111318] dark:text-pastel-blue font-black' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`p-1.5 rounded-full ${isPrices ? 'bg-pastel-blueLight dark:bg-pastel-darkPill' : ''}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[10px]">ราคาตลาด</span>
          </Link>

          {/* Telegram Alert */}
          <button
            onClick={() => setIsTelegramOpen(true)}
            className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-sky-500 transition-transform active:scale-90"
            type="button"
          >
            <div className="p-1.5 rounded-full">
              <Send className="w-4 h-4 text-sky-500" />
            </div>
            <span className="text-[10px]">แจ้งเตือน</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-amber-500 transition-transform active:scale-90"
            type="button"
            title="เปลี่ยนโหมดสี"
          >
            <div className="p-1.5 rounded-full">
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-purple-600" />
              )}
            </div>
            <span className="text-[10px]">{theme === 'dark' ? 'สว่าง' : 'มืด'}</span>
          </button>
        </div>
      </nav>

      <TelegramSettingsModal
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
      />
    </>
  );
}
