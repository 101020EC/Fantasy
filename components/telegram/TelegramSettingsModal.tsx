'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Send, Check, Bell, AlertCircle, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { useAuth } from '../AuthContext';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Alerts {
  priceMoves: boolean;
  trends: boolean;
  injuries: boolean;
  watchlist: boolean;
  priceChanged: boolean;
  deadlineHours: number;
}

interface Status {
  configured: boolean;
  source: 'firestore' | 'env' | 'none';
  botTokenMask: string | null;
  chatId: string;
  teamId: string;
  alerts: Alerts;
  storable: boolean;
}

const ALERT_ROWS: { key: keyof Alerts; label: string; hint: string }[] = [
  { key: 'priceMoves', label: 'Price changes tonight', hint: 'Players at the edge of a rise or fall' },
  { key: 'trends', label: 'Early trends', hint: 'Sooner warning, less certain' },
  { key: 'injuries', label: 'Fitness news', hint: 'A squad player picking up a flag' },
  { key: 'watchlist', label: 'Include watchlist', hint: 'Not just your squad' },
  {
    key: 'priceChanged',
    label: 'Prices that already changed',
    hint: 'What FPL actually did overnight, not a prediction',
  },
];

export default function TelegramSettingsModal({ isOpen, onClose }: TelegramSettingsModalProps) {
  const { savedTeamId } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'save' | 'test' | 'clear' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [alerts, setAlerts] = useState<Alerts>({
    priceMoves: true,
    trends: false,
    injuries: true,
    watchlist: true,
    priceChanged: true,
    deadlineHours: 36,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telegram/settings');
      const data: Status = await res.json();
      setStatus(data);
      setChatId(data.chatId || '');
      // Prefer the team the app is on. When it differs from the stored one the
      // banner offers to move the alerts across, and Save has to actually do
      // that rather than write the old id straight back.
      setTeamId(savedTeamId || data.teamId || '');
      if (data.alerts) setAlerts(data.alerts);
      setBotToken('');
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [savedTeamId]);

  useEffect(() => {
    if (isOpen) {
      setResult(null);
      load();
    }
  }, [isOpen, load]);

  if (!isOpen) return null;

  // Alerts are for the team you are tracking. If the app has moved on to a
  // different team, the stored settings are pointed at the old one.
  const staleTeam = Boolean(status?.configured && savedTeamId && status.teamId !== savedTeamId);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('save');
    setResult(null);
    try {
      const res = await fetch('/api/telegram/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken, chatId, teamId, alerts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setResult({ ok: true, message: 'Settings saved.' });
      await load();
    } catch (err: any) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    setBusy('test');
    setResult(null);
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST' });
      const data = await res.json();
      setResult(
        res.ok && data.success
          ? { ok: true, message: 'Test alert sent to your Telegram.' }
          : { ok: false, message: data.error || 'Could not send the test message.' }
      );
    } catch (err: any) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(null);
    }
  };

  const clear = async () => {
    setBusy('clear');
    setResult(null);
    try {
      await fetch('/api/telegram/settings', { method: 'DELETE' });
      setResult({ ok: true, message: 'Settings cleared.' });
      await load();
    } finally {
      setBusy(null);
    }
  };

  // text-base on phones: iOS zooms into any input under 16px on focus.
  const field =
    'w-full px-4 py-2.5 bg-gray-50 border border-black/10 rounded-2xl text-base sm:text-xs font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500';

  return (
    <Modal isOpen onClose={onClose} labelledBy="telegram-settings-title" className="max-w-md">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
          <Send className="w-5 h-5" />
        </div>
        <div>
          <h2 id="telegram-settings-title" className="text-xl font-black text-[#111318]">
            Telegram Price Alerts
          </h2>
          <p className="text-xs text-gray-500">Nightly rise &amp; fall notifications</p>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading settings...</span>
        </div>
      ) : (
        <>
          {status?.configured && !staleTeam && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs mb-4 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black">Connected</p>
                <p>
                  Bot {status.botTokenMask} · chat {status.chatId} · team #{status.teamId}
                </p>
                {status.source === 'env' && (
                  <p className="mt-0.5 text-emerald-700">
                    From environment variables. Saving here stores them instead.
                  </p>
                )}
              </div>
            </div>
          )}

          {staleTeam && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black">Set up again for this team</p>
                <p>
                  Alerts are still pointed at team #{status?.teamId}, but you are now tracking #
                  {savedTeamId}. Save to move them across.
                </p>
              </div>
            </div>
          )}

          {!status?.storable && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                Firebase is not configured on the server, so settings cannot be saved from here.
              </span>
            </div>
          )}

          {!status?.configured && (
            <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-xs text-sky-900 mb-4 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-sky-600" />
                <span>Two steps</span>
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-sky-800">
                <li>
                  Message <code className="bg-white/80 px-1 rounded font-bold">@BotFather</code> to
                  create a bot and copy its token.
                </li>
                <li>
                  Press <b>/start</b> with your bot, then message{' '}
                  <code className="bg-white/80 px-1 rounded font-bold">@userinfobot</code> for your
                  chat ID.
                </li>
              </ol>
            </div>
          )}

          <form onSubmit={save} className="space-y-3">
            <div>
              <label className="block text-xs font-black text-gray-700 mb-1">Bot Token</label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={
                  status?.botTokenMask ? `Saved (${status.botTokenMask}) — leave blank to keep` : '123456789:AA...'
                }
                autoComplete="off"
                className={`${field} font-mono`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Chat ID</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="987654321"
                  required
                  className={`${field} font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">Team ID</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  placeholder="123456"
                  required
                  className={`${field} font-mono`}
                />
              </div>
            </div>

            <div className="pt-1 border-t border-black/5">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-2">
                What to send
              </span>
              <div className="space-y-1.5">
                {ALERT_ROWS.map((row) => (
                  <label
                    key={row.key}
                    className="flex items-start gap-2.5 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(alerts[row.key])}
                      onChange={(e) =>
                        setAlerts((a) => ({ ...a, [row.key]: e.target.checked }))
                      }
                      className="mt-0.5 w-4 h-4 shrink-0 accent-[#38003c] cursor-pointer"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-[#111318] group-hover:text-[#38003c] transition">
                        {row.label}
                      </span>
                      <span className="block text-[10px] text-gray-400">{row.hint}</span>
                    </span>
                  </label>
                ))}

                <label className="flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    checked={alerts.deadlineHours > 0}
                    onChange={(e) =>
                      setAlerts((a) => ({ ...a, deadlineHours: e.target.checked ? 36 : 0 }))
                    }
                    className="w-4 h-4 shrink-0 accent-[#38003c] cursor-pointer"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-[#111318]">Squad deadline</span>
                    <span className="block text-[10px] text-gray-400">
                      Mentioned once it is within 36 hours
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {result && (
              <div
                className={`p-3 rounded-2xl text-xs font-bold flex items-start gap-2 ${
                  result.ok
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {result.ok ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{result.message}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={busy !== null || !status?.storable}
                className="flex-1 py-3 bg-[#38003c] text-white font-black text-xs rounded-full shadow-md hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
              <button
                type="button"
                onClick={sendTest}
                disabled={busy !== null || !status?.configured}
                className="flex-1 py-3 bg-sky-100 hover:bg-sky-200 text-sky-800 font-black text-xs rounded-full transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {busy === 'test' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Test</span>
                  </>
                )}
              </button>
              {status?.source === 'firestore' && (
                <button
                  type="button"
                  onClick={clear}
                  disabled={busy !== null}
                  title="Remove stored settings"
                  aria-label="Remove stored settings"
                  className="px-3 py-3 bg-gray-100 hover:bg-rose-100 text-gray-500 hover:text-rose-600 rounded-full transition disabled:opacity-50"
                >
                  {busy === 'clear' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
