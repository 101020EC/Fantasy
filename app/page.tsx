'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Search, TrendingUp, Sparkles, Activity, AlertTriangle, ArrowRight, HelpCircle, CheckCircle2 } from 'lucide-react';
import RecentTeams from '@/components/team/RecentTeams';
import Link from 'next/link';

export default function HomePage() {
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamId.trim()) {
      setLoading(true);
      router.push(`/team/${teamId.trim()}`);
    }
  };

  const handleDemoTeam = (demoId: string) => {
    setLoading(true);
    router.push(`/team/${demoId}`);
  };

  return (
    <div className="min-h-[calc(100vh-70px)] flex flex-col justify-between">
      <main className="max-w-5xl mx-auto px-4 py-12 sm:py-16 text-center">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-900/60 border border-purple-700/60 text-fpl-cyan text-xs font-bold mb-6 shadow-inner animate-bounce">
          <Sparkles className="w-3.5 h-3.5 text-fpl-green" />
          <span>FPL Team Viewer & Price Predictor 2024/25</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white mb-4">
          จัดทัพ <span className="text-transparent bg-clip-text bg-gradient-to-r from-fpl-green via-fpl-cyan to-fpl-pink">Fantasy</span>
          <br className="hidden sm:inline" /> ดักราคาขึ้น-ลง
        </h1>

        <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          กรอกเพียง <strong>FPL Team ID</strong> เพื่อดูแผนการเล่น 11 ตัวจริง, ตัวสำรอง, กัปตัน, คะแนนสด
          พร้อมระบบเรดาร์แจ้งเตือนนักเตะที่เสี่ยง <strong>ราคาตก</strong> หรือมีโอกาส <strong>ราคาขึ้น</strong> คืนนี้!
        </p>

        {/* Team ID Search Box */}
        <div className="max-w-xl mx-auto">
          <form
            onSubmit={handleSearch}
            className="p-2 sm:p-2.5 rounded-2xl glass-panel-glow flex flex-col sm:flex-row items-center gap-2 shadow-2xl"
          >
            <div className="relative w-full flex-1">
              <input
                type="number"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                placeholder="กรอก FPL Team ID (เช่น 1, 12345)"
                required
                className="w-full pl-10 pr-4 py-3.5 bg-purple-950/70 border border-purple-800/80 rounded-xl text-white font-bold placeholder-gray-400 focus:outline-none focus:border-fpl-green focus:ring-2 focus:ring-fpl-green/50 text-base transition"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-4" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-fpl-green to-emerald-400 hover:from-emerald-400 hover:to-fpl-green text-fpl-purple font-black text-base rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition disabled:opacity-50"
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
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400 flex-wrap">
            <span>ตัวอย่างทีม ID ทดลอง:</span>
            {['1', '100', '12345', '54321'].map((id) => (
              <button
                key={id}
                onClick={() => handleDemoTeam(id)}
                className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-800/60 hover:border-fpl-cyan text-gray-300 hover:text-fpl-cyan font-mono transition"
              >
                #{id}
              </button>
            ))}
          </div>

          {/* Recent Teams stored in local storage */}
          <RecentTeams />
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-16 text-left">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl glass-panel border border-purple-800/60 hover:border-fpl-green/50 transition group">
            <div className="w-12 h-12 rounded-xl bg-fpl-green/20 text-fpl-green flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white mb-2">ผังสนามจัดทีม (Pitch View)</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              แสดง 11 ตัวจริงตามฟอร์เมชันอัตโนมัติ พร้อมกัปตัน (C), รองกัปตัน (V), แต้มสะสม และลำดับตัวสำรอง 1-4
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl glass-panel border border-purple-800/60 hover:border-fpl-pink/50 transition group">
            <div className="w-12 h-12 rounded-xl bg-fpl-pink/20 text-fpl-pink flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white mb-2">เรดาร์เตือนราคาขึ้น/ลง</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              คำนวณยอดซื้อเข้า-ขายออกสุทธิและ Transfer Velocity เพื่อแจ้งเตือนนักเตะในทีมที่จะปรับราคาในคืนนี้
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl glass-panel border border-purple-800/60 hover:border-fpl-cyan/50 transition group">
            <div className="w-12 h-12 rounded-xl bg-fpl-cyan/20 text-fpl-cyan flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white mb-2">ตลาดราคาเต็มทั้งลีก</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              ดูรายชื่อ Top Risers และ Top Fallers ทุกตำแหน่ง กรองหาตัวที่กำลังจะขึ้นก่อนราคาแพงขึ้นได้ทันท่วงที
            </p>
          </div>
        </div>

        {/* How to find Team ID Section */}
        <div className="mt-16 max-w-3xl mx-auto p-6 rounded-2xl bg-purple-950/40 border border-purple-800/60 text-left">
          <div className="flex items-center gap-2 text-fpl-cyan font-bold text-sm mb-3">
            <HelpCircle className="w-5 h-5" />
            <span>วิธีดู FPL Team ID ของคุณ</span>
          </div>
          <ol className="list-decimal list-inside text-xs text-gray-300 space-y-2 leading-relaxed">
            <li>เข้าไปที่เว็บไซต์ทางการ <strong>fantasy.premierleague.com</strong> บนเบราว์เซอร์</li>
            <li>ไปที่แท็บเมนู <strong>&apos;Pick Team&apos;</strong> หรือ <strong>&apos;Points&apos;</strong></li>
            <li>คลิกที่ลิงก์ <strong>&apos;View Gameweek history&apos;</strong></li>
            <li>
              ดูที่ URL ในแถบที่อยู่ด้านบน จะมีรูปแบบ:{' '}
              <code className="px-2 py-0.5 rounded bg-purple-900 font-mono text-fpl-green text-[11px]">
                https://fantasy.premierleague.com/entry/<strong>[TEAM_ID]</strong>/history
              </code>
            </li>
            <li>นำตัวเลขตรง [TEAM_ID] มากรอกในช่องค้นหาด้านบนได้ทันที</li>
          </ol>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-purple-900/40 py-6 text-center text-xs text-gray-400">
        <p>Fantasy Premier League Team Viewer & Price Alert &bull; Powered by Next.js & Vercel</p>
        <p className="mt-1 text-[11px] text-gray-400">
          Data provided via Official Premier League API. Not affiliated with the Premier League.
        </p>
      </footer>
    </div>
  );
}
