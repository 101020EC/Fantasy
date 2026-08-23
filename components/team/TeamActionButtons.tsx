'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Send, ArrowRightLeft } from 'lucide-react';
import TelegramSettingsModal from '../telegram/TelegramSettingsModal';

export default function TeamActionButtons() {
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <Link
          href="/?switch=true"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-purple-600 dark:hover:text-fpl-green shadow-sm transition"
          title="เปลี่ยนไปดูทีมอื่น"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>เปลี่ยนทีม</span>
        </Link>

        <button
          onClick={() => setIsTelegramOpen(true)}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-500/20 border border-sky-200 dark:border-sky-500/40 text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/30 shadow-sm transition"
          title="ตั้งค่าแจ้งเตือนเข้า Telegram"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">แจ้งเตือน</span> Telegram
        </button>
      </div>

      <TelegramSettingsModal
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
      />
    </>
  );
}
