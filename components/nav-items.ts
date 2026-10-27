import { Shield, History, TrendingUp, Brain, Crown, Database, Activity, type LucideIcon } from 'lucide-react';

/**
 * Every destination, in one place, so the phone tab bar, the desktop menu and
 * the /more page cannot drift apart.
 *
 * Team has no fixed href: it goes to the saved team, which only the caller
 * knows (see `teamHref` in Navbar).
 */
export type TabKey = 'team' | 'history' | 'market' | 'analyst' | 'more';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  Icon: LucideIcon;
}

export const PRIMARY: (NavItem & { key: Exclude<TabKey, 'more'> })[] = [
  { key: 'team', label: 'Team', href: '/team', Icon: Shield },
  { key: 'history', label: 'History', href: '/', Icon: History },
  { key: 'market', label: 'Market', href: '/prices', Icon: TrendingUp },
  { key: 'analyst', label: 'Analyst', href: '/analyst', Icon: Brain },
];

/** What the More tab gathers. Alerts is a modal, not a route, so it is listed by the callers. */
export const SECONDARY: NavItem[] = [
  { key: 'elite', label: 'Elite', href: '/elite', Icon: Crown },
  { key: 'backup', label: 'Back Up', href: '/backup', Icon: Database },
  { key: 'status', label: 'Status', href: '/status', Icon: Activity },
];

/** Which tab a path belongs to, so the bar always shows where you are. */
export function activeTab(pathname: string): TabKey | null {
  if (pathname.startsWith('/team')) return 'team';
  if (pathname === '/') return 'history';
  if (pathname.startsWith('/prices')) return 'market';
  if (pathname.startsWith('/analyst')) return 'analyst';
  if (['/more', '/elite', '/backup', '/status'].some((p) => pathname.startsWith(p))) return 'more';
  return null;
}
