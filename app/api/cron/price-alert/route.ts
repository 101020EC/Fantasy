import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { escapeMarkdown, sendTelegramMessage, getTelegramConfig, nextDeadline } from '@/lib/telegram';
import { recordNotification, pruneNotifications } from '@/lib/notifications';
import { loadSquadContext, buildSummary } from '@/lib/deadline-messages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Sends the deadline summary now, however far off the deadline is.
 *
 * No longer scheduled: this was the 21:00 Bangkok nightly alert until the
 * alerts moved to the deadline only (docs/plan-alerts-deadline.md). The hourly
 * job sends the summary 24h out by itself; this route stays as a manual
 * trigger and does NOT mark the slot as sent, so the scheduled one still goes.
 *
 * Needs `Authorization: Bearer $CRON_SECRET`. Credentials come from the
 * environment only — accepting them from the query string would make this an
 * open relay.
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

    const { botToken, chatId, teamId: envTeamId, alerts, configured } = await getTelegramConfig();
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

    const bootstrap = await fetchFPLBootstrap();
    const deadline = nextDeadline(bootstrap.events, Infinity);
    if (!deadline) {
      return NextResponse.json({ alertSent: false, message: 'No upcoming deadline.' });
    }

    const ctx = await loadSquadContext(teamId, bootstrap, deadline.event);
    const { text: body, summary } = await buildSummary(ctx, alerts, deadline);
    const text = `📋 *Fanta: GW${escapeMarkdown(deadline.event)} deadline summary*\n\n${body}`;

    const result = await sendTelegramMessage(botToken, chatId, text);
    await recordNotification({
      kind: 'deadline-24h',
      outcome: result.ok ? 'sent' : 'failed',
      error: result.ok ? result.description ?? null : result.description ?? 'Telegram rejected the message',
      summary,
      text,
    });
    await pruneNotifications();

    if (!result.ok) {
      return NextResponse.json(
        { alertSent: false, error: `Telegram rejected the message: ${result.description}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ alertSent: true, event: deadline.event, ...summary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error executing cron job' }, { status: 500 });
  }
}
