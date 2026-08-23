import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { botToken, chatId, teamId } = await req.json();

    if (!botToken || !chatId) {
      return NextResponse.json(
        { success: false, error: 'Missing botToken or chatId' },
        { status: 400 }
      );
    }

    const message =
      `🎉 *Fanta Telegram Alert Connected!*\n\n` +
      `✅ Your Telegram bot is connected successfully.\n` +
      `👤 Tracking Team ID: *${teamId || 'Not specified'}*\n\n` +
      `_You will receive notifications if players in your squad are predicted to rise or fall in price!_ 🚀🔻`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.description || 'Failed to send message via Telegram API',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Test message sent successfully' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
