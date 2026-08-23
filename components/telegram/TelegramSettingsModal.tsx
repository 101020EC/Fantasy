'use client';

import React, { useState, useEffect } from 'react';
import { Send, Bell, CheckCircle2, AlertCircle, HelpCircle, X, ExternalLink, ShieldCheck, Copy } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TelegramSettingsModal({ isOpen, onClose }: TelegramSettingsModalProps) {
  const { savedTeamId } = useAuth();
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('fpl_tg_token') || '';
      const savedChat = localStorage.getItem('fpl_tg_chat_id') || '';
      setBotToken(savedToken);
      setChatId(savedChat);
    } catch (e) {}
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      localStorage.setItem('fpl_tg_token', botToken.trim());
      localStorage.setItem('fpl_tg_chat_id', chatId.trim());
      setTestResult({ success: true, message: 'บันทึกการตั้งค่า Telegram เรียบร้อยแล้ว!' });
    } catch (e) {}
  };

  const handleTestNotification = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      setTestResult({ success: false, message: 'กรุณากรอก Bot Token และ Chat ID ให้ครบถ้วน' });
      return;
    }

    setLoading(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botToken.trim(),
          chatId: chatId.trim(),
          teamId: savedTeamId || 'FPL',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        handleSave();
        setTestResult({
          success: true,
          message: 'ส่งข้อความทดสอบไปยัง Telegram สำเร็จ! กรุณาเช็คในแอป Telegram ของคุณ',
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'ไม่สามารถส่งข้อความได้ กรุณาตรวจ Token และ Chat ID',
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    } finally {
      setLoading(false);
    }
  };

  const cronUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/cron/price-alert?teamId=${savedTeamId || 'YOUR_TEAM_ID'}&token=${botToken}&chatId=${chatId}`
    : '';

  const copyCronUrl = () => {
    if (cronUrl) {
      navigator.clipboard.writeText(cronUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#150020] border border-purple-200 dark:border-purple-800 rounded-3xl p-6 shadow-2xl text-gray-900 dark:text-white max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full bg-gray-100 dark:bg-white/5 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-300 dark:border-sky-500/30">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white">ตั้งค่าแจ้งเตือนผ่าน Telegram</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">รับข้อความเตือนเมื่อนักเตะในทีมเสี่ยงราคาตก/ขึ้นคืนนี้</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-4 rounded-2xl bg-sky-50 dark:bg-purple-950/50 border border-sky-200 dark:border-purple-800/60 mb-5 text-xs text-gray-700 dark:text-gray-300 space-y-2">
          <div className="font-bold text-sky-900 dark:text-fpl-cyan flex items-center gap-1.5 mb-1">
            <HelpCircle className="w-4 h-4 text-sky-600 dark:text-fpl-cyan" />
            <span>ขั้นตอนการสร้าง Telegram Bot (ทำครั้งเดียว):</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>เปิดแอป Telegram ค้นหาบอท <strong>@BotFather</strong> แล้วพิมพ์ <code className="bg-sky-200 dark:bg-purple-900 px-1 py-0.5 rounded font-mono">/newbot</code></li>
            <li>ตั้งชื่อบอท จะได้รับ <strong>HTTP API Token</strong> (Bot Token)</li>
            <li>ค้นหาบอท <strong>@userinfobot</strong> แล้วกด Start จะได้รับตัวเลข <strong>Id</strong> (Chat ID) ของคุณ</li>
            <li>นำ Bot Token และ Chat ID มากรอกด้านล่าง แล้วกดทดสอบส่งข้อความ</li>
          </ol>
        </div>

        {/* Input Form */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              1. Telegram Bot Token:
            </label>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="เช่น 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 rounded-xl text-gray-900 dark:text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              2. Telegram Chat ID:
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="เช่น 987654321"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 rounded-xl text-gray-900 dark:text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Status result */}
        {testResult && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs font-bold flex items-center gap-2 ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={handleTestNotification}
            disabled={loading}
            className="flex-1 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-blue-600 hover:to-sky-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? 'กำลังส่ง...' : 'ทดสอบส่งข้อความ'}</span>
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-gray-200 dark:bg-purple-900 hover:bg-gray-300 dark:hover:bg-purple-800 text-gray-800 dark:text-white font-bold text-xs rounded-xl transition"
          >
            บันทึก
          </button>
        </div>

        {/* Automated Cron Alert URL */}
        {botToken && chatId && (
          <div className="p-3 bg-gray-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl text-xs">
            <span className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
              🔗 URL สำหรับตั้งเวลาอัตโนมัติ (Vercel Cron / Cron-job.org):
            </span>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
              สามารถนำ URL นี้ไปใส่ในเว็บตั้งเวลาฟรี เช่น <strong>cron-job.org</strong> ให้เรียกยิงตอน 07:00 น. ทุกวัน
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                readOnly
                value={cronUrl}
                className="w-full px-2 py-1.5 bg-white dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg text-[10px] font-mono text-gray-600 dark:text-gray-300"
              />
              <button
                onClick={copyCronUrl}
                className="px-2.5 py-1.5 bg-purple-900 dark:bg-fpl-green text-white dark:text-fpl-purple font-bold text-xs rounded-lg shrink-0 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'ก๊อปแล้ว!' : 'ก๊อปปี้'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
