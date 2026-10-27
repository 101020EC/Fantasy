'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Search, Send } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import TelegramSettingsModal from '@/components/telegram/TelegramSettingsModal';
import { SECONDARY } from '@/components/nav-items';

/**
 * Everything that is not one of the four main tabs (M4). A page rather than a
 * sheet, so the browser's back button returns here and the More tab can stay
 * highlighted on the pages it leads to.
 */
export default function MorePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [teamId, setTeamId] = useState('');
  const [alertsOpen, setAlertsOpen] = useState(false);

  const row =
    'w-full flex items-center gap-3 px-4 py-3.5 text-sm text-[var(--text)] active:bg-[var(--bg)] hover:bg-[var(--bg)] transition text-left';

  return (
    <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">More</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const id = teamId.trim();
          // A team you just typed in is one you want to look at now.
          if (id) router.push(`/team/${id}/live`);
        }}
        className="space-y-2"
      >
        <label htmlFor="more-team" className="block text-xs font-medium text-[var(--muted)]">
          Look up a team
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="more-team"
              type="number"
              inputMode="numeric"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="Team ID"
              className="w-full pl-9 pr-3 py-2.5 text-base bg-white border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button
            type="submit"
            className="px-4 bg-[var(--accent)] text-white text-sm font-medium rounded-lg disabled:opacity-40"
            disabled={!teamId.trim()}
          >
            Go
          </button>
        </div>
      </form>

      <ul className="pastel-card divide-y divide-[var(--line)] overflow-hidden">
        {SECONDARY.map(({ key, label, href, Icon }) => (
          <li key={key}>
            <Link href={href} className={row}>
              <Icon className="w-5 h-5 text-[var(--muted)]" strokeWidth={1.75} />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </Link>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => setAlertsOpen(true)} className={row}>
            <Send className="w-5 h-5 text-[var(--muted)]" strokeWidth={1.75} />
            <span className="flex-1">Alerts</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        </li>
      </ul>

      <div className="pastel-card overflow-hidden">
        <button type="button" onClick={() => logout()} className={`${row} text-[var(--down)]`}>
          <LogOut className="w-5 h-5" strokeWidth={1.75} />
          <span className="flex-1">Log out</span>
        </button>
      </div>

      <TelegramSettingsModal isOpen={alertsOpen} onClose={() => setAlertsOpen(false)} />
    </main>
  );
}
