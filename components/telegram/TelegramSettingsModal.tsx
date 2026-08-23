'use client';

import React, { useState, useEffect } from 'react';
import { Send, Check, Bell, AlertCircle, Loader2, X, ExternalLink } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TelegramSettingsModal({ isOpen, onClose }: TelegramSettingsModalProps) {
  const { savedTeamId } = useAuth();
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBotToken(localStorage.getItem('fpl_tg_bot_token') || '');
      setChatId(localStorage.getItem('fpl_tg_chat_id') || '');
      setTeamId(localStorage.getItem('fpl_tg_team_id') || savedTeamId || '');
    }
  }, [isOpen, savedTeamId]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('fpl_tg_bot_token', botToken.trim());
    localStorage.setItem('fpl_tg_chat_id', chatId.trim());
    localStorage.setItem('fpl_tg_team_id', teamId.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleTestAlert = async () => {
    if (!botToken || !chatId) {
      setTestResult({ success: false, message: 'Please enter both Bot Token and Chat ID' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botToken.trim(),
          chatId: chatId.trim(),
          teamId: teamId.trim() || savedTeamId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: 'Test alert message sent to your Telegram successfully!',
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to send test message. Please verify your Bot Token & Chat ID.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border border-black/5 rounded-4xl p-6 sm:p-7 shadow-2xl text-[#111318] max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-[#111318] rounded-full bg-gray-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#111318]">Telegram Price Alerts</h2>
            <p className="text-xs text-gray-500">Get nightly FPL price rise/fall notifications</p>
          </div>
        </div>

        {/* Guide Box */}
        <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-xs text-sky-900 mb-4 space-y-1.5">
          <p className="font-bold flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-sky-600" />
            <span>Setup Instructions (3 Easy Steps):</span>
          </p>
          <ol className="list-decimal pl-4 space-y-1 text-[11px] text-sky-800">
            <li>Open Telegram & search for <code className="bg-white/80 px-1 rounded font-bold">@BotFather</code> to create a bot and get your <b>Bot Token</b>.</li>
            <li>Press <b>/start</b> with your bot, then search <code className="bg-white/80 px-1 rounded font-bold">@userinfobot</code> to find your <b>Chat ID</b>.</li>
            <li>Enter your details below and click <b>Test Alert</b>!</li>
          </ol>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className="block text-xs font-black text-gray-700 mb-1">
              Telegram Bot Token
            </label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
              required
              className="w-full px-4 py-2.5 bg-gray-50 border border-black/10 rounded-2xl text-xs font-mono font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 mb-1">
              Telegram Chat ID
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g. 987654321"
              required
              className="w-full px-4 py-2.5 bg-gray-50 border border-black/10 rounded-2xl text-xs font-mono font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 mb-1">
              FPL Team ID (for tracking squad)
            </label>
            <input
              type="number"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="e.g. 123456"
              className="w-full px-4 py-2.5 bg-gray-50 border border-black/10 rounded-2xl text-xs font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold flex items-start gap-2 ${
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

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={handleTestAlert}
              disabled={isTesting || !botToken || !chatId}
              className="flex-1 py-3 bg-sky-100 hover:bg-sky-200 text-sky-800 font-black text-xs rounded-full transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-sky-600" />
                  <span>Test Alert</span>
                </>
              )}
            </button>

            <button
              type="submit"
              className="flex-1 py-3 bg-[#38003c] text-white font-black text-xs rounded-full shadow-md hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
