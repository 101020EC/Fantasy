'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { PRIMARY, activeTab } from './nav-items';

/**
 * The phone navigation: Team · History · Market · Analyst · More, fixed to the
 * bottom below 768px. Larger screens use the header menu instead (M3).
 */
export default function TabBar({ teamHref }: { teamHref: string }) {
  const pathname = usePathname();
  const active = activeTab(pathname);

  const tabs = [
    ...PRIMARY.map((t) => ({ ...t, href: t.key === 'team' ? teamHref : t.href })),
    { key: 'more' as const, label: 'More', href: '/more', Icon: MoreHorizontal },
  ];

  return (
    <nav
      aria-label="Main"
      className="app-tabbar md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-[var(--line)]"
    >
      <ul className="grid grid-cols-5 h-[var(--tabbar-h)]">
        {tabs.map(({ key, label, href, Icon }) => {
          const on = active === key;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={on ? 'page' : undefined}
                className={`h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  on ? 'text-[var(--accent)]' : 'text-[var(--muted)] active:text-[var(--text)]'
                }`}
              >
                <Icon className="w-[22px] h-[22px]" strokeWidth={on ? 2.25 : 1.75} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
