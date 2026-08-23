'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Bell, LogOut, Send, SlidersHorizontal, Shield, Activity, TrendingUp, ChevronDown, Edit3 } from 'lucide-react';
import { useAuth } from './AuthContext';
import TelegramSettingsModal from './telegram/TelegramSettingsModal';
import PremierLeagueLogo from './PremierLeagueLogo';

export default function Navbar() {
  const [quickTeamId, setQuickTeamId] = useState('');
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const editMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { savedTeamId, logout } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickTeamId.trim()) {
      router.push(`/team/${quickTeamId.trim()}`);
      setQuickTeamId('');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (editMenuRef.current && !editMenuRef.current.contains(event.target as Node)) {
        setIsEditMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const teamUrl = savedTeamId ? `/team/${savedTeamId}` : '/?switch=true';

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-black/5 px-4 sm:px-8 py-3 transition-colors shadow-sm">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Official Premier League Logo + Brand Name "Fanta" */}
          <Link href="/?switch=true" className="flex items-center gap-2.5 group shrink-0">
            <PremierLeagueLogo className="w-9 h-9 sm:w-10 sm:h-10 drop-shadow-sm group-hover:scale-105 transition-transform" />
            <div>
              <div className="flex items-center gap-1">
                <span className="text-lg sm:text-xl font-black text-[#38003c] tracking-tight">
                  Fanta
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5"></span>
              </div>
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

          {/* Right Action Icons & Edit Dropdown */}
          <div className="flex items-center gap-2">
            {/* Telegram Alert Quick Button */}
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

            {/* Edit Menu Dropdown Button (1. Team 2. Radar 3. Market 4. Alert 5. Log out) */}
            <div className="relative" ref={editMenuRef}>
              <button
                onClick={() => setIsEditMenuOpen(!isEditMenuOpen)}
                className={`px-3 py-1.5 rounded-full border border-black/10 text-xs font-black flex items-center gap-1.5 shadow-sm transition active:scale-95 ${
                  isEditMenuOpen
                    ? 'bg-[#38003c] text-white'
                    : 'bg-gray-50 hover:bg-purple-50 text-[#38003c]'
                }`}
                title="เมนู Edit"
                type="button"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isEditMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isEditMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-black/10 rounded-2xl shadow-2xl py-2 z-50 animate-fadeIn">
                  {/* 1. Team */}
                  <Link
                    href={teamUrl}
                    onClick={() => setIsEditMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-purple-50 hover:text-[#38003c] transition"
                  >
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span>1. Team</span>
                  </Link>

                  {/* 2. Radar */}
                  <Link
                    href={teamUrl}
                    onClick={() => setIsEditMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-purple-50 hover:text-[#38003c] transition"
                  >
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>2. Radar</span>
                  </Link>

                  {/* 3. Market */}
                  <Link
                    href="/prices"
                    onClick={() => setIsEditMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-purple-50 hover:text-[#38003c] transition"
                  >
                    <TrendingUp className="w-4 h-4 text-pastel-orangeDark" />
                    <span>3. Market</span>
                  </Link>

                  {/* 4. Alert */}
                  <button
                    onClick={() => {
                      setIsEditMenuOpen(false);
                      setIsTelegramOpen(true);
                    }}
                    type="button"
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-sky-50 hover:text-sky-600 transition text-left"
                  >
                    <Send className="w-4 h-4 text-sky-500" />
                    <span>4. Alert</span>
                  </button>

                  <div className="my-1 border-t border-black/5" />

                  {/* 5. Log out */}
                  <button
                    onClick={() => {
                      setIsEditMenuOpen(false);
                      logout();
                    }}
                    type="button"
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition text-left"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span>5. Log out</span>
                  </button>
                </div>
              )}
            </div>
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
