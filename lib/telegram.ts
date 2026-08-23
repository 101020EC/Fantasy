import { getAdminDb, isAdminConfigured } from './firebase-admin';

const TELEGRAM_API = 'https://api.telegram.org';
const SETTINGS_DOC = { collection: 'settings', doc: 'telegram' } as const;

/**
 * Escapes text for Telegram MarkdownV2. Every one of these characters is
 * reserved; leaving one raw makes Telegram reject the entire message with
 * "can't parse entities", which silently loses the alert.
 */
export function escapeMarkdown(value: unknown): string {
  return String(value ?? '').replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

export interface TelegramResult {
  ok: boolean;
  description?: string;
}

/** Sends a message and reports Telegram's own verdict rather than assuming success. */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<TelegramResult> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    return { ok: false, description: data.description || `Telegram returned ${res.status}` };
  }
  return { ok: true };
}

/** Which kinds of alert the nightly job should send. */
export interface AlertToggles {
  /** Score at or beyond ±75 — a change expected in tonight's window. */
  priceMoves: boolean;
  /** ±35 and up: earlier warning, less certain. */
  trends: boolean;
  /** A squad player picking up an injury flag. */
  injuries: boolean;
  /** Include watchlist players, not just the squad. */
  watchlist: boolean;
  /** Hours before a squad deadline to start mentioning it. */
  deadlineHours: number;
}

export const DEFAULT_ALERTS: AlertToggles = {
  priceMoves: true,
  trends: false,
  injuries: true,
  watchlist: true,
  deadlineHours: 36,
};

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  teamId: string;
  alerts: AlertToggles;
  configured: boolean;
  /** Where the values came from, so the UI can explain what it is editing. */
  source: 'firestore' | 'env' | 'none';
}

/**
 * Settings live in Firestore so they can be changed from the app without a
 * redeploy, and so the nightly cron — which has no browser — can read them.
 * Environment variables remain as a fallback for a deploy that has not been
 * configured through the UI yet.
 *
 * One document, not one per team: the alert is for the team you are tracking,
 * and keeping a row per team would leave an old team still being alerted after
 * you switched away from it.
 */
export async function getTelegramConfig(): Promise<TelegramSettings> {
  if (isAdminConfigured) {
    try {
      const snap = await getAdminDb()
        .collection(SETTINGS_DOC.collection)
        .doc(SETTINGS_DOC.doc)
        .get();
      const d = snap.data();
      if (d?.botToken && d?.chatId) {
        return {
          botToken: String(d.botToken),
          chatId: String(d.chatId),
          teamId: String(d.teamId ?? ''),
          alerts: { ...DEFAULT_ALERTS, ...(d.alerts ?? {}) },
          configured: true,
          source: 'firestore',
        };
      }
    } catch (err) {
      console.warn('Could not read Telegram settings from Firestore:', err);
    }
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  const teamId = process.env.TELEGRAM_TEAM_ID || '';
  const configured = Boolean(botToken && chatId);
  return {
    botToken,
    chatId,
    teamId,
    alerts: DEFAULT_ALERTS,
    configured,
    source: configured ? 'env' : 'none',
  };
}

export async function saveTelegramConfig(settings: {
  botToken: string;
  chatId: string;
  teamId: string;
  alerts: AlertToggles;
}) {
  await getAdminDb()
    .collection(SETTINGS_DOC.collection)
    .doc(SETTINGS_DOC.doc)
    .set({ ...settings, updatedAt: new Date().toISOString() });
}

export async function clearTelegramConfig() {
  await getAdminDb().collection(SETTINGS_DOC.collection).doc(SETTINGS_DOC.doc).delete();
}

/**
 * Hours until the next squad deadline, or null when none is close enough to
 * mention. Deadlines move around — Saturday 00:30, 17:00 and 19:30 Bangkok all
 * occur — so a fixed daily job can only ever say "in N hours", not fire at a
 * chosen offset.
 */
export function nextDeadline(
  events: { id: number; deadline_time: string; finished: boolean }[],
  withinHours: number,
  now: Date = new Date()
): { event: number; hoursAway: number; at: Date } | null {
  const upcoming = events
    .map((e) => ({ event: e.id, at: new Date(e.deadline_time) }))
    .filter((e) => e.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0];

  if (!upcoming) return null;
  const hoursAway = (upcoming.at.getTime() - now.getTime()) / 3_600_000;
  return hoursAway <= withinHours ? { ...upcoming, hoursAway } : null;
}

/** Bangkok time, since that is where this is read. */
export function formatBangkok(at: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
}

/** Last four digits only — enough to recognise, useless if intercepted. */
export function maskToken(token: string): string | null {
  return token ? `…${token.slice(-4)}` : null;
}
