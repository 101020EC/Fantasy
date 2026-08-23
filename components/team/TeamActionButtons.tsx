'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Send } from 'lucide-react';
import TelegramSettingsModal from '../telegram/TelegramSettingsModal';

export default function TeamActionButtons() {
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <Link
          href="/?switch=true"
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-[#171a23] border border-black/5 dark:border-white/10 text-xs font-bold text-[#111318] dark:text-white hover:bg-pastel-bg shadow-sm transition"
          title="เปลี่ยนไปดูทีมอื่น"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>เปลี่ยนทีม</span>
        </Link>

        <button
          onClick={() => setIsTelegramOpen(true)}
          type="button"
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-sky-100 dark:bg-sky-500/20 border border-sky-200 dark:border-sky-500/30 text-xs font-bold text-sky-800 dark:text-sky-300 hover:bg-sky-200 shadow-sm transition"
          title="ตั้งค่าแจ้งเตือนเข้า Telegram"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Telegram</span>
        </button>
      </div>

      <TelegramSettingsModal
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
      />
    </>
  );
}
