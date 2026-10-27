'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Menu, LogOut, Send, X, Bell } from 'lucide-react';
import { gwSegment } from '@/lib/gw-preference';
import { useAuth } from './AuthContext';
import TelegramSettingsModal from './telegram/TelegramSettingsModal';
import Logo from './Logo';
import TabBar from './TabBar';
import { PRIMARY, SECONDARY } from './nav-items';
import NotificationsModal from './notifications/NotificationsModal';

export default function Navbar() {
  const [quickTeamId, setQuickTeamId] = useState('');
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  /**
   * Warm every destination the menu can reach, on idle.
   *
   * Round 3 added a `loading.tsx` to each dynamic route and confirmed the server
   * returns a skeleton to an RSC prefetch — but nothing was ever asking for it.
   * The menu is conditionally rendered, so its links are absent from the DOM
   * until the hamburger opens, and Next prefetches on viewport intersection.
   * Rendering it hidden would not help either: `display: none` never intersects.
   *
   * Prefetching by hand sidesteps the observer entirely. Each call costs one
   * ~14KB skeleton, and it buys the whole round trip back from the click.
   */
  useEffect(() => {
    const warm = () => {
      for (const route of ['/prices', '/analyst', '/more', '/elite', '/status', '/backup', '/']) {
        try {
          router.prefetch(route);
        } catch {
          // Prefetching is an optimisation; never let it break navigation.
        }
      }
    };
    const idle = (window as any).requestIdleCallback;
    // Deliberately after the current page settles — prefetching four routes in
    // parallel with the render they are meant to speed up helps nothing.
    const handle = idle ? idle(warm, { timeout: 2000 }) : window.setTimeout(warm, 1200);
    return () => {
      const cancelIdle = (window as any).cancelIdleCallback;
      if (idle && cancelIdle) cancelIdle(handle);
      else window.clearTimeout(handle);
    };
  }, [router]);
  const pathname = usePathname();
  const { savedTeamId, logout } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickTeamId.trim()) {
      // A team you just typed in is one you want to look at now, not the week
      // you last previewed on a different team.
      router.push(`/team/${quickTeamId.trim()}/live`);
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

  // Straight to the gameweek segment, so the menu's own link is the cached,
  // prefetchable URL rather than one the middleware has to rewrite.
  const teamUrl = savedTeamId ? `/team/${savedTeamId}/${gwSegment()}` : '/?switch=true';

  return (
    <>
      <header className="app-header sticky top-0 z-40 w-full border-b border-[var(--line)] px-4 sm:px-8 pb-2.5">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Logo links to main screen: Team (or Home if no team saved) */}
          <Link href={teamUrl} className="flex items-center gap-2 shrink-0">
            <Logo className="w-8 h-8" />
            <span className="text-lg font-semibold tracking-tight text-[var(--text)]">Fanta</span>
          </Link>

          {/* Team ID search — larger screens; phones have it on /more. */}
          <form onSubmit={handleSearch} className="hidden md:flex items-center relative max-w-xs w-full">
            <input
              type="number"
              value={quickTeamId}
              onChange={(e) => setQuickTeamId(e.target.value)}
              placeholder="Search Team ID"
              className="w-full pl-9 pr-14 py-2 text-sm bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--text)] placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] transition"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5" />
            <button
              type="submit"
              className="absolute right-1 top-1 bottom-1 px-3 bg-[var(--accent)] text-white font-medium text-xs rounded-md hover:opacity-90 transition"
            >
              Go
            </button>
          </form>

          <div className="flex items-center gap-1 relative" ref={menuRef}>
            {/* Sits before the menu: it is a thing you check, not a setting you
                change, so it earns its own tap rather than a menu row. */}
            <button
              onClick={() => setIsNotifOpen(true)}
              type="button"
              title="Notifications"
              aria-label="Notifications"
              className="w-10 h-10 rounded-lg text-[var(--text)] hover:bg-[var(--bg)] flex items-center justify-center transition"
            >
              <Bell className="w-5 h-5" strokeWidth={1.75} />
            </button>

            {/* The menu is for larger screens only; phones have the tab bar. */}
            <button
              onMouseEnter={() => router.prefetch(teamUrl)}
              onClick={() => {
                router.prefetch(teamUrl);
                setIsMenuOpen(!isMenuOpen);
              }}
              className={`hidden md:flex w-10 h-10 rounded-lg items-center justify-center transition ${
                isMenuOpen ? 'bg-[var(--accent)] text-white' : 'text-[var(--text)] hover:bg-[var(--bg)]'
              }`}
              title="Menu"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
              type="button"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" strokeWidth={1.75} />}
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-12 w-56 bg-white border border-[var(--line)] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-1.5 z-50 animate-fadeIn">
                {[
                  ...PRIMARY.map((i) => (i.key === 'team' ? { ...i, href: teamUrl } : i)),
                  ...SECONDARY,
                ].map(({ key, label, href, Icon }) => {
                  const on =
                    key === 'team' ? pathname.startsWith('/team') : href === '/' ? pathname === '/' : pathname.startsWith(href);
                  return (
                    <Link
                      key={key}
                      href={href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                        on ? 'text-[var(--accent)] font-semibold bg-[var(--accent-soft)]' : 'text-[var(--text)] hover:bg-[var(--bg)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" strokeWidth={1.75} />
                      <span>{label}</span>
                    </Link>
                  );
                })}

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsTelegramOpen(true);
                  }}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text)] hover:bg-[var(--bg)] transition text-left"
                >
                  <Send className="w-4 h-4" strokeWidth={1.75} />
                  <span>Alerts</span>
                </button>

                <div className="my-1 border-t border-[var(--line)]" />

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    logout();
                  }}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--down)] hover:bg-rose-50 transition text-left"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.75} />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <TabBar teamHref={teamUrl} />

      <TelegramSettingsModal
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
      />

      <NotificationsModal isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </>
  );
}
