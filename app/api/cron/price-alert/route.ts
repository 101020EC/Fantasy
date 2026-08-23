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
    let text = `🚨 *FPL Radar Pro: แจ้งเตือนราคานักเตะคืนนี้!*\n\n`;
    text += `👤 *ทีม:* ${entry.name} (#${entry.id})\n\n`;

    if (risers.length > 0) {
      text += `🚀 *เสี่ยงราคาขึ้น (£+0.1m):*\n`;
      risers.forEach((p) => {
        text += `• *${p.element.web_name}* (${p.team.short_name}) | ซื้อสุทธิ +${p.priceAnalysis.netTransfers.toLocaleString()}\n`;
      });
      text += `\n`;
    }

    if (fallers.length > 0) {
      text += `⚠️ *เสี่ยงราคาตก (£-0.1m):*\n`;
      fallers.forEach((p) => {
        text += `• *${p.element.web_name}* (${p.team.short_name}) | ขายสุทธิ ${p.priceAnalysis.netTransfers.toLocaleString()}\n`;
      });
      text += `\n`;
    }

    text += `⏰ _ราคาจะปรับช่วง ~07:30 - 08:30 น. ตามเวลาไทย_`;

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

    const result = await telegramRes.json();

    return NextResponse.json({ success: true, telegramResult: result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to send price alert cron' },
      { status: 500 }
    );
  }
}
