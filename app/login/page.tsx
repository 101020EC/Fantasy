'use client';

import React, { useState, Suspense } from 'react';
import Logo from '@/components/Logo';
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
    <div className="w-full max-w-md p-6 sm:p-8 rounded-xl bg-white border border-[var(--line)] text-center">
      <Logo className="w-14 h-14 mx-auto mb-4" />

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-semibold mb-3">
        <Sparkles className="w-3.5 h-3.5" />
        <span>FANTA PRO</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text)] mb-2">
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
            className="w-full pl-11 pr-4 py-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-full text-[var(--text)] font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-base transition"
          />
          <KeyRound className="w-4 h-4 text-gray-400 absolute left-4 top-4" />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="w-full py-3.5 bg-[var(--accent)] text-white font-semibold text-sm rounded-full hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
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

      <p className="mt-6 pt-4 border-t border-[var(--line)] text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
        <Lock className="w-3 h-3" />
        <span>Verified on the server — the password never reaches your browser</span>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--text)]">
      <Suspense fallback={<div className="animate-spin w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
