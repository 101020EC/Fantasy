'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  logout: () => Promise<void>;
  savedTeamId: string;
  setSavedTeamId: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TEAM_ID_KEY = 'fpl_persistent_team_id';

/**
 * Holds the team the user is tracking. Authentication itself lives in an
 * httpOnly session cookie enforced by middleware.ts — the browser cannot read
 * it, and nothing here can grant access.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [savedTeamId, setSavedTeamIdState] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    try {
      const teamId = localStorage.getItem(TEAM_ID_KEY);
      if (teamId) setSavedTeamIdState(teamId);
    } catch (e) {
      console.warn('Could not read the saved team id:', e);
    }
  }, []);

  // Stable identities: rebuilding these on every render re-fired consumer
  // effects, which fired the Firestore archive twice on each page view.
  const setSavedTeamId = useCallback((id: string) => {
    setSavedTeamIdState(id);
    try {
      localStorage.setItem(TEAM_ID_KEY, id);
    } catch (e) {
      console.warn('Could not persist the team id:', e);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout request failed:', e);
    }
    router.replace('/login');
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({ logout, savedTeamId, setSavedTeamId }),
    [logout, savedTeamId, setSavedTeamId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
