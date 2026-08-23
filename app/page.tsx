'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Search, TrendingUp, Sparkles, Activity, ArrowRight, HelpCircle, User, Send } from 'lucide-react';
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

  // Automatic redirect to saved team if user already has one and is not explicitly switching
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

  const handleCard1Click = () => {
    if (savedTeamId || teamId.trim()) {
      const target = teamId.trim() || savedTeamId;
      setLoading(true);
      router.push(`/team/${target}`);
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-[calc(100vh-70px)] flex flex-col justify-between w-full">
      <main className="w-full max-w-5xl mx-auto px-4 py-8 sm:py-12 text-center">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/60 border border-purple-300 dark:border-purple-700/60 text-purple-800 dark:text-fpl-cyan text-xs font-bold mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-fpl-green" />
          <span>FPL Team Viewer & Price Predictor 2024/25</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-gray-900 dark:text-white mb-3">
          จัดทัพ <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-700 dark:from-fpl-green via-teal-600 dark:via-fpl-cyan to-pink-600 dark:to-fpl-pink">Fantasy</span>
          <br className="hidden sm:inline" /> ดักราคาขึ้น-ลง
        </h1>

        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-6 leading-relaxed">
          กรอกเพียง <strong>FPL Team ID</strong> เพื่อดูแผนการเล่น 11 ตัวจริง, ตัวสำรอง, กัปตัน, คะแนนสด
          พร้อมระบบเรดาร์แจ้งเตือนนักเตะที่เสี่ยง <strong>ราคาตก</strong> หรือมีโอกาส <strong>ราคาขึ้น</strong> คืนนี้!
        </p>

        {/* Saved Team Banner if user is currently switching */}
        {savedTeamId && (
          <div className="max-w-xl mx-auto mb-4 p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 text-left">
              <User className="w-4 h-4 text-purple-600 dark:text-fpl-green" />
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block">ทีมที่คุณบันทึกไว้ในเครื่อง:</span>
                <span className="text-sm font-black text-gray-900 dark:text-white">Team ID #{savedTeamId}</span>
              </div>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                router.push(`/team/${savedTeamId}`);
              }}
              className="px-3 py-1.5 bg-purple-900 dark:bg-fpl-green text-white dark:text-fpl-purple font-black text-xs rounded-xl hover:scale-105 transition shadow"
            >
              เปิดดูทีมหลัก &rarr;
            </button>
          </div>
        )}

        {/* Team ID Search Box */}
        <div className="max-w-xl mx-auto">
          <form
            onSubmit={handleSearch}
            className="p-2 sm:p-2.5 rounded-2xl glass-panel-glow flex flex-col sm:flex-row items-center gap-2 shadow-lg"
          >
            <div className="relative w-full flex-1">
              <input
                ref={inputRef}
                type="number"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                placeholder="กรอก FPL Team ID (เช่น 1, 12345)"
                required
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800/80 rounded-xl text-gray-900 dark:text-white font-bold placeholder-gray-400 focus:outline-none focus:border-purple-600 dark:focus:border-fpl-green focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-fpl-green/50 text-base transition shadow-sm"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-900 dark:from-fpl-green to-purple-800 dark:to-emerald-400 text-white dark:text-fpl-purple font-black text-base rounded-xl flex items-center justify-center gap-2 shadow-md hover:opacity-95 active:scale-95 transition disabled:opacity-50"
            >
              {loading ? (
                <span>กำลังโหลด...</span>
              ) : (
                <>
                  <span>เปิดดูทีม</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo IDs */}
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span>ตัวอย่างทีม ID ทดลอง:</span>
            {['1', '100', '12345', '54321'].map((id) => (
              <button
                key={id}
                onClick={() => handleDemoTeam(id)}
                className="px-2.5 py-1 rounded-lg bg-purple-100/80 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 hover:border-purple-500 dark:hover:border-fpl-cyan text-purple-900 dark:text-gray-300 font-mono transition"
              >
                #{id}
              </button>
            ))}
          </div>

          {/* Recent Teams stored in local storage */}
          <RecentTeams />
        </div>

        {/* Feature Interactive Cards (Clickable on Mobile & Desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto mt-12 text-left">
          {/* Card 1: Pitch View */}
          <button
            type="button"
            onClick={handleCard1Click}
            className="p-5 rounded-2xl glass-panel border border-purple-200/80 dark:border-purple-800/60 hover:border-purple-500 dark:hover:border-fpl-green/60 active:scale-98 transition group text-left shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-fpl-green/20 text-purple-700 dark:text-fpl-green flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-gray-900 dark:text-white mb-1 flex items-center justify-between">
                <span>ผังสนามจัดทีม (Pitch View)</span>
                <ArrowRight className="w-4 h-4 text-purple-600 dark:text-fpl-green opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                แสดง 11 ตัวจริงตามฟอร์เมชันอัตโนมัติ พร้อมกัปตัน (C), รองกัปตัน (V), แต้มสะสม และลำดับตัวสำรอง 1-4
              </p>
            </div>
            <span className="text-[11px] font-bold text-purple-700 dark:text-fpl-green mt-3 block">
              {savedTeamId ? `เปิดดูทีมของคุณ (#${savedTeamId}) \u2192` : 'คลิกเพื่อกรอก Team ID \u2192'}
            </span>
          </button>

          {/* Card 2: Price Radar */}
          <Link
            href="/prices"
            className="p-5 rounded-2xl glass-panel border border-purple-200/80 dark:border-purple-800/60 hover:border-pink-500 dark:hover:border-fpl-pink/60 active:scale-98 transition group text-left shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-pink-100 dark:bg-fpl-pink/20 text-pink-700 dark:text-fpl-pink flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-gray-900 dark:text-white mb-1 flex items-center justify-between">
                <span>เรดาร์เตือนราคาขึ้น/ลง</span>
                <ArrowRight className="w-4 h-4 text-pink-600 dark:text-fpl-pink opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                คำนวณยอดซื้อเข้า-ขายออกสุทธิและ Transfer Velocity เพื่อแจ้งเตือนนักเตะในทีมที่จะปรับราคาในคืนนี้
              </p>
            </div>
            <span className="text-[11px] font-bold text-pink-600 dark:text-fpl-pink mt-3 block">
              เปิดกระดานเรดาร์ราคา &rarr;
            </span>
          </Link>

          {/* Card 3: Telegram Notification Setup */}
          <button
            type="button"
            onClick={() => setIsTelegramModalOpen(true)}
            className="p-5 rounded-2xl glass-panel border border-purple-200/80 dark:border-purple-800/60 hover:border-sky-500 dark:hover:border-sky-400/60 active:scale-98 transition group text-left shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Send className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-gray-900 dark:text-white mb-1 flex items-center justify-between">
                <span>แจ้งเตือนผ่าน Telegram</span>
                <ArrowRight className="w-4 h-4 text-sky-600 dark:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                เชื่อมต่อบอท Telegram ฟรี เพื่อส่งแจ้งเตือนเตือนราคานักเตะในทีมของคุณถึงมือถือแบบอัตโนมัติ
              </p>
            </div>
            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 mt-3 block">
              ตั้งค่า Telegram Alert &rarr;
            </span>
          </button>
        </div>

        {/* How to find Team ID Section */}
        <div className="mt-12 max-w-3xl mx-auto p-5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-left">
          <div className="flex items-center gap-2 text-purple-700 dark:text-fpl-cyan font-bold text-sm mb-3">
            <HelpCircle className="w-4 h-4" />
            <span>วิธีดู FPL Team ID ของคุณ</span>
          </div>
          <ol className="list-decimal list-inside text-xs text-gray-700 dark:text-gray-300 space-y-2 leading-relaxed">
            <li>เข้าไปที่เว็บไซต์ทางการ <strong>fantasy.premierleague.com</strong> บนเบราว์เซอร์</li>
            <li>ไปที่แท็บเมนู <strong>&apos;Pick Team&apos;</strong> หรือ <strong>&apos;Points&apos;</strong></li>
            <li>คลิกที่ลิงก์ <strong>&apos;View Gameweek history&apos;</strong></li>
            <li>
              ดูที่ URL ในแถบที่อยู่ด้านบน จะมีรูปแบบ:{' '}
              <code className="px-2 py-0.5 rounded bg-purple-200 dark:bg-purple-900 font-mono text-purple-900 dark:text-fpl-green text-[11px]">
                https://fantasy.premierleague.com/entry/<strong>[TEAM_ID]</strong>/history
              </code>
            </li>
            <li>นำตัวเลขตรง [TEAM_ID] มากรอกในช่องค้นหาด้านบนได้ทันที</li>
          </ol>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-purple-200 dark:border-purple-900/40 py-5 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>Fantasy Premier League Team Viewer & Price Alert &bull; Powered by Next.js & Vercel</p>
      </footer>

      {/* Telegram Modal */}
      <TelegramSettingsModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />
    </div>
  );
}
