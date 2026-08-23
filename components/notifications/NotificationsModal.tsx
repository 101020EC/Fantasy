'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Loader2, Rocket, Leaf, Stethoscope, Hourglass, Star } from 'lucide-react';
import Modal from '../ui/Modal';

interface Sent {
  id: string;
  sentAt: string;
  kind: 'alert' | 'test';
  date: string;
  summary: {
    risers: number;
    fallers: number;
    watchlist: number;
    injuries: number;
    deadlineIn: number | null;
  };
  text: string;
}

/** Bangkok, matching the date the entries are grouped under. */
const timeOf = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

const bkkToday = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(
    new Date(Date.now() + offsetDays * 86_400_000)
  );

const dayLabel = (date: string) => {
  if (date === bkkToday()) return 'Today';
  if (date === bkkToday(-1)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T12:00:00Z`));
};

export default function NotificationsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Sent[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setItems(d?.notifications ?? []);
        setConfigured(d?.configured ?? false);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  // Preserve the server's newest-first order while grouping.
  const days: { date: string; entries: Sent[] }[] = [];
  for (const item of items) {
    const last = days[days.length - 1];
    if (last && last.date === item.date) last.entries.push(item);
    else days.push({ date: item.date, entries: [item] });
  }

  const chips = (s: Sent['summary']) =>
    [
      s.risers > 0 && {
        Icon: Rocket,
        text: `${s.risers} rising`,
        cls: 'bg-emerald-100 text-emerald-800',
      },
      s.fallers > 0 && {
        Icon: Leaf,
        text: `${s.fallers} falling`,
        cls: 'bg-rose-100 text-rose-800',
      },
      s.watchlist > 0 && {
        Icon: Star,
        text: `${s.watchlist} watchlist`,
        cls: 'bg-pink-100 text-pink-700',
      },
      s.injuries > 0 && {
        Icon: Stethoscope,
        text: `${s.injuries} fitness`,
        cls: 'bg-amber-100 text-amber-800',
      },
      s.deadlineIn !== null && {
        Icon: Hourglass,
        text: `deadline in ${s.deadlineIn}h`,
        cls: 'bg-purple-100 text-purple-800',
      },
    ].filter(Boolean) as {
      Icon: React.ComponentType<{ className?: string }>;
      text: string;
      cls: string;
    }[];

  return (
    <Modal isOpen onClose={onClose} labelledBy="notifications-title" className="max-w-lg">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-purple-100 text-[#38003c] flex items-center justify-center">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <h2 id="notifications-title" className="text-xl font-black text-[#111318]">
            Notifications
          </h2>
          <p className="text-xs text-gray-500">What has been sent to your Telegram</p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-bold text-gray-500 mb-1">Nothing sent yet</p>
          <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
            {configured
              ? 'The nightly alert runs at 06:00 Bangkok and only sends when there is something to report. A test from the alert settings shows up here too.'
              : 'Firebase is not configured on the server, so sent messages are not being recorded.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {days.map((day) => (
            <div key={day.date}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 shrink-0">
                  {dayLabel(day.date)}
                </span>
                <span className="flex-1 h-px bg-black/5" />
                <span className="text-[10px] text-gray-300 font-mono shrink-0">{day.date}</span>
              </div>

              <div className="space-y-2">
                {day.entries.map((n) => (
                  <details
                    key={n.id}
                    className="rounded-2xl bg-gray-50 border border-black/5 overflow-hidden"
                  >
                    <summary className="p-3 cursor-pointer list-none">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-black text-[#111318]">
                          {n.kind === 'test' ? 'Test message' : 'Price alert'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono tabular-nums shrink-0">
                          {timeOf(n.sentAt)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {chips(n.summary).length === 0 ? (
                          <span className="text-[10px] text-gray-400">Tap to read</span>
                        ) : (
                          chips(n.summary).map(({ Icon, text, cls }) => (
                            <span
                              key={text}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${cls}`}
                            >
                              <Icon className="w-2.5 h-2.5" />
                              {text}
                            </span>
                          ))
                        )}
                      </div>
                    </summary>
                    <pre className="px-3 pb-3 text-[11px] text-gray-600 whitespace-pre-wrap font-sans leading-relaxed border-t border-black/5 pt-2">
                      {n.text}
                    </pre>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
