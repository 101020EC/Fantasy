'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Menu, LogOut, Send, Shield, History, TrendingUp, Database, X, Bell } from 'lucide-react';
import { useAuth } from './AuthContext';
import TelegramSettingsModal from './telegram/TelegramSettingsModal';
import PremierLeagueLogo from './PremierLeagueLogo';
import NotificationsModal from './notifications/NotificationsModal';

export default function Navbar() {
  const [quickTeamId, setQuickTeamId] = useState('');
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
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
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The login screen stands alone — no chrome around it.
  if (pathname === '/login') return null;

  const teamUrl = savedTeamId ? `/team/${savedTeamId}` : '/?switch=true';

  return (
    <>
      <header className="app-header sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-black/5 px-4 sm:px-8 py-3 transition-colors shadow-sm">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Logo links to main screen: Team (or Home if no team saved) */}
          <Link href={teamUrl} className="flex items-center gap-2.5 group shrink-0">
            <PremierLeagueLogo className="w-9 h-9 sm:w-10 sm:h-10 drop-shadow-sm group-hover:scale-105 transition-transform" />
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xl sm:text-2xl font-black text-[#38003c] tracking-tight">
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

          {/* Right Action: Clean Hamburger Menu Button only */}
          <div className="flex items-center gap-2 relative" ref={menuRef}>
            {/* Sits before the menu: it is a thing you check, not a setting you
                change, so it earns its own tap rather than a menu row. */}
            <button
              onClick={() => setIsNotifOpen(true)}
              type="button"
              title="Notifications"
              aria-label="Notifications"
              className="w-10 h-10 rounded-full border border-black/10 bg-gray-50 hover:bg-purple-50 text-[#38003c] flex items-center justify-center transition active:scale-90 shadow-sm"
            >
              <Bell className="w-4 h-4 stroke-[2.5]" />
            </button>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`w-10 h-10 rounded-full border border-black/10 flex items-center justify-center transition active:scale-90 shadow-sm ${
                isMenuOpen
                  ? 'bg-[#38003c] text-white'
                  : 'bg-gray-50 hover:bg-purple-50 text-[#38003c]'
              }`}
              title="Menu"
              type="button"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 stroke-[2.5]" />}
            </button>

            {/* Dropdown Menu with colorful large items */}
            {isMenuOpen && (
              <div className="absolute right-0 top-12 w-max min-w-[170px] bg-white border border-black/10 rounded-3xl shadow-2xl p-2 z-50 animate-fadeIn space-y-1">
                {/* Team */}
                <Link
                  href={teamUrl}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-black text-[#38003c] hover:bg-purple-50 transition whitespace-nowrap"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#38003c] flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span>Team</span>
                </Link>

                {/* History — plain home; only the change-team controls open setup */}
                <Link
                  href="/"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-black text-emerald-800 hover:bg-emerald-50 transition"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <History className="w-4 h-4" />
                  </div>
                  <span>History</span>
                </Link>

                {/* Market */}
                <Link
                  href="/prices"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-black text-orange-800 hover:bg-orange-50 transition"
                >
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span>Market</span>
                </Link>

                {/* Alert */}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsTelegramOpen(true);
                  }}
                  type="button"
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-black text-sky-800 hover:bg-sky-50 transition text-left"
                >
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                    <Send className="w-4 h-4" />
                  </div>
                  <span>Alert</span>
                </button>

                {/* Back Up */}
                <Link
                  href="/backup"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-black text-indigo-800 hover:bg-indigo-50 transition text-left"
                >
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <span>Back Up</span>
                </Link>

                <div className="my-1 border-t border-black/5" />

                {/* Log out */}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    logout();
                  }}
                  type="button"
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-black text-rose-700 hover:bg-rose-50 transition text-left"
                >
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <TelegramSettingsModal
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
      />

      <NotificationsModal isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />

    </>
  );
}
