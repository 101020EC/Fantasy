'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, TrendingUp, Search, Bell, Lock, User, Send, Moon, Sun } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useAuth } from './AuthContext';
import TelegramSettingsModal from './telegram/TelegramSettingsModal';

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
      <header className="sticky top-0 z-40 w-full bg-pastel-bg/85 dark:bg-[#0e1118]/85 backdrop-blur-md px-4 sm:px-8 py-3 transition-colors">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* User / Manager Greeting Avatar (Matching the image style: "Hello, Manager") */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pastel-blue via-pastel-purple to-pastel-orange p-0.5 shadow-sm group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-white dark:bg-[#171a23] rounded-full flex items-center justify-center text-[#111318] dark:text-white font-black text-sm">
                ⚽
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Hello,</span>
                <span className="text-xs font-black text-[#111318] dark:text-white">
                  {savedTeamId ? `Manager #${savedTeamId}` : 'Manager'}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5"></span>
              </div>
              <div className="font-black text-sm text-[#111318] dark:text-white leading-tight">
                FPL Radar <span className="text-pastel-blueDark dark:text-pastel-blue">Pro</span>
              </div>
            </div>
          </Link>

          {/* Search Pill (Matching the pill search in the image) */}
          <form onSubmit={handleSearch} className="hidden sm:flex items-center relative max-w-xs w-full">
            <input
              type="number"
              value={quickTeamId}
              onChange={(e) => setQuickTeamId(e.target.value)}
              placeholder="Search Team ID..."
              className="w-full pl-9 pr-14 py-2 text-xs bg-white dark:bg-[#171a23] border border-black/5 dark:border-white/10 rounded-full text-[#111318] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pastel-blue shadow-sm transition"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5" />
            <button
              type="submit"
              className="absolute right-1 top-1 bottom-1 px-3 bg-[#111318] dark:bg-white text-white dark:text-[#111318] font-bold text-[11px] rounded-full hover:opacity-90 transition"
            >
              Go
            </button>
          </form>

          {/* Right Action Icons (Matching Notification Bell with red indicator in the image) */}
          <div className="flex items-center gap-2">
            {/* Telegram Alert Button */}
            <button
              onClick={() => setIsTelegramOpen(true)}
              className="w-9 h-9 rounded-full bg-white dark:bg-[#171a23] border border-black/5 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:text-sky-500 shadow-sm flex items-center justify-center transition hover:scale-105"
              title="ตั้งค่าแจ้งเตือน Telegram"
              type="button"
            >
              <Send className="w-4 h-4" />
            </button>

            {/* Notification Bell with indicator */}
            <Link
              href="/prices"
              className="relative w-9 h-9 rounded-full bg-white dark:bg-[#171a23] border border-black/5 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:text-pastel-blueDark shadow-sm flex items-center justify-center transition hover:scale-105"
              title="กระดานราคาปรับคืนนี้"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border border-white dark:border-[#171a23]"></span>
            </Link>

            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* Logout/Lock */}
            <button
              onClick={logout}
              className="w-9 h-9 rounded-full bg-white dark:bg-[#171a23] border border-black/5 dark:border-white/10 text-gray-400 hover:text-rose-500 shadow-sm flex items-center justify-center transition hover:scale-105"
              title="ล็อคแอปพลิเคชัน"
              type="button"
            >
              <Lock className="w-3.5 h-3.5" />
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
