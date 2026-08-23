'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Send } from 'lucide-react';
import TelegramSettingsModal from '../telegram/TelegramSettingsModal';

export default function TeamActionButtons() {
  const [isTelegramOpen, setIsTelegramOpen] = useState(false);

  return (
    <>
      {/* Left: Change Team (Icon-only logo) */}
      <Link
        href="/?switch=true"
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-black/5 text-[#38003c] hover:bg-purple-50 shadow-sm flex items-center justify-center transition active:scale-95 shrink-0"
        title="เปลี่ยนทีม (Change Team)"
      >
        <ArrowRightLeft className="w-4 h-4 stroke-[2.5]" />
      </Link>

      {/* Center: Telegram Button */}
      <button
        onClick={() => setIsTelegramOpen(true)}
        type="button"
        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-sky-100 border border-sky-200 text-xs font-black text-sky-800 hover:bg-sky-200 shadow-sm transition active:scale-95 shrink-0"
        title="ตั้งค่าแจ้งเตือน Telegram"
      >
        <Send className="w-3.5 h-3.5 text-sky-600" />
        <span>Telegram</span>
      </button>

      <TelegramSettingsModal
        isOpen={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
      />
    </>
  );
}
