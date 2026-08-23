import { NextResponse } from 'next/server';
import { escapeMarkdown, sendTelegramMessage, getTelegramConfig } from '@/lib/telegram';
import { requireSession } from '@/lib/auth-server';
import { recordNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/** Reports whether the server can send alerts, without revealing the token. */
export async function GET() {
  const { configured, chatId, teamId } = await getTelegramConfig();
  return NextResponse.json({
    configured,
    chatId: chatId ? `…${chatId.slice(-4)}` : null,
    teamId: teamId || null,
  });
}

/**
 * Sends a test alert using the server's own bot. The token is never accepted
 * from the client — that turned this route into an open relay to Telegram.
 */
export async function POST() {
  if (!(await requireSession())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { botToken, chatId, teamId, configured } = await getTelegramConfig();
  if (!configured) {
    return NextResponse.json(
      {
        success: false,
        error: 'Telegram is not configured on the server (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)',
      },
      { status: 503 }
    );
  }

  const message =
    `🎉 *Fanta Telegram Alert Connected\\!*\n\n` +
    `✅ Your Telegram bot is connected successfully\\.\n` +
    `👤 Tracking Team ID: *${escapeMarkdown(teamId || 'not set')}*\n\n` +
    `_You will receive notifications if players in your squad are predicted to rise or fall in price\\!_ 🚀🔻`;

  const result = await sendTelegramMessage(botToken, chatId, message);
  if (result.ok) {
    await recordNotification({
      kind: 'test',
      summary: { risers: 0, fallers: 0, watchlist: 0, injuries: 0, deadlineIn: null },
      text: message,
    });
  }
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.description }, { status: 502 });
  }

  return NextResponse.json({ success: true, message: 'Test message sent successfully' });
}
