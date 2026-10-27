import { NextRequest, NextResponse } from 'next/server';
import type { FPLElement } from '@/lib/types';
import { fetchFPLBootstrap, fetchFPLEntry, fetchFPLPicks } from '@/lib/fpl-api';
import {
  escapeMarkdown,
  getTelegramConfig,
  sendTelegramMessage,
  nextDeadline,
} from '@/lib/telegram';
import { getAdminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { recordNotification, pruneNotifications, SentNotification } from '@/lib/notifications';
import {
  readHourlyState,
  writeHourlyState,
  readDeadlineState,
  writeDeadlineState,
} from '@/lib/hourly-state';
import { nextWatermark } from '@/lib/hourly-watermark';
import {
  dueSlots,
  markAttempt,
  markDelivered,
  statusDrops,
  STATUS_WORD,
  SLOT_HOURS,
} from '@/lib/deadline-alerts';
import { loadSquadContext, buildSummary, buildReminder } from '@/lib/deadline-messages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // firebase-admin cannot run on the Edge runtime

/**
 * The only Telegram clock Fanta has (see docs/plan-alerts-deadline.md).
 *
 * Every hour it does two things:
 * 1. Sends the deadline messages — the full summary on the first run inside
 *    24h of the deadline, the line-up reminder inside 2h — once each per
 *    gameweek. Deadlines move around, so no fixed cron could hit them.
 * 2. Messages at once when a SQUAD player's availability gets worse
 *    (available → doubtful → injured/suspended/unavailable). Price moves,
 *    reworded news and the watchlist wait for the summary; messaging them
 *    hourly turned into a message every morning.
 *
 * Quiet runs stay small: bootstrap (cached 300s), entry, picks, three
 * Firestore reads and one write. The heavier summary inputs are fetched only
 * on the two runs per gameweek that send one.
 *
 * Scheduled by an external clock (a Cloudflare Worker cron trigger) which sends
 * `Authorization: Bearer $CRON_SECRET`, exactly as Vercel's own cron does.
 */

const EMPTY_SUMMARY = {
  risers: 0,
  fallers: 0,
  watchlist: 0,
  injuries: 0,
  priceChanges: 0,
  deadlineIn: null,
};

/** Beyond this the message is a list, not an alert; the rest is summarised. */
const MAX_NAMED = 15;

interface Tracked {
  el: FPLElement;
  club: string;
  /** Whether the player is in the squad, as opposed to only on the watchlist. */
  owned: boolean;
}

/** Squad element ids for the current gameweek, or null if FPL will not say. */
async function squadIds(teamId: string): Promise<Set<number> | null> {
  try {
    const entry = await fetchFPLEntry(teamId);
    const picks = await fetchFPLPicks(teamId, entry.current_event);
    return new Set(picks.picks.map((p) => p.element));
  } catch {
    // The watchlist half is still worth reporting without the squad.
    return null;
  }
}

/** Watchlist element ids, or null if Firestore would not say. */
async function watchlistIds(teamId: string): Promise<Set<number> | null> {
  if (!isAdminConfigured) return new Set();
  try {
    const snap = await getAdminDb().collection('watchlists').doc(String(teamId)).get();
    return new Set<number>(snap.data()?.elementIds ?? []);
  } catch {
    return null;
  }
}

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
      return NextResponse.json({ error: 'Telegram is not configured' }, { status: 503 });
    }

    const teamId = new URL(req.url).searchParams.get('teamId') || envTeamId;
    if (!teamId || isNaN(Number(teamId))) {
      return NextResponse.json(
        { error: 'No team to check — set TELEGRAM_TEAM_ID or pass ?teamId=' },
        { status: 400 }
      );
    }

    const bootstrap = await fetchFPLBootstrap();
    const [ownedOrNull, watchedOrNull, state] = await Promise.all([
      squadIds(teamId),
      alerts.watchlist ? watchlistIds(teamId) : Promise.resolve(new Set<number>()),
      readHourlyState(),
    ]);
    // A failed lookup leaves that half unknown this hour, not empty: its players
    // keep their old watermark (see nextWatermark) and are compared next hour.
    const lookupFailed = ownedOrNull === null || watchedOrNull === null;
    const owned = ownedOrNull ?? new Set<number>();
    const watched = watchedOrNull ?? new Set<number>();

    const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));
    const tracked: Tracked[] = bootstrap.elements
      .filter((el) => owned.has(el.id) || watched.has(el.id))
      .map((el) => ({
        el,
        club: teamMap.get(el.team)?.short_name ?? 'CLB',
        owned: owned.has(el.id),
      }));

    // The watermark to store, built from what is tracked right now. Written
    // whether or not anything is sent, so a change is reported once and a
    // player who leaves the squad stops being carried forever.
    const seen = {
      price: {} as Record<string, number>,
      news: {} as Record<string, string>,
      flag: {} as Record<string, string>,
    };
    tracked.forEach(({ el }) => {
      seen.price[el.id] = el.now_cost;
      seen.news[el.id] = el.news ?? '';
      seen.flag[el.id] = el.status;
    });
    const next = nextWatermark(state, seen, lookupFailed);

    // The first ever run has nothing to compare against, so it seeds silently:
    // every tracked player differs from nothing. A squad player with no
    // previous value is likewise not a change (statusDrops skips them).
    const drops =
      state.seeded && alerts.statusDrops
        ? statusDrops(
            tracked.filter((t) => t.owned).map((t) => t.el),
            state.flag
          )
        : [];

    // Written before the send. If Telegram fails, the next hour reporting the
    // same change would be worse than losing it once: the failure is recorded
    // in `notifications` either way, and a repeating false alarm is not.
    await writeHourlyState(next);

    const results: Record<string, unknown> = { trackedCount: tracked.length, seeded: !state.seeded };
    let failed: string | null = null;

    const deliver = async (
      kind: SentNotification['kind'],
      text: string,
      summary: SentNotification['summary']
    ) => {
      const result = await sendTelegramMessage(botToken, chatId, text);
      await recordNotification({
        kind,
        outcome: result.ok ? 'sent' : 'failed',
        error: result.ok ? result.description ?? null : result.description ?? 'Telegram rejected the message',
        summary,
        text,
      });
      if (!result.ok) failed = `Telegram rejected the ${kind} message: ${result.description}`;
      return result.ok;
    };

    // ── 1. Squad availability got worse ──────────────────────────────────
    if (drops.length) {
      const byId = new Map(tracked.map((t) => [t.el.id, t]));
      let text = `🚦 *Fanta: squad availability*\n\n`;
      drops.slice(0, MAX_NAMED).forEach(({ el, from, to }) => {
        const t = byId.get(el.id)!;
        const chance = el.chance_of_playing_next_round;
        const pct = chance === null ? '' : ` \\(${escapeMarkdown(String(chance))}%\\)`;
        text += `• *${escapeMarkdown(el.web_name)}* \\(${escapeMarkdown(t.club)}\\) ${escapeMarkdown(
          STATUS_WORD[from] ?? from
        )} → *${escapeMarkdown(STATUS_WORD[to] ?? to)}*${pct}${
          el.news ? ` — ${escapeMarkdown(el.news)}` : ''
        }\n`;
      });
      results.statusDrops = drops.length;
      await deliver('status-drop', text.trimEnd(), {
        ...EMPTY_SUMMARY,
        injuries: drops.length,
      });
    }

    // ── 2. Deadline messages ─────────────────────────────────────────────
    const deadline = nextDeadline(bootstrap.events, SLOT_HOURS['24h']);
    if (deadline && (alerts.deadlineSummary || alerts.deadlineReminder)) {
      const dlState = await readDeadlineState();
      const slots = dlState
        ? dueSlots({
            hoursAway: deadline.hoursAway,
            state: dlState,
            event: deadline.event,
            summary: alerts.deadlineSummary,
            reminder: alerts.deadlineReminder,
          })
        : [];

      if (dlState && slots.length) {
        const ctx = await loadSquadContext(teamId, bootstrap, deadline.event);
        const newsNow: Record<string, string> = {};
        ctx.squadPlayers.forEach((p) => (newsNow[p.element.id] = p.element.news ?? ''));
        const priorNews =
          dlState.event === deadline.event && dlState.sent['24h'] ? dlState.newsAtSummary : null;

        // The attempt is recorded before the send, so a run that dies mid-send
        // still counts towards MAX_ATTEMPTS and cannot repeat every hour. Only
        // Telegram accepting it marks the slot done; a rejection is retried
        // next hour, up to three attempts in all.
        const attempted = markAttempt(dlState, deadline.event, slots, newsNow);
        await writeDeadlineState(attempted);

        const parts: string[] = [];
        let summary: SentNotification['summary'] = {
          ...EMPTY_SUMMARY,
          deadlineIn: Math.round(deadline.hoursAway),
        };
        if (slots.includes('24h')) {
          const s = await buildSummary(ctx, alerts, deadline);
          parts.push(`📋 *Fanta: GW${escapeMarkdown(deadline.event)} deadline summary*\n\n${s.text}`);
          summary = s.summary;
        }
        if (slots.includes('2h')) {
          // In a caught-up message the summary was built just now, so nothing
          // in the squad's news is "new since" it.
          const r = buildReminder(ctx, deadline, slots.includes('24h') ? newsNow : priorNews);
          parts.push(
            `${slots.includes('24h') ? '' : `⏰ *Fanta: GW${escapeMarkdown(deadline.event)} — set your team*\n\n`}${r.text}`
          );
          if (!slots.includes('24h')) summary = r.summary;
        }
        const kind = slots.includes('2h') ? 'deadline-2h' : 'deadline-24h';
        results.deadline = { event: deadline.event, slots };
        if (await deliver(kind, parts.join('\n\n— — —\n\n'), summary)) {
          await writeDeadlineState(
            markDelivered(attempted, deadline.event, slots, new Date().toISOString())
          );
        }
      }
    }

    if (results.deadline || results.statusDrops) await pruneNotifications();

    if (failed) {
      return NextResponse.json({ ...results, alertSent: false, error: failed }, { status: 502 });
    }
    return NextResponse.json({
      ...results,
      alertSent: Boolean(results.deadline || results.statusDrops),
      message:
        results.deadline || results.statusDrops ? undefined : 'Nothing to send this hour.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error executing cron job' }, { status: 500 });
  }
}
