import { NextRequest, NextResponse } from 'next/server';
import type { FPLElement } from '@/lib/types';
import { fetchFPLBootstrap, fetchFPLEntry, fetchFPLPicks } from '@/lib/fpl-api';
import { escapeMarkdown, getTelegramConfig, sendTelegramMessage } from '@/lib/telegram';
import { getAdminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { recordNotification } from '@/lib/notifications';
import { readHourlyState, writeHourlyState } from '@/lib/hourly-state';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // firebase-admin cannot run on the Edge runtime

/**
 * Hourly watch on the squad and watchlist.
 *
 * The nightly price-alert answers "what is likely to happen tonight". This
 * answers "what has changed since the last hour" — a price that has already
 * moved, an injury note that has appeared, a player flagged out. Those events
 * do not wait for 06:00 Bangkok, and acting on them late costs a transfer.
 *
 * Deliberately small: bootstrap (cached 300s), entry, picks, two Firestore
 * reads and one write. It must stay cheap enough to run twenty-four times a day
 * without thinking about it, so nothing from the analyst pipeline belongs here.
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

const money = (tenths: number) => (tenths / 10).toFixed(1);

interface Tracked {
  el: FPLElement;
  club: string;
  /** Whether the player is in the squad, as opposed to only on the watchlist. */
  owned: boolean;
}

/** Squad element ids for the current gameweek, or an empty set if FPL will not say. */
async function squadIds(teamId: string): Promise<Set<number>> {
  try {
    const entry = await fetchFPLEntry(teamId);
    const picks = await fetchFPLPicks(teamId, entry.current_event);
    return new Set(picks.picks.map((p) => p.element));
  } catch {
    // The watchlist half is still worth reporting without the squad.
    return new Set();
  }
}

async function watchlistIds(teamId: string): Promise<Set<number>> {
  if (!isAdminConfigured) return new Set();
  try {
    const snap = await getAdminDb().collection('watchlists').doc(String(teamId)).get();
    return new Set<number>(snap.data()?.elementIds ?? []);
  } catch {
    return new Set();
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
    const [owned, watched, state] = await Promise.all([
      squadIds(teamId),
      alerts.watchlist ? watchlistIds(teamId) : Promise.resolve(new Set<number>()),
      readHourlyState(),
    ]);

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
    const next = {
      price: {} as Record<string, number>,
      news: {} as Record<string, string>,
      flag: {} as Record<string, string>,
    };
    tracked.forEach(({ el }) => {
      next.price[el.id] = el.now_cost;
      next.news[el.id] = el.news ?? '';
      next.flag[el.id] = el.status;
    });

    // The first ever run has nothing to compare against. Seeding silently is
    // the only honest option: every tracked player differs from nothing.
    if (!state.seeded) {
      await writeHourlyState(next);
      return NextResponse.json({
        alertSent: false,
        seeded: true,
        trackedCount: tracked.length,
        message: 'Baseline recorded. Changes will be reported from the next run.',
      });
    }

    const priceMoves: { t: Tracked; from: number; to: number }[] = [];
    const newsItems: Tracked[] = [];
    const flagged: { t: Tracked; from: string; to: string }[] = [];

    tracked.forEach((t) => {
      const { el } = t;
      const key = String(el.id);

      // A player only just added to the watchlist has no prior value. That is
      // not a change, so they are seeded on this pass and reported from the
      // next one — the same rule as the first run, applied per player.
      const wasPrice = state.price[key];
      if (alerts.priceChanged && wasPrice !== undefined && wasPrice !== el.now_cost) {
        priceMoves.push({ t, from: wasPrice, to: el.now_cost });
      }

      const wasNews = state.news[key];
      const nowNews = el.news ?? '';
      if (alerts.injuries && wasNews !== undefined && wasNews !== nowNews && nowNews) {
        newsItems.push(t);
      }

      const wasFlag = state.flag[key];
      if (alerts.injuries && wasFlag !== undefined && wasFlag !== el.status) {
        flagged.push({ t, from: wasFlag, to: el.status });
      }
    });

    // Written before the send. If Telegram fails, the next hour reporting the
    // same change would be worse than losing it once: the failure is recorded
    // in `notifications` either way, and a repeating false alarm is not.
    await writeHourlyState(next);

    const summary = {
      ...EMPTY_SUMMARY,
      injuries: newsItems.length + flagged.length,
      priceChanges: priceMoves.length,
      watchlist: tracked.filter((t) => !t.owned).length,
    };

    if (!priceMoves.length && !newsItems.length && !flagged.length) {
      return NextResponse.json({
        alertSent: false,
        trackedCount: tracked.length,
        message: 'Nothing changed since the last hour.',
      });
    }

    const label = (t: Tracked) =>
      `*${escapeMarkdown(t.el.web_name)}* \\(${escapeMarkdown(t.club)}\\)${
        t.owned ? '' : ' 👁'
      }`;

    let text = `⏱ *Fanta: hourly update*\n\n`;

    if (priceMoves.length) {
      text += `💰 *Price moved:*\n`;
      priceMoves.slice(0, MAX_NAMED).forEach(({ t, from, to }) => {
        const arrow = to > from ? '🔺' : '🔻';
        text += `${arrow} ${label(t)} £${escapeMarkdown(money(from))} → £${escapeMarkdown(
          money(to)
        )}\n`;
      });
      if (priceMoves.length > MAX_NAMED) {
        text += `_\\+${escapeMarkdown(priceMoves.length - MAX_NAMED)} more_\n`;
      }
      text += `\n`;
    }

    if (newsItems.length) {
      text += `🏥 *New team news:*\n`;
      newsItems.slice(0, MAX_NAMED).forEach((t) => {
        const chance = t.el.chance_of_playing_next_round;
        const pct = chance === null ? '' : ` \\(${escapeMarkdown(String(chance))}%\\)`;
        text += `• ${label(t)}${pct} — ${escapeMarkdown(t.el.news)}\n`;
      });
      text += `\n`;
    }

    if (flagged.length) {
      const word = (s: string) =>
        ({ a: 'available', d: 'doubtful', i: 'injured', s: 'suspended', u: 'unavailable' })[s] ??
        s;
      text += `🚦 *Availability changed:*\n`;
      flagged.slice(0, MAX_NAMED).forEach(({ t, from, to }) => {
        text += `• ${label(t)} ${escapeMarkdown(word(from))} → *${escapeMarkdown(
          word(to)
        )}*\n`;
      });
      text += `\n`;
    }

    text += `_👁 \\= watchlist, not in your squad_`;

    const result = await sendTelegramMessage(botToken, chatId, text);
    await recordNotification({
      kind: 'alert',
      outcome: result.ok ? 'sent' : 'failed',
      error: result.ok
        ? result.description ?? null
        : result.description ?? 'Telegram rejected the message',
      summary,
      text,
    });

    if (!result.ok) {
      return NextResponse.json(
        { alertSent: false, error: `Telegram rejected the message: ${result.description}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      alertSent: true,
      trackedCount: tracked.length,
      priceMoves: priceMoves.length,
      newsItems: newsItems.length,
      flagged: flagged.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error executing cron job' }, { status: 500 });
  }
}
