'use client';

import React, { useEffect, useState } from 'react';
import { Send, Check, Bell, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import Modal from '../ui/Modal';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TelegramStatus {
  configured: boolean;
  chatId: string | null;
  teamId: string | null;
}

/**
 * Shows the server's Telegram wiring and sends a test alert through it.
 * The bot token is never handled here: it stayed in localStorage before, where
 * any injected script could read full control of the bot.
 */
export default function TelegramSettingsModal({ isOpen, onClose }: TelegramSettingsModalProps) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setTestResult(null);
    fetch('/api/telegram/test')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatus(d))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAlert = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST' });
      const data = await res.json();
      setTestResult(
        res.ok && data.success
          ? { success: true, message: 'Test alert sent to your Telegram.' }
          : { success: false, message: data.error || 'Could not send the test message.' }
      );
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection error' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} labelledBy="telegram-settings-title" className="max-w-md">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 id="telegram-settings-title" className="text-xl font-black text-[#111318]">Telegram Price Alerts</h2>
            <p className="text-xs text-gray-500">Nightly rise &amp; fall notifications for your squad</p>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Checking connection...</span>
          </div>
        ) : status?.configured ? (
          <>
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs mb-4 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-black">Connected</p>
                <p>Sending to chat ending {status.chatId}</p>
                {status.teamId && <p>Tracking team #{status.teamId}</p>}
              </div>
            </div>

            <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
              Your bot token stays on the server and is never sent to this page. To change the bot,
              chat, or tracked team, update <code className="px-1 rounded bg-gray-100 font-mono">TELEGRAM_BOT_TOKEN</code>,{' '}
              <code className="px-1 rounded bg-gray-100 font-mono">TELEGRAM_CHAT_ID</code> or{' '}
              <code className="px-1 rounded bg-gray-100 font-mono">TELEGRAM_TEAM_ID</code> in your environment.
            </p>
          </>
        ) : (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs mb-4 space-y-2">
            <p className="font-black flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>Not set up yet — 3 steps</span>
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-[11px]">
              <li>
                Message <code className="px-1 rounded bg-white/80 font-mono">@BotFather</code> on Telegram to create a
                bot and copy its token.
              </li>
              <li>
                Press <b>/start</b> with your bot, then message{' '}
                <code className="px-1 rounded bg-white/80 font-mono">@userinfobot</code> to get your chat ID.
              </li>
              <li>
                Set <code className="px-1 rounded bg-white/80 font-mono">TELEGRAM_BOT_TOKEN</code>,{' '}
                <code className="px-1 rounded bg-white/80 font-mono">TELEGRAM_CHAT_ID</code> and{' '}
                <code className="px-1 rounded bg-white/80 font-mono">TELEGRAM_TEAM_ID</code> in your environment, then
                restart.
              </li>
            </ol>
          </div>
        )}

        {testResult && (
          <div
            className={`p-3 rounded-2xl text-xs font-bold flex items-start gap-2 mb-4 ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {testResult.success ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleTestAlert}
          disabled={isTesting || !status?.configured}
          className="w-full py-3 bg-[#38003c] text-white font-black text-xs rounded-full shadow-md hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isTesting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Send Test Alert</span>
            </>
          )}
        </button>
    </Modal>
  );
}
