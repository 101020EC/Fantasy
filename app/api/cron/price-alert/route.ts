import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap, fetchFPLEntry, fetchFPLPicks, buildSquadPlayers } from '@/lib/fpl-api';
import {
  escapeMarkdown,
  sendTelegramMessage,
  getTelegramConfig,
  nextDeadline,
  formatBangkok,
} from '@/lib/telegram';
import { getAdminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { recordNotification, pruneNotifications } from '@/lib/notifications';
import { analyzePlayerPrice } from '@/lib/price-calculator';
import { seasonKey } from '@/lib/analyst';
import { loadPriceContext, listSnapshotDates, readSnapshot } from '@/lib/price-changes-store';
import { diffAgainstLive, PriceChangeDay } from '@/lib/price-changes';

export const dynamic = 'force-dynamic';

const EMPTY_SUMMARY = {
  risers: 0,
  fallers: 0,
  watchlist: 0,
  injuries: 0,
  priceChanges: 0,
  deadlineIn: null,
};

/** How many named movers the message lists before it summarises the rest. */
const MAX_NAMED_CHANGES = 12;

/**
 * Prices that moved between the newest stored snapshot and live FPL.
 *
 * Returns null when there is no snapshot to compare against, which is a real
 * state on a fresh database and must read as "unknown", never as "nothing
 * changed".
 */
async function recentPriceChanges(
  elements: { id: number; now_cost: number }[]
): Promise<PriceChangeDay | null> {
  if (!isAdminConfigured) return null;
  try {
    const dates = await listSnapshotDates();
    if (!dates.length) return null;
    const latest = await readSnapshot(dates[dates.length - 1]);
    if (!latest) return null;
    return diffAgainstLive(latest, elements);
  } catch {
    // The prediction half of this alert is still worth sending without it.
    return null;
  }
}

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

    const { botToken, chatId, teamId: envTeamId, alerts, configured } = await getTelegramConfig();
    if (!configured) {
      // Recorded, not just returned. An unconfigured bot and a quiet night used
      // to look identical from outside — no message, no trace, no way to tell
      // which had happened without reading Vercel logs.
      await recordNotification({
        kind: 'alert',
        outcome: 'skipped',
        error: 'Telegram is not configured — no bot token or chat id.',
        summary: EMPTY_SUMMARY,
        text: '',
      });
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
    const priceContext = await loadPriceContext(seasonKey(bootstrap)).catch(() => ({}));
    const squadPlayers = buildSquadPlayers(
      picksData.picks,
      bootstrap,
      [],
      currentEvent.id,
      priceContext
    );
    const squadIds = new Set(squadPlayers.map((p) => p.element.id));

    // 2. Watchlist. Kept in Firestore precisely so this job can read it —
    //    there is no browser here to hold a local list.
    let watchedPlayers: { name: string; short: string; analysis: ReturnType<typeof analyzePlayerPrice> }[] = [];
    const watchIdSet = new Set<number>();
    if (isAdminConfigured && alerts.watchlist) {
      const snap = await getAdminDb().collection('watchlists').doc(String(teamId)).get();
      const watchIds: number[] = snap.data()?.elementIds ?? [];
      watchIds.forEach((id) => watchIdSet.add(id));
      const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));

      watchedPlayers = watchIds
        // A player already in the squad is reported under the squad heading;
        // listing them twice in one message is noise.
        .filter((id) => !squadIds.has(id))
        .map((id) => bootstrap.elements.find((el) => el.id === id))
        .filter((el): el is NonNullable<typeof el> => Boolean(el))
        .map((el) => ({
          name: el.web_name,
          short: teamMap.get(el.team)?.short_name ?? 'CLB',
          analysis: analyzePlayerPrice(el, bootstrap, priceContext),
        }));
    }

    // 3. Which players are about to move
    const risingStates = alerts.trends
      ? ['rising_soon', 'likely_riser']
      : ['rising_soon'];
    const fallingStates = alerts.trends
      ? ['falling_soon', 'likely_faller']
      : ['falling_soon'];

    const risers = alerts.priceMoves
      ? squadPlayers.filter((p) => risingStates.includes(p.priceAnalysis.status))
      : [];
    const fallers = alerts.priceMoves
      ? squadPlayers.filter((p) => fallingStates.includes(p.priceAnalysis.status))
      : [];

    // Players carrying a fitness flag, so a squad problem is not missed just
    // because nobody's price is moving.
    const injured = alerts.injuries
      ? squadPlayers.filter((p) => p.element.status !== 'a' && p.element.news)
      : [];

    // Prices that have ALREADY moved. Compared against the newest stored
    // snapshot rather than a precomputed diff: this job runs at 06:00 Bangkok
    // and the diff for the change it wants to report is not written until
    // 08:00, so a stored document here would always be a day and a half stale.
    const changed = alerts.priceChanged ? await recentPriceChanges(bootstrap.elements) : null;
    const squadChanges = changed
      ? changed.changes.filter((c) => squadIds.has(c.id) || watchIdSet.has(c.id))
      : [];

    const deadline = alerts.deadlineHours
      ? nextDeadline(bootstrap.events, alerts.deadlineHours)
      : null;
    const watchMovers = alerts.priceMoves
      ? watchedPlayers.filter(
          (p) =>
            risingStates.includes(p.analysis.status) || fallingStates.includes(p.analysis.status)
        )
      : [];

    if (
      risers.length === 0 &&
      fallers.length === 0 &&
      watchMovers.length === 0 &&
      injured.length === 0 &&
      squadChanges.length === 0 &&
      !changed?.changes.length &&
      !deadline
    ) {
      await recordNotification({
        kind: 'alert',
        outcome: 'skipped',
        error: 'Nothing met the alert thresholds.',
        summary: { ...EMPTY_SUMMARY },
        text: '',
      });
      return NextResponse.json({
        alertSent: false,
        message: 'No price change alerts tonight.',
        checkedPlayersCount: squadPlayers.length + watchedPlayers.length,
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

    if (changed && changed.changes.length > 0) {
      const elementMap = new Map(bootstrap.elements.map((el) => [el.id, el]));
      const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));
      const money = (tenths: number) => (tenths / 10).toFixed(1);

      text += `💰 *Prices changed:*\n`;
      squadChanges.slice(0, MAX_NAMED_CHANGES).forEach((c) => {
        const el = elementMap.get(c.id);
        const club = el ? teamMap.get(el.team)?.short_name ?? 'CLB' : 'CLB';
        const arrow = c.delta > 0 ? '🔺' : '🔻';
        text += `${arrow} *${escapeMarkdown(el?.web_name ?? c.id)}* \\(${escapeMarkdown(
          club
        )}\\) £${escapeMarkdown(money(c.from))} → £${escapeMarkdown(money(c.to))}\n`;
      });
      if (squadChanges.length > MAX_NAMED_CHANGES) {
        text += `_\\+${escapeMarkdown(squadChanges.length - MAX_NAMED_CHANGES)} more in your squad_\n`;
      }
      if (squadChanges.length === 0) {
        text += `_None in your squad or watchlist\\._\n`;
      }
      // One line for the whole market, so a quiet squad never implies a quiet
      // night. Forty players can move without one of them being yours.
      text += `_Market: ${escapeMarkdown(changed.risesCount)} up, ${escapeMarkdown(
        changed.fallsCount
      )} down_\n\n`;
    }

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
    if (watchMovers.length > 0) {
      text += `👁 *Watchlist:*\n`;
      watchMovers.forEach((p) => {
        const arrow = p.analysis.status === 'rising_soon' ? '🚀' : '🔻';
        const sign = p.analysis.netTransfers > 0 ? '+' : '';
        text += `${arrow} *${escapeMarkdown(p.name)}* \\(${escapeMarkdown(p.short)}\\) \\| Net: ${escapeMarkdown(
          sign + p.analysis.netTransfers.toLocaleString()
        )}\n`;
      });
      text += `\n`;
    }

    if (injured.length > 0) {
      text += `🏥 *Fitness concerns:*\n`;
      injured.forEach((p) => {
        const chance = p.element.chance_of_playing_next_round ?? 0;
        text += `• *${escapeMarkdown(p.element.web_name)}* \\(${escapeMarkdown(
          String(chance)
        )}%\\) — ${escapeMarkdown(p.element.news)}\n`;
      });
      text += `\n`;
    }

    if (deadline) {
      const hours = Math.round(deadline.hoursAway);
      text += `⏳ *Deadline GW${escapeMarkdown(deadline.event)}* in ${escapeMarkdown(
        String(hours)
      )}h — ${escapeMarkdown(formatBangkok(deadline.at))} Bangkok\n\n`;
    }

    // The tilde is escaped: MarkdownV2 reads a bare `~` as the strikethrough
    // delimiter, which swallowed the closing `_` and left the italic unclosed.
    // Telegram rejected every alert with "Can't find end of Italic entity".
    text += `⏰ _Prices update daily \\~01:30 \\- 02:30 UTC_`;

    // 4. Deliver, and report Telegram's verdict honestly
    const result = await sendTelegramMessage(botToken, chatId, text);

    // Recorded either way. A rejection used to return 502 and vanish, so a
    // month of "can't parse entities" would have been completely invisible.
    const summary = {
      risers: risers.length,
      fallers: fallers.length,
      watchlist: watchMovers.length,
      injuries: injured.length,
      priceChanges: squadChanges.length,
      deadlineIn: deadline ? Math.round(deadline.hoursAway) : null,
    };
    await recordNotification({
      kind: 'alert',
      outcome: result.ok ? 'sent' : 'failed',
      error: result.ok
        ? result.description ?? null
        : result.description ?? 'Telegram rejected the message',
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

    return NextResponse.json({
      alertSent: true,
      risersCount: risers.length,
      fallersCount: fallers.length,
      watchlistCount: watchMovers.length,
      injuredCount: injured.length,
      priceChangesCount: squadChanges.length,
      marketChanges: changed ? { rises: changed.risesCount, falls: changed.fallsCount } : null,
      deadlineIn: deadline ? Math.round(deadline.hoursAway) : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error executing cron job' }, { status: 500 });
  }
}
