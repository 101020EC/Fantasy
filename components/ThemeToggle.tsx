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
      className="w-9 h-9 rounded-full bg-white dark:bg-[#171a23] border border-black/5 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:text-amber-500 shadow-sm flex items-center justify-center transition hover:scale-105 active:scale-95"
      title={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง (Light Mode)' : 'เปลี่ยนเป็นโหมดมืด (Dark Mode)'}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-purple-600" />
      )}
    </button>
  );
}
