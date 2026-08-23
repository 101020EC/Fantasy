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

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  teamId: string;
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
  return { botToken, chatId, teamId, configured, source: configured ? 'env' : 'none' };
}

export async function saveTelegramConfig(settings: {
  botToken: string;
  chatId: string;
  teamId: string;
}) {
  await getAdminDb()
    .collection(SETTINGS_DOC.collection)
    .doc(SETTINGS_DOC.doc)
    .set({ ...settings, updatedAt: new Date().toISOString() });
}

export async function clearTelegramConfig() {
  await getAdminDb().collection(SETTINGS_DOC.collection).doc(SETTINGS_DOC.doc).delete();
}

/** Last four digits only — enough to recognise, useless if intercepted. */
export function maskToken(token: string): string | null {
  return token ? `…${token.slice(-4)}` : null;
}
