import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap, fetchFPLEntry, fetchFPLPicks, buildSquadPlayers } from '@/lib/fpl-api';
import { escapeMarkdown, sendTelegramMessage, getTelegramConfig } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

/**
 * Nightly price-change alert. Scheduled by vercel.json, which sends
 * `Authorization: Bearer $CRON_SECRET`. Credentials come from the environment
 * only — accepting them from the query string would make this an open relay.
 */
export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
    }
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { botToken, chatId, teamId: envTeamId, configured } = getTelegramConfig();
    if (!configured) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not configured' },
        { status: 503 }
      );
    }

    const teamId = new URL(req.url).searchParams.get('teamId') || envTeamId;
    if (!teamId || isNaN(Number(teamId))) {
      return NextResponse.json(
        { error: 'No team to check — set TELEGRAM_TEAM_ID or pass ?teamId=' },
        { status: 400 }
      );
    }

    // 1. Fetch FPL data
    const [bootstrap, entry] = await Promise.all([fetchFPLBootstrap(), fetchFPLEntry(teamId)]);
    const currentEvent =
      bootstrap.events.find((e) => e.is_current) ||
      bootstrap.events.find((e) => e.is_next) ||
      bootstrap.events[0];

    const picksData = await fetchFPLPicks(teamId, entry.current_event || currentEvent.id);
    const squadPlayers = buildSquadPlayers(picksData.picks, bootstrap, [], currentEvent.id);

    // 2. Which players are about to move
    const risers = squadPlayers.filter((p) => p.priceAnalysis.status === 'rising_soon');
    const fallers = squadPlayers.filter((p) => p.priceAnalysis.status === 'falling_soon');

    if (risers.length === 0 && fallers.length === 0) {
      return NextResponse.json({
        alertSent: false,
        message: 'No price change alerts for squad tonight.',
        checkedPlayersCount: squadPlayers.length,
      });
    }

    // 3. Build the message. Every interpolated value is escaped: manager and
    //    player names routinely contain characters MarkdownV2 reserves.
    const line = (p: (typeof squadPlayers)[number], sign: string) =>
      `• *${escapeMarkdown(p.element.web_name)}* \\(${escapeMarkdown(p.team.short_name)}\\) \\| Net: ${escapeMarkdown(
        sign + p.priceAnalysis.netTransfers.toLocaleString()
      )}\n`;

    let text = `🚨 *Fanta: Price Alert Warning\\!*\n\n`;
    text += `👤 *Team:* ${escapeMarkdown(entry.name)} \\(\\#${escapeMarkdown(entry.id)}\\)\n\n`;

    if (risers.length > 0) {
      text += `🚀 *Expected Price Rise \\(£\\+0\\.1m\\):*\n`;
      risers.forEach((p) => (text += line(p, '+')));
      text += `\n`;
    }
    if (fallers.length > 0) {
      text += `🔻 *At Risk of Price Fall \\(£\\-0\\.1m\\):*\n`;
      fallers.forEach((p) => (text += line(p, '')));
      text += `\n`;
    }
    text += `⏰ _Prices update daily ~01:30 \\- 02:30 UTC_`;

    // 4. Deliver, and report Telegram's verdict honestly
    const result = await sendTelegramMessage(botToken, chatId, text);
    if (!result.ok) {
      return NextResponse.json(
        { alertSent: false, error: `Telegram rejected the message: ${result.description}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      alertSent: true,
      risersCount: risers.length,
      fallersCount: fallers.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error executing cron job' }, { status: 500 });
  }
}
