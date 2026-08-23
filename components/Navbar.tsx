'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, TrendingUp, Search, User, Lock } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useAuth } from './AuthContext';

export default function Navbar() {
  const [quickTeamId, setQuickTeamId] = useState('');
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
    <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-[#150020]/95 backdrop-blur-md border-b border-purple-200/80 dark:border-purple-900/60 px-3 sm:px-6 py-2.5 transition-colors shadow-sm">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-fpl-green via-fpl-cyan to-fpl-pink p-0.5 shadow-md group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-purple-950 rounded-[7px] sm:rounded-[10px] flex items-center justify-center">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-fpl-green" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 font-black text-base sm:text-lg tracking-tight text-gray-900 dark:text-white leading-none">
              <span>FPL</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 dark:from-fpl-green to-teal-500 dark:to-fpl-cyan">
                Radar
              </span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-fpl-pink/15 text-fpl-pink font-extrabold border border-fpl-pink/30">
                PRO
              </span>
            </div>
            <p className="text-[9px] text-gray-500 dark:text-gray-400 font-medium hidden md:block">
              Team Analyzer & Price Predictor
            </p>
          </div>
        </Link>

        {/* Quick Team Search Box (Desktop) */}
        <form onSubmit={handleSearch} className="hidden lg:flex items-center relative max-w-xs w-full">
          <input
            type="number"
            value={quickTeamId}
            onChange={(e) => setQuickTeamId(e.target.value)}
            placeholder="ค้นหา Team ID..."
            className="w-full pl-9 pr-16 py-1.5 text-xs bg-gray-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 rounded-full text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-purple-600 dark:focus:border-fpl-green"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3" />
          <button
            type="submit"
            className="absolute right-1 top-1 bottom-1 px-2.5 bg-purple-900 dark:bg-fpl-green text-white dark:text-fpl-purple font-bold text-[11px] rounded-full hover:opacity-90 transition"
          >
            เปิด
          </button>
        </form>

        {/* Navigation Links & Action Buttons */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {/* My Saved Team (if exists) */}
          {savedTeamId && (
            <Link
              href={`/team/${savedTeamId}`}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-100 dark:bg-purple-900/80 text-purple-900 dark:text-fpl-cyan border border-purple-300 dark:border-purple-700/60 hover:scale-105 transition"
              title="เปิดทีมหลักของคุณ"
            >
              <User className="w-3.5 h-3.5 text-purple-700 dark:text-fpl-green" />
              <span className="hidden xs:inline">ทีมฉัน</span>
              <span className="text-[10px] font-mono">#{savedTeamId}</span>
            </Link>
          )}

          {/* Market Radar Link */}
          <Link
            href="/prices"
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-purple-600 dark:hover:text-fpl-cyan hover:bg-purple-50 dark:hover:bg-white/5 transition"
          >
            <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-fpl-cyan" />
            <span className="hidden sm:inline">ตลาดราคา</span>
          </Link>

          {/* Search/Home */}
          <Link
            href="/"
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-purple-600 dark:hover:text-fpl-green hover:bg-purple-50 dark:hover:bg-white/5 transition"
          >
            <Search className="w-3.5 h-3.5 text-purple-600 dark:text-fpl-green" />
            <span className="hidden sm:inline">ค้นหา</span>
          </Link>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Logout / Lock App */}
          <button
            onClick={logout}
            type="button"
            className="p-2 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/40 transition"
            title="ล็อคแอปพลิเคชัน"
            aria-label="Lock App"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </nav>
      </div>
    </header>
  );
}
