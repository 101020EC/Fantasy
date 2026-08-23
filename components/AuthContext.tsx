'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

// Default passcode if not configured in environment
const DEFAULT_PASSWORD = 'fpl';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  savedTeamId: string;
  setSavedTeamId: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [savedTeamId, setSavedTeamIdState] = useState<string>('');

  useEffect(() => {
    try {
      // Check auth status in localStorage
      const auth = localStorage.getItem('fpl_authenticated');
      if (auth === 'true') {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }

      // Load persistent team ID
      const teamId = localStorage.getItem('fpl_persistent_team_id');
      if (teamId) {
        setSavedTeamIdState(teamId);
      }
    } catch (e) {
      console.error(e);
      setIsAuthenticated(false);
    }
  }, []);

  const login = (password: string): boolean => {
    // Check password
    if (password.trim() === DEFAULT_PASSWORD || password.trim() === 'fantasy' || password.trim() === '1234') {
      try {
        localStorage.setItem('fpl_authenticated', 'true');
      } catch (e) {}
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    try {
      localStorage.removeItem('fpl_authenticated');
    } catch (e) {}
    setIsAuthenticated(false);
  };

  const setSavedTeamId = (id: string) => {
    setSavedTeamIdState(id);
    try {
      localStorage.setItem('fpl_persistent_team_id', id);
    } catch (e) {}
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: isAuthenticated ?? false,
        login,
        logout,
        savedTeamId,
        setSavedTeamId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
