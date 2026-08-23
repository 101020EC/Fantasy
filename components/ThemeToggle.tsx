'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="relative p-2 rounded-xl bg-purple-950/40 dark:bg-purple-950/60 light:bg-gray-100 hover:bg-purple-900/40 dark:hover:bg-purple-900/60 border border-purple-800/40 dark:border-purple-800/60 text-gray-300 dark:text-gray-200 hover:text-fpl-green transition flex items-center justify-center shadow-sm"
      title={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง (Light Mode)' : 'เปลี่ยนเป็นโหมดมืด (Dark Mode)'}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-300 animate-spin-slow transition-transform" />
      ) : (
        <Moon className="w-4 h-4 text-purple-600 transition-transform" />
      )}
    </button>
  );
}
