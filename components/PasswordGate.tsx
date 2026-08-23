'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Lock, KeyRound, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center bg-pastel-bg text-[#111318]">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-pastel-bg text-[#111318]">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-4xl bg-white border border-black/5 shadow-2xl text-center">
          {/* Logo & Lock Avatar */}
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-pastel-blue via-pastel-purple to-pastel-orange p-1 shadow-md">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                <Lock className="w-6 h-6 text-[#38003c] animate-pulse" />
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pastel-blueLight text-[#38003c] text-xs font-black mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>FANTA PRO</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#111318] mb-2">
            ใส่รหัสผ่านเพื่อเข้าใช้งาน
          </h2>
          <p className="text-xs text-gray-500 mb-6">
            เว็บแอปพลิเคชัน Fanta มีการป้องกันด้วยรหัสผ่าน
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="กรอกรหัสผ่าน..."
                autoFocus
                required
                className="w-full pl-11 pr-4 py-3.5 bg-pastel-bg border border-black/10 rounded-full text-[#111318] font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 text-base transition"
              />
              <KeyRound className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
            </div>

            {error && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-[#38003c] text-white font-black text-sm rounded-full shadow-lg hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2"
            >
              <span>เข้าสู่ระบบ</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-black/5 text-xs text-gray-400">
            <p>รหัสผ่านทดสอบ: <code className="text-[#38003c] font-bold bg-gray-100 px-2 py-0.5 rounded-full">fpl</code></p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
