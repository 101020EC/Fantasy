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
          {/* Logo */}
          <div className="w-20 h-20 mx-auto mb-4">
            <img src="/logo.png" alt="Fanta Logo" className="w-full h-full object-cover rounded-full shadow-md" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-[#38003c] text-xs font-black mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>FANTA PRO</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#111318] mb-2">
            Enter Access Password
          </h2>
          <p className="text-xs text-gray-500 mb-6">
            Fanta is a private Fantasy Premier League web application.
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
                placeholder="Enter password..."
                autoFocus
                required
                className="w-full pl-11 pr-4 py-3.5 bg-pastel-bg border border-black/10 rounded-full text-[#111318] font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 text-base transition"
              />
              <KeyRound className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
            </div>

            {error && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Incorrect password. Please try again.</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-[#38003c] text-white font-black text-sm rounded-full shadow-lg hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-black/5 text-xs text-gray-400">
            <p>Default Password: <code className="text-[#38003c] font-bold bg-gray-100 px-2 py-0.5 rounded-full">fpl</code></p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
