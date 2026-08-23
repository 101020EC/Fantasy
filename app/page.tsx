'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Search, TrendingUp, TrendingDown, Sparkles, ArrowRight, User, Send, Calendar, CheckCircle2, ChevronRight, Activity } from 'lucide-react';
import RecentTeams from '@/components/team/RecentTeams';
import { useAuth } from '@/components/AuthContext';
import TelegramSettingsModal from '@/components/telegram/TelegramSettingsModal';
import Link from 'next/link';

export default function HomePage() {
  const { savedTeamId, setSavedTeamId } = useAuth();
  const searchParams = useSearchParams();
  const isSwitching = searchParams.get('switch') === 'true';

  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (savedTeamId && !isSwitching) {
      router.replace(`/team/${savedTeamId}`);
    } else if (savedTeamId) {
      setTeamId(savedTeamId);
    }
  }, [savedTeamId, isSwitching, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamId.trim()) {
      setLoading(true);
      setSavedTeamId(teamId.trim());
      router.push(`/team/${teamId.trim()}`);
    }
  };

  const handleDemoTeam = (demoId: string) => {
    setLoading(true);
    setTeamId(demoId);
    setSavedTeamId(demoId);
    router.push(`/team/${demoId}`);
  };

  const handleOpenMyTeam = () => {
    if (savedTeamId || teamId.trim()) {
      const target = teamId.trim() || savedTeamId;
      setLoading(true);
      router.push(`/team/${target}`);
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col justify-between w-full px-3 sm:px-6 py-4 sm:py-8 max-w-5xl mx-auto">
      <main className="w-full space-y-4 sm:space-y-6">
        {/* 1. Large Periwinkle Blue Hero Card (Matching the UX Lab / Learning Roadmap Card in the screenshot) */}
        <div className="card-pastel-blue p-6 sm:p-8 relative overflow-hidden shadow-xl">
          {/* Top header row inside Hero Card */}
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-white/80 dark:bg-black/40 flex items-center justify-center shadow-sm">
              <Shield className="w-5 h-5 text-[#111318] dark:text-white" />
            </div>
            {/* Circular status indicator badge like (2/3) in image */}
            <div className="w-10 h-10 rounded-full border border-[#111318]/20 dark:border-white/20 flex items-center justify-center font-black text-xs text-[#111318] dark:text-white bg-white/30 backdrop-blur-sm">
              2025
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-2xl sm:text-4xl font-black text-[#111318] dark:text-white tracking-tight leading-tight mb-2">
              Check Your FPL Squad &amp; Price Radar
            </h1>
            <p className="text-xs sm:text-sm text-[#111318]/80 dark:text-white/80 font-medium mb-6 leading-relaxed">
              ใส่ Team ID เพื่อวิเคราะห์ 11 ตัวจริง พร้อมระบบเรดาร์ดักราคานักเตะขึ้น-ลงรอบดึก
            </p>
          </div>

          {/* Capsule Action Button in Hero Card (like JOIN NOW in image) */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenMyTeam}
              className="px-6 py-2.5 bg-[#111318] text-white dark:bg-white dark:text-[#111318] font-black text-xs sm:text-sm rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
            >
              <span>{savedTeamId ? `OPEN SQUAD #${savedTeamId}` : 'GET STARTED'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsTelegramModalOpen(true)}
              className="px-4 py-2.5 bg-white/70 dark:bg-black/30 backdrop-blur-md text-[#111318] dark:text-white font-bold text-xs rounded-full border border-black/10 dark:border-white/10 hover:bg-white transition flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Telegram Alert</span>
            </button>
          </div>
        </div>

        {/* 2. Gameweek Schedule Capsule Bar (Matching the Sun Mon Tue Wed Thu Fri Sat pills in the image) */}
        <div className="pastel-card p-3 sm:p-4 shadow-sm flex items-center justify-between overflow-x-auto gap-2">
          {[
            { label: 'GW 25', status: 'done', color: 'bg-gray-100 dark:bg-pastel-darkPill text-gray-400' },
            { label: 'GW 26', status: 'done', color: 'bg-gray-100 dark:bg-pastel-darkPill text-gray-400' },
            { label: 'GW 27', status: 'current', color: 'bg-pastel-orange text-[#111318] font-black shadow-md' },
            { label: 'GW 28', status: 'next', color: 'bg-gray-100 dark:bg-pastel-darkPill text-gray-500' },
            { label: 'GW 29', status: 'upcoming', color: 'bg-gray-100 dark:bg-pastel-darkPill text-gray-500' },
            { label: 'GW 30', status: 'upcoming', color: 'bg-gray-100 dark:bg-pastel-darkPill text-gray-500' },
          ].map((item, idx) => (
            <div
              key={idx}
              className={`flex-1 min-w-[70px] text-center py-2 px-1 rounded-full text-xs transition ${item.color}`}
            >
              <span className="block text-[9px] uppercase opacity-75">Event</span>
              <span className="font-bold">{item.label}</span>
            </div>
          ))}
        </div>

        {/* 3. Team ID Capsule Search Bar */}
        <div className="pastel-card p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400">Team Setup</span>
            <span className="text-xs text-gray-400">กรอกหมายเลขทีม FPL</span>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="number"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                placeholder="กรอก FPL Team ID (เช่น 1, 12345)"
                required
                className="w-full pl-10 pr-4 py-3.5 bg-pastel-bg border border-black/5 rounded-full text-[#111318] font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 text-base transition"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3.5 bg-[#111318] dark:bg-white text-white dark:text-[#111318] font-black text-sm rounded-full shadow-md hover:opacity-90 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Loading...' : 'เปิดดูทีม'}
            </button>
          </form>

          {/* Quick Demo IDs */}
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-400 flex-wrap">
            <span>ตัวอย่างทีม:</span>
            {['1', '100', '12345', '54321'].map((id) => (
              <button
                key={id}
                onClick={() => handleDemoTeam(id)}
                className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-pastel-darkPill hover:bg-pastel-blueLight text-gray-700 dark:text-gray-300 font-mono text-[11px] transition"
              >
                #{id}
              </button>
            ))}
          </div>

          <RecentTeams />
        </div>

        {/* 4. Two Soft Pastel Cards: Lilac & Warm Orange (Matching the Design Odyssey & Focus Mode in screenshot) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card A: Lilac Card (Price Risers) */}
          <Link
            href="/prices"
            className="card-pastel-purple p-6 relative overflow-hidden shadow-lg group hover:scale-[1.02] active:scale-98 transition-all block text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-[#111318] text-white flex items-center justify-center shadow">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="w-9 h-9 rounded-full border border-[#111318]/20 dark:border-white/20 flex items-center justify-center font-black text-xs text-[#111318] dark:text-white bg-white/30 backdrop-blur-sm">
                +£
              </div>
            </div>

            <span className="text-[11px] font-bold text-[#111318]/70 dark:text-white/70 block uppercase tracking-wider">
              Price Radar
            </span>
            <h3 className="text-xl font-black text-[#111318] dark:text-white mt-0.5 mb-1">
              Top Risers Alert
            </h3>
            <p className="text-xs text-[#111318]/80 dark:text-white/80 leading-relaxed mb-4">
              เรดาร์เช็คยอดซื้อเข้าสุทธิ ดักซื้อก่อนนักเตะราคาแพงขึ้นคืนนี้
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-black/10 dark:border-white/10 text-xs font-black text-[#111318] dark:text-white">
              <span>EXPLORE RISERS</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card B: Orange Card (Price Fallers) */}
          <Link
            href="/prices"
            className="card-pastel-orange p-6 relative overflow-hidden shadow-lg group hover:scale-[1.02] active:scale-98 transition-all block text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-[#111318] text-white flex items-center justify-center shadow">
                <TrendingDown className="w-5 h-5 text-rose-400" />
              </div>
              <div className="w-9 h-9 rounded-full border border-[#111318]/20 dark:border-white/20 flex items-center justify-center font-black text-xs text-[#111318] dark:text-white bg-white/30 backdrop-blur-sm">
                -£
              </div>
            </div>

            <span className="text-[11px] font-bold text-[#111318]/70 dark:text-white/70 block uppercase tracking-wider">
              Risk Management
            </span>
            <h3 className="text-xl font-black text-[#111318] dark:text-white mt-0.5 mb-1">
              Top Fallers Risk
            </h3>
            <p className="text-xs text-[#111318]/80 dark:text-white/80 leading-relaxed mb-4">
              เช็คนักเตะที่ยอดเทขายทะลัก เสี่ยงราคาตกคืนนี้เพื่อรีบเปลี่ยนตัว
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-black/10 dark:border-white/10 text-xs font-black text-[#111318] dark:text-white">
              <span>CHECK FALLERS</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* 5. Black Capsule Row Items (Matching the Path / Mode black capsule rows in the image) */}
        <div className="space-y-2.5">
          <span className="text-xs font-black uppercase tracking-wider text-gray-400 block px-1">
            Quick Actions
          </span>

          {/* Row 1: Pitch View */}
          <button
            onClick={handleOpenMyTeam}
            className="w-full p-4 rounded-full bg-[#111318] text-white dark:bg-[#1a1d26] dark:text-white flex items-center justify-between hover:scale-[1.01] active:scale-98 transition shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white text-[#111318] dark:bg-pastel-blue dark:text-[#111318] flex items-center justify-center font-bold">
                <Shield className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm">Squad Formation (Pitch View)</div>
                <div className="text-[11px] text-gray-400">11 ตัวจริง และตัวสำรอง</div>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* Row 2: Full Market */}
          <Link
            href="/prices"
            className="w-full p-4 rounded-full bg-pastel-blueLight text-[#111318] dark:bg-pastel-darkPill dark:text-white flex items-center justify-between hover:scale-[1.01] active:scale-98 transition shadow-sm block"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#111318] text-white dark:bg-white dark:text-[#111318] flex items-center justify-center font-bold">
                <Activity className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm">Full Premier League Market</div>
                <div className="text-[11px] text-gray-600 dark:text-gray-400">ตลาดราคาผู้เล่นทุกคนในลีก</div>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center">
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </main>

      <TelegramSettingsModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />
    </div>
  );
}
