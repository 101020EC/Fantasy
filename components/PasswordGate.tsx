'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Lock, KeyRound, ArrowRight, Shield, Sparkles, AlertCircle } from 'lucide-react';

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(password);
    if (!success) {
      setError(true);
    } else {
      setError(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0118] text-white">
        <div className="animate-spin w-8 h-8 border-4 border-fpl-green border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-b from-[#1a0026] via-[#0d0118] to-[#0d0118] text-white">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl glass-panel-glow border border-purple-800/80 shadow-2xl text-center">
          {/* Logo & Lock Icon */}
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="w-full h-full rounded-2xl bg-gradient-to-br from-fpl-green via-fpl-cyan to-fpl-pink p-0.5 shadow-lg">
              <div className="w-full h-full bg-purple-950 rounded-[14px] flex items-center justify-center">
                <Lock className="w-8 h-8 text-fpl-green animate-pulse" />
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-900/60 border border-purple-700/60 text-fpl-cyan text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-fpl-green" />
            <span>FPL RADAR PRO ACCESS</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
            กรุณาใส่รหัสผ่านเพื่อเข้าใช้งาน
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 mb-6">
            เว็บแอปพลิเคชันนี้มีการป้องกันด้วยรหัสผ่าน
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="กรอกรหัสผ่าน (Password)..."
                autoFocus
                required
                className="w-full pl-11 pr-4 py-3.5 bg-purple-950/80 border border-purple-700/80 rounded-2xl text-white font-bold placeholder-gray-400 focus:outline-none focus:border-fpl-green focus:ring-2 focus:ring-fpl-green/50 text-base transition shadow-inner"
              />
              <KeyRound className="w-5 h-5 text-gray-400 absolute left-4 top-4" />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-bold flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-fpl-green to-emerald-400 hover:from-emerald-400 hover:to-fpl-green text-fpl-purple font-black text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition"
            >
              <span>เข้าสู่ระบบ</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-purple-900/60 text-xs text-gray-400">
            <p>รหัสผ่านเริ่มต้นสำหรับทดสอบ: <code className="text-fpl-cyan font-bold bg-purple-900/60 px-2 py-0.5 rounded">fpl</code></p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
