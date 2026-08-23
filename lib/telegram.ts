const TELEGRAM_API = 'https://api.telegram.org';

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

/** Server-held Telegram settings. Tokens never travel to the browser. */
export function getTelegramConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  const teamId = process.env.TELEGRAM_TEAM_ID || '';
  return { botToken, chatId, teamId, configured: Boolean(botToken && chatId) };
}
