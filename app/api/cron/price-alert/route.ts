import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap, fetchFPLEntry, fetchFPLPicks, buildSquadPlayers } from '@/lib/fpl-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');
    const botToken = searchParams.get('token') || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = searchParams.get('chatId') || process.env.TELEGRAM_CHAT_ID;

    if (!teamId || !botToken || !chatId) {
      return NextResponse.json(
        { error: 'Missing teamId, token, or chatId parameters' },
        { status: 400 }
      );
    }

    // 1. Fetch FPL data
    const bootstrap = await fetchFPLBootstrap();
    const entry = await fetchFPLEntry(teamId);
    const currentEvent =
      bootstrap.events.find((e) => e.is_current) ||
      bootstrap.events.find((e) => e.is_next) ||
      bootstrap.events[0];

    const picksData = await fetchFPLPicks(teamId, entry.current_event || currentEvent.id);
    const squadPlayers = buildSquadPlayers(picksData.picks, bootstrap, [], currentEvent.id);

    // 2. Analyze price alerts
    const risers = squadPlayers.filter((p) => p.priceAnalysis.status === 'rising_soon');
    const fallers = squadPlayers.filter((p) => p.priceAnalysis.status === 'falling_soon');

    if (risers.length === 0 && fallers.length === 0) {
      return NextResponse.json({
        message: 'No price change alerts for squad tonight.',
        checkedPlayersCount: squadPlayers.length,
      });
    }

    // 3. Format Telegram Message
    let text = `🚨 *Fanta: Price Alert Warning!*\n\n`;
    text += `👤 *Team:* ${entry.name} (#${entry.id})\n\n`;

    if (risers.length > 0) {
      text += `🚀 *Expected Price Rise (£+0.1m):*\n`;
      risers.forEach((p) => {
        text += `• *${p.element.web_name}* (${p.team.short_name}) | Net: +${p.priceAnalysis.netTransfers.toLocaleString()}\n`;
      });
      text += `\n`;
    }

    if (fallers.length > 0) {
      text += `🔻 *At Risk of Price Fall (£-0.1m):*\n`;
      fallers.forEach((p) => {
        text += `• *${p.element.web_name}* (${p.team.short_name}) | Net: ${p.priceAnalysis.netTransfers.toLocaleString()}\n`;
      });
      text += `\n`;
    }

    text += `⏰ _Prices update daily ~01:30 - 02:30 UTC_`;

    // 4. Send to Telegram
    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
      }),
    });

    const tgData = await telegramRes.json();

    return NextResponse.json({
      success: true,
      alertSent: true,
      risersCount: risers.length,
      fallersCount: fallers.length,
      telegramResponse: tgData,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error executing cron job' },
      { status: 500 }
    );
  }
}
