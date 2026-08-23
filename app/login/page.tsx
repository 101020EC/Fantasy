'use client';

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, KeyRound, ArrowRight, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError('Incorrect password. Please try again.');
        setPassword('');
        return;
      }

      const next = searchParams.get('next');
      router.replace(next && next.startsWith('/') ? next : '/');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 sm:p-8 rounded-4xl bg-white border border-black/5 shadow-2xl text-center">
      <div className="w-20 h-20 mx-auto mb-4">
        <Image src="/logo.png" alt="Fanta" width={80} height={80} priority className="w-full h-full object-cover rounded-full shadow-md" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-[#38003c] text-xs font-black mb-3">
        <Sparkles className="w-3.5 h-3.5" />
        <span>FANTA PRO</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#111318] mb-2">
        Enter Access Password
      </h1>
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
              if (error) setError(null);
            }}
            placeholder="Enter password..."
            autoFocus
            required
            autoComplete="current-password"
            className="w-full pl-11 pr-4 py-3.5 bg-pastel-bg border border-black/10 rounded-full text-[#111318] font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 text-base transition"
          />
          <KeyRound className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="w-full py-3.5 bg-[#38003c] text-white font-black text-sm rounded-full shadow-lg hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 pt-4 border-t border-black/5 text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
        <Lock className="w-3 h-3" />
        <span>Verified on the server — the password never reaches your browser</span>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-pastel-bg text-[#111318]">
      <Suspense fallback={<div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
