import type { FPLBootstrap, FPLEntry, FPLPicksResponse } from './types';
import {
  fetchFPLEntry,
  fetchFPLPicks,
  fetchFPLHistory,
  fetchFPLTransfers,
  fetchFPLFixtures,
  buildSquadPlayers,
} from './fpl-api';
import { escapeMarkdown, formatBangkok, AlertToggles } from './telegram';
import { getAdminDb, isAdminConfigured } from './firebase-admin';
import { analyzePlayerPrice } from './price-calculator';
import { listSnapshotDates, readSnapshot } from './price-changes-store';
import { diffAgainstLive, PriceChangeDay } from './price-changes';
import { freeTransfersFor } from './free-transfers';
import {
  reminderFindings,
  STATUS_WORD,
  fixturesPerTeam,
  captainPicks,
} from './deadline-alerts';
import { readForecast } from './analyst-store';
import { seasonKey } from './analyst';
import type { SentNotification } from './notifications';

/**
 * The two deadline messages: the T−24h summary (what used to be the nightly
 * 21:00 alert, plus free transfers) and the T−2h line-up reminder.
 *
 * Every interpolated value is escaped: manager and player names routinely
 * contain characters MarkdownV2 reserves.
 */

export interface Deadline {
  event: number;
  at: Date;
  hoursAway: number;
}

export type Summary = SentNotification['summary'];

/** How many named movers the message lists before it summarises the rest. */
const MAX_NAMED_CHANGES = 12;

const money = (tenths: number) => (tenths / 10).toFixed(1);

export interface SquadContext {
  bootstrap: FPLBootstrap;
  teamId: string;
  entry: FPLEntry;
  picks: FPLPicksResponse;
  squadPlayers: ReturnType<typeof buildSquadPlayers>;
  /** Null when FPL would not give the history to count from. */
  freeTransfers: number | null;
  /**
   * Club → fixtures in the deadline's gameweek. Null when FPL would not send
   * the fixture list: then nothing is called a blank, rather than everyone.
   */
  fixtures: Map<number, number> | null;
  /** Expected points per player for the deadline's gameweek, and where they came from. */
  xPts: Map<number, number>;
  xPtsSource: 'forecast' | 'fpl';
}

/**
 * Fanta's own forecast for the gameweek when the nightly job has written one,
 * otherwise FPL's `ep_next`. Never mixed: two models side by side would rank
 * players on different scales.
 */
async function expectedPoints(
  bootstrap: FPLBootstrap,
  event: number
): Promise<{ xPts: Map<number, number>; source: 'forecast' | 'fpl' }> {
  if (isAdminConfigured) {
    try {
      const f = await readForecast(seasonKey(bootstrap), event);
      const entries = Object.entries(f?.predictions ?? {});
      if (entries.length) {
        return { xPts: new Map(entries.map(([id, p]) => [Number(id), p.xPts])), source: 'forecast' };
      }
    } catch {
      // FPL's number is a fine fallback for picking a captain.
    }
  }
  const xPts = new Map<number, number>();
  bootstrap.elements.forEach((el) => {
    const v = parseFloat(el.ep_next ?? '');
    if (Number.isFinite(v)) xPts.set(el.id, v);
  });
  return { xPts, source: 'fpl' };
}

export async function loadSquadContext(
  teamId: string,
  bootstrap: FPLBootstrap,
  nextEvent: number
): Promise<SquadContext> {
  const [entry, history, transfers, fixtureList, expected] = await Promise.all([
    fetchFPLEntry(teamId),
    fetchFPLHistory(teamId),
    fetchFPLTransfers(teamId),
    fetchFPLFixtures(),
    expectedPoints(bootstrap, nextEvent),
  ]);
  const currentEvent =
    bootstrap.events.find((e) => e.is_current) ||
    bootstrap.events.find((e) => e.is_next) ||
    bootstrap.events[0];
  // The latest picks FPL will show: the coming gameweek's are private until
  // its deadline passes, so captain and line-up are as last confirmed.
  const picks = await fetchFPLPicks(teamId, entry.current_event || currentEvent.id);
  const squadPlayers = buildSquadPlayers(picks.picks, bootstrap, [], currentEvent.id);
  const freeTransfers = Array.isArray(history?.current)
    ? freeTransfersFor({
        history: history.current,
        chips: history.chips ?? [],
        nextGameweek: nextEvent,
        pendingTransfers: transfers.filter((t: any) => t.event === nextEvent).length,
      })
    : null;
  return {
    bootstrap,
    teamId,
    entry,
    picks,
    squadPlayers,
    freeTransfers,
    // fetchFPLFixtures returns [] when FPL fails; a real gameweek always has some.
    fixtures: fixtureList.some((f) => f.event === nextEvent)
      ? fixturesPerTeam(fixtureList, nextEvent)
      : null,
    xPts: expected.xPts,
    xPtsSource: expected.source,
  };
}

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
    // The rest of the summary is still worth sending without it.
    return null;
  }
}

function deadlineLine(deadline: Deadline): string {
  const hours = Math.max(0, Math.round(deadline.hoursAway));
  return `⏳ *Deadline GW${escapeMarkdown(deadline.event)}* in ${escapeMarkdown(
    String(hours)
  )}h — ${escapeMarkdown(formatBangkok(deadline.at))} Bangkok\n`;
}

function freeTransfersLine(ctx: SquadContext): string {
  if (ctx.freeTransfers === null) return `🔁 Free transfers: _could not read your history_\n`;
  return `🔁 Free transfers: *${escapeMarkdown(ctx.freeTransfers)}*\n`;
}

/** ×2 after a name in a double gameweek. */
function doubleMark(ctx: SquadContext, team: number): string {
  return (ctx.fixtures?.get(team) ?? 0) >= 2 ? ' ×2' : '';
}

/**
 * Starters whose club has no fixture this gameweek — a certain zero — and,
 * for the summary, how many of the fifteen play at all.
 */
function fixtureLines(ctx: SquadContext, withCount: boolean): string {
  if (!ctx.fixtures) return withCount ? `📅 _Fixture list unavailable — blanks not checked\\._\n\n` : '';
  const fx = ctx.fixtures;
  const elements = new Map(ctx.bootstrap.elements.map((el) => [el.id, el]));
  const teamMap = new Map(ctx.bootstrap.teams.map((t) => [t.id, t]));
  const squad = ctx.picks.picks
    .map((p) => ({ pos: p.position, el: elements.get(p.element) }))
    .filter((p): p is { pos: number; el: NonNullable<typeof p.el> } => Boolean(p.el));
  const blankStarters = squad.filter((p) => p.pos <= 11 && !fx.get(p.el.team));
  const playing = squad.filter((p) => (fx.get(p.el.team) ?? 0) > 0).length;
  const doubles = squad.filter((p) => (fx.get(p.el.team) ?? 0) >= 2).length;

  let text = '';
  if (withCount && (playing < squad.length || doubles > 0)) {
    text += `📅 *${escapeMarkdown(playing)} of ${escapeMarkdown(squad.length)}* have a fixture${
      doubles ? ` · ${escapeMarkdown(doubles)} play twice` : ''
    }\n`;
  }
  if (blankStarters.length) {
    text += `⛔ *Starters with no fixture — bench or sell:*\n`;
    blankStarters.forEach(
      (p) =>
        (text += `• *${escapeMarkdown(p.el.web_name)}* \\(${escapeMarkdown(
          teamMap.get(p.el.team)?.short_name ?? 'CLB'
        )}\\)\n`)
    );
  }
  return text ? text + `\n` : '';
}

/** Recommended captain and vice next to the current ones, so a mismatch shows. */
function captainLines(ctx: SquadContext): string {
  const elements = new Map(ctx.bootstrap.elements.map((el) => [el.id, el]));
  const squad = ctx.picks.picks
    .map((p) => elements.get(p.element))
    .filter((el): el is NonNullable<typeof el> => Boolean(el));
  // Without the fixture list nobody is excluded as blanking.
  const fx = ctx.fixtures ?? new Map(squad.map((el) => [el.team, 1]));
  const picks = captainPicks(squad, (id) => ctx.xPts.get(id) ?? null, fx);
  const current = ctx.picks.picks.find((p) => p.is_captain)?.element;
  if (!picks.length) return `🎯 _No captain suggestion — no expected points available\\._\n`;

  const label = (c: (typeof picks)[number]) =>
    `*${escapeMarkdown(c.el.web_name)}*${doubleMark(ctx, c.el.team)} ${escapeMarkdown(
      c.xPts.toFixed(1)
    )} xP`;
  const source = ctx.xPtsSource === 'forecast' ? 'Fanta forecast' : 'FPL expected points';
  let text = `🎯 Suggested captain: ${label(picks[0])}${
    picks[1] ? ` · vice ${label(picks[1])}` : ''
  } _\\(${escapeMarkdown(source)}\\)_\n`;
  if (current !== undefined && current !== picks[0].el.id) {
    text += `_Your current captain is ${escapeMarkdown(elements.get(current)?.web_name ?? current)}\\._\n`;
  }
  return text;
}

/** The T−24h summary. Without a header, so it can open a combined message. */
export async function buildSummary(
  ctx: SquadContext,
  alerts: AlertToggles,
  deadline: Deadline
): Promise<{ text: string; summary: Summary }> {
  const { bootstrap, squadPlayers, teamId } = ctx;
  const squadIds = new Set(squadPlayers.map((p) => p.element.id));
  const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));

  // Watchlist. Kept in Firestore precisely so this job can read it — there is
  // no browser here to hold a local list.
  const watchIdSet = new Set<number>();
  let watchedPlayers: { name: string; short: string; analysis: ReturnType<typeof analyzePlayerPrice> }[] = [];
  if (isAdminConfigured && alerts.watchlist) {
    try {
      const snap = await getAdminDb().collection('watchlists').doc(String(teamId)).get();
      const watchIds: number[] = snap.data()?.elementIds ?? [];
      watchIds.forEach((id) => watchIdSet.add(id));
      watchedPlayers = watchIds
        // A player already in the squad is reported under the squad heading.
        .filter((id) => !squadIds.has(id))
        .map((id) => bootstrap.elements.find((el) => el.id === id))
        .filter((el): el is NonNullable<typeof el> => Boolean(el))
        .map((el) => ({
          name: el.web_name,
          short: teamMap.get(el.team)?.short_name ?? 'CLB',
          analysis: analyzePlayerPrice(el, bootstrap),
        }));
    } catch {
      // The squad half is still worth sending.
    }
  }

  const risingStates = alerts.trends ? ['rising_soon', 'likely_riser'] : ['rising_soon'];
  const fallingStates = alerts.trends ? ['falling_soon', 'likely_faller'] : ['falling_soon'];
  const risers = alerts.priceMoves
    ? squadPlayers.filter((p) => risingStates.includes(p.priceAnalysis.status))
    : [];
  const fallers = alerts.priceMoves
    ? squadPlayers.filter((p) => fallingStates.includes(p.priceAnalysis.status))
    : [];
  const watchMovers = alerts.priceMoves
    ? watchedPlayers.filter(
        (p) => risingStates.includes(p.analysis.status) || fallingStates.includes(p.analysis.status)
      )
    : [];
  const injured = alerts.injuries
    ? squadPlayers.filter((p) => p.element.status !== 'a' && p.element.news)
    : [];

  const changed = alerts.priceChanged ? await recentPriceChanges(bootstrap.elements) : null;
  const squadChanges = changed
    ? changed.changes.filter((c) => squadIds.has(c.id) || watchIdSet.has(c.id))
    : [];

  const line = (p: (typeof squadPlayers)[number], sign: string) =>
    `• *${escapeMarkdown(p.element.web_name)}* \\(${escapeMarkdown(p.team.short_name)}\\) \\| Net: ${escapeMarkdown(
      sign + p.priceAnalysis.netTransfers.toLocaleString()
    )}\n`;

  let text = `👤 *Team:* ${escapeMarkdown(ctx.entry.name)} \\(\\#${escapeMarkdown(ctx.entry.id)}\\)\n`;
  text += deadlineLine(deadline);
  text += freeTransfersLine(ctx);
  text += captainLines(ctx);
  text += `\n`;
  text += fixtureLines(ctx, true);

  if (changed && changed.changes.length > 0) {
    const elementMap = new Map(bootstrap.elements.map((el) => [el.id, el]));
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
    if (squadChanges.length === 0) text += `_None in your squad or watchlist\\._\n`;
    // One line for the whole market, so a quiet squad never implies a quiet night.
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
  if (!risers.length && !fallers.length && !watchMovers.length && !injured.length && !squadChanges.length) {
    text += `✅ _Nothing in your squad needs attention\\._\n\n`;
  }

  // The tilde is escaped: MarkdownV2 reads a bare `~` as strikethrough.
  text += `⏰ _Prices update daily \\~06:00 Bangkok \\(23:00 UTC\\)_`;

  return {
    text,
    summary: {
      risers: risers.length,
      fallers: fallers.length,
      watchlist: watchMovers.length,
      injuries: injured.length,
      priceChanges: squadChanges.length,
      deadlineIn: Math.round(deadline.hoursAway),
    },
  };
}

/**
 * The T−2h reminder body: captain, flagged starters, free transfers, fresh news.
 * `newsAtSummary` is null when no summary went out this gameweek; then all
 * current squad news is listed, not just what is new.
 */
export function buildReminder(
  ctx: SquadContext,
  deadline: Deadline,
  newsAtSummary: Record<string, string> | null
): { text: string; summary: Summary } {
  const elements = new Map(ctx.bootstrap.elements.map((el) => [el.id, el]));
  const teamMap = new Map(ctx.bootstrap.teams.map((t) => [t.id, t]));
  const name = (id: number) => {
    const el = elements.get(id);
    if (!el) return escapeMarkdown(id);
    return `*${escapeMarkdown(el.web_name)}* \\(${escapeMarkdown(
      teamMap.get(el.team)?.short_name ?? 'CLB'
    )}\\)`;
  };
  const captain = ctx.picks.picks.find((p) => p.is_captain);
  const vice = ctx.picks.picks.find((p) => p.is_vice_captain);
  const { flaggedStarters, freshNews } = reminderFindings(
    ctx.picks.picks,
    elements,
    newsAtSummary ?? {}
  );

  let text = deadlineLine(deadline);
  text += `©️ Captain: ${captain ? name(captain.element) : '—'} · Vice: ${
    vice ? name(vice.element) : '—'
  }\n`;
  text += freeTransfersLine(ctx);
  text += captainLines(ctx);
  text += `_As last confirmed with FPL — changes you have made since are not visible\\._\n\n`;
  text += fixtureLines(ctx, false);

  if (flaggedStarters.length) {
    text += `🚦 *Starters with a flag — consider a bench swap:*\n`;
    flaggedStarters.forEach((el) => {
      const chance = el.chance_of_playing_next_round;
      const pct = chance === null ? '' : ` ${escapeMarkdown(String(chance))}%`;
      text += `• ${name(el.id)} ${escapeMarkdown(STATUS_WORD[el.status] ?? el.status)}${pct}\n`;
    });
    text += `\n`;
  }
  if (freshNews.length) {
    text += newsAtSummary ? `🏥 *New since the summary:*\n` : `🏥 *Team news:*\n`;
    freshNews.forEach((el) => (text += `• ${name(el.id)} — ${escapeMarkdown(el.news)}\n`));
    text += `\n`;
  }
  if (!flaggedStarters.length && !freshNews.length) {
    text += `✅ _No starter is flagged\\._\n`;
  }

  return {
    text: text.trimEnd(),
    summary: {
      risers: 0,
      fallers: 0,
      watchlist: 0,
      injuries: flaggedStarters.length + freshNews.length,
      priceChanges: 0,
      deadlineIn: Math.round(deadline.hoursAway),
    },
  };
}
