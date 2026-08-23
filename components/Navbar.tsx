'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, TrendingUp, Search, Activity, Sparkles } from 'lucide-react';

export default function Navbar() {
  const [quickTeamId, setQuickTeamId] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickTeamId.trim()) {
      router.push(`/team/${quickTeamId.trim()}`);
      setQuickTeamId('');
    }
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-purple-900/40 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fpl-green via-fpl-cyan to-fpl-pink p-0.5 shadow-lg group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-fpl-darkPurple rounded-[10px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-fpl-green" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-black text-lg sm:text-xl tracking-tight text-white">
              <span>FPL</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-fpl-green to-fpl-cyan">
                Radar
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-fpl-pink/20 text-fpl-pink font-semibold border border-fpl-pink/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-medium hidden sm:block">
              Team Analyzer & Price Predictor
            </p>
          </div>
        </Link>

        {/* Search quick box in Navbar */}
        <form onSubmit={handleSearch} className="hidden md:flex items-center relative max-w-xs w-full">
          <input
            type="number"
            value={quickTeamId}
            onChange={(e) => setQuickTeamId(e.target.value)}
            placeholder="กรอก Team ID..."
            className="w-full pl-9 pr-20 py-1.5 text-sm bg-purple-950/60 border border-purple-800/60 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-fpl-green focus:ring-1 focus:ring-fpl-green transition"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3" />
          <button
            type="submit"
            className="absolute right-1.5 top-1 bottom-1 px-3 bg-fpl-green text-fpl-purple font-bold text-xs rounded-full hover:bg-emerald-400 transition"
          >
            เปิดทีม
          </button>
        </form>

        {/* Navigation Links */}
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-gray-200 hover:text-fpl-green hover:bg-white/5 transition"
          >
            <Search className="w-4 h-4 text-fpl-green" />
            <span>ค้นหาทีม</span>
          </Link>
          <Link
            href="/prices"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-gray-200 hover:text-fpl-cyan hover:bg-white/5 transition"
          >
            <TrendingUp className="w-4 h-4 text-fpl-cyan" />
            <span>ตลาดราคาขึ้น/ลง</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
