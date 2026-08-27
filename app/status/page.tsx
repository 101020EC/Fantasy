import React from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { ANALYST_ENABLED, finalisedEvents, seasonKey } from '@/lib/analyst';
import { storedPlayerStatGameweeks } from '@/lib/analyst-store';
import { listNotifications } from '@/lib/notifications';
import {
  listSnapshotDates,
  readPriceThresholds,
  storedChangeDates,
} from '@/lib/price-changes-store';
import { getTelegramConfig, maskToken } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Tone = 'ok' | 'warn' | 'bad' | 'idle';

interface Check {
  label: string;
  tone: Tone;
  value: string;
  detail: string;
}

/**
 * One page answering "is this actually working".
 *
 * Every subsystem here could already be queried, but nothing rendered any of
 * it, so the honest answer to "did the alert fire" was a curl command. Worse,
 * three very different situations produced identical silence: nothing met the
 * thresholds, the bot was not configured, and every send was rejected. Those
 * are now separate rows with separate colours.
 *
 * Amber, not red, is the default for "no data yet". Most of this is waiting on
 * the calendar rather than broken, and a page that cries wolf in August gets
 * ignored in December.
 */
export default async function StatusPage() {
  const checks: Check[] = [];
  let error: string | null = null;

  try {
    if (!isAdminConfigured) {
      error = 'Firestore is not configured, so nothing can be reported.';
    } else {
      const bootstrap = await fetchFPLBootstrap();
      const season = seasonKey(bootstrap);
      const finalised = finalisedEvents(bootstrap).map((e) => e.id);
      const current = bootstrap.events.find((e) => e.is_current);
      const next = bootstrap.events.find((e) => e.is_next);

      const [snapshotDates, changeDates, thresholds, telegram, notifications, stats] =
        await Promise.all([
          listSnapshotDates().catch((): string[] => []),
          storedChangeDates().catch((): string[] => []),
          readPriceThresholds(season).catch(() => null),
          getTelegramConfig().catch(() => null),
          listNotifications(30).catch(() => []),
          storedPlayerStatGameweeks(season).catch((): number[] => []),
        ]);

      // ── Market snapshot ──────────────────────────────────────────────────
      const last = snapshotDates[snapshotDates.length - 1] ?? null;
      const daysSince = last
        ? Math.floor((Date.now() - Date.parse(`${last}T01:00:00Z`)) / 86_400_000)
        : null;
      const gaps = countGaps(snapshotDates);
      checks.push({
        label: 'Market snapshot',
        tone: !last ? 'bad' : daysSince! > 1 ? 'bad' : gaps > 0 ? 'warn' : 'ok',
        value: last
          ? `${snapshotDates.length} day${snapshotDates.length === 1 ? '' : 's'}, last ${last}`
          : 'never captured',
        detail: !last
          ? 'The daily cron has never written a snapshot. Everything below depends on it.'
          : daysSince! > 1
          ? `No capture for ${daysSince} day${daysSince === 1 ? '' : 's'} — the 01:00 UTC cron has stopped.`
          : gaps > 0
          ? `${gaps} missing day${gaps === 1 ? '' : 's'} in the series. A diff across a gap covers more than one night.`
          : 'Captured daily at 01:00 UTC, 30 minutes before prices move.',
      });

      // ── Price changes ────────────────────────────────────────────────────
      checks.push({
        label: 'Price changes',
        tone: changeDates.length ? 'ok' : snapshotDates.length < 2 ? 'idle' : 'warn',
        value: changeDates.length ? `${changeDates.length} days computed` : 'none yet',
        detail: changeDates.length
          ? `History runs from ${changeDates[0]}. Shown on the Past tab of the market page.`
          : snapshotDates.length < 2
          ? 'Needs two snapshots to compare. Nothing is wrong — there is simply nothing to diff yet.'
          : 'Snapshots exist but no diff has been written. The cron step may be failing.',
      });

      // ── Target threshold ─────────────────────────────────────────────────
      checks.push({
        label: 'Target threshold',
        tone: thresholds?.fitted ? 'ok' : 'idle',
        value: thresholds?.fitted
          ? `fitted (rises x${thresholds.riseScale.toFixed(2)}, falls x${thresholds.fallScale.toFixed(2)})`
          : 'estimated',
        detail: thresholds?.notes?.length
          ? thresholds.notes.join(' ')
          : 'FPL never publishes the threshold. Until enough real changes have been observed, the target percentage rests on an unfitted formula.',
      });

      // ── Telegram ─────────────────────────────────────────────────────────
      const lastSent = notifications.find((n) => n.outcome === 'sent') ?? null;
      const lastFailure = notifications.find((n) => n.outcome === 'failed') ?? null;
      const failedSinceSent =
        lastFailure && (!lastSent || lastFailure.sentAt > lastSent.sentAt);
      checks.push({
        label: 'Telegram',
        tone: !telegram?.configured ? 'bad' : failedSinceSent ? 'bad' : lastSent ? 'ok' : 'idle',
        value: !telegram?.configured
          ? 'not configured'
          : failedSinceSent
          ? 'last attempt failed'
          : lastSent
          ? `last sent ${lastSent.date}`
          : 'configured, nothing sent yet',
        detail: !telegram?.configured
          ? 'No bot token or chat id, so the 23:00 UTC job exits before it looks at any price.'
          : failedSinceSent
          ? `Telegram rejected it: ${lastFailure!.error ?? 'no reason given'}`
          : lastSent
          ? `Bot ${maskToken(telegram.botToken) ?? ''}, from ${telegram.source}. Runs 06:00 Bangkok.`
          : 'Configured but no message has gone out. Most likely nothing has met the thresholds.',
      });

      // ── Alert attempts ───────────────────────────────────────────────────
      const skipped = notifications.filter((n) => n.outcome === 'skipped').length;
      checks.push({
        label: 'Alert log',
        tone: notifications.length ? 'ok' : 'idle',
        value: notifications.length
          ? `${notifications.length} recent attempts, ${skipped} quiet`
          : 'empty',
        detail: notifications.length
          ? 'Every attempt is recorded now, including the ones that sent nothing and the ones Telegram refused.'
          : 'No attempt recorded. Either the cron has not run, or it ran before failures started being logged.',
      });

      // ── Gameweeks ────────────────────────────────────────────────────────
      checks.push({
        label: 'Gameweeks',
        tone: finalised.length ? 'ok' : 'idle',
        value: finalised.length
          ? `${finalised.length} data-checked (up to GW${Math.max(...finalised)})`
          : 'none finalised',
        detail: `FPL reports GW${current?.id ?? '?'} as current${
          next ? `, GW${next.id} next` : ''
        }. Scores stay provisional until data_checked, and nothing is captured before then.`,
      });

      // ── Player stats ─────────────────────────────────────────────────────
      const pending = finalised.filter((gw) => !stats.includes(gw));
      checks.push({
        label: 'Player stats',
        tone: !ANALYST_ENABLED
          ? 'idle'
          : !finalised.length
          ? 'idle'
          : pending.length
          ? 'warn'
          : 'ok',
        value: !ANALYST_ENABLED
          ? 'analyst off'
          : `${stats.length} of ${finalised.length} finalised gameweeks`,
        detail: !ANALYST_ENABLED
          ? 'ANALYST_ENABLED is false, so the forecast pipeline does not run.'
          : !finalised.length
          ? 'Waiting on FPL to data-check a gameweek. Until then the forecast has no form data and falls back to last season.'
          : pending.length
          ? `GW${pending.join(', GW')} finalised but not captured. One gameweek is swept per nightly run.`
          : 'Every finalised gameweek has been captured.',
      });
    }
  } catch (err: any) {
    error = err?.message ?? 'Unknown error';
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl sm:text-4xl font-black text-[#111318] tracking-tight">Status</h1>
        <Link
          href="/prices"
          className="text-xs font-black text-[#38003c] px-3 py-2 rounded-2xl bg-white border border-black/5 shadow-sm"
        >
          Market
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-rose-800">{error}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {checks.map((check) => (
            <Row key={check.label} {...check} />
          ))}
        </div>
      )}
    </div>
  );
}

const TONE_META: Record<Tone, { Icon: React.ComponentType<{ className?: string }>; chip: string; icon: string }> = {
  ok: { Icon: CheckCircle2, chip: 'bg-emerald-100 text-emerald-800', icon: 'text-emerald-600' },
  warn: { Icon: AlertCircle, chip: 'bg-amber-100 text-amber-900', icon: 'text-amber-600' },
  bad: { Icon: XCircle, chip: 'bg-rose-100 text-rose-800', icon: 'text-rose-600' },
  idle: { Icon: MinusCircle, chip: 'bg-gray-100 text-gray-500', icon: 'text-gray-400' },
};

function Row({ label, tone, value, detail }: Check) {
  const meta = TONE_META[tone];
  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 flex items-start gap-3">
      <meta.Icon className={`w-5 h-5 shrink-0 mt-0.5 ${meta.icon}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-black text-[#111318] text-sm">{label}</p>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${meta.chip}`}>
            {value}
          </span>
        </div>
        <p className="text-[12px] text-black/55 mt-1 leading-snug">{detail}</p>
      </div>
    </div>
  );
}

/** Calendar days missing between the first and last capture. */
function countGaps(dates: string[]): number {
  if (dates.length < 2) return 0;
  const have = new Set(dates);
  const cursor = new Date(`${dates[0]}T00:00:00Z`);
  const end = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
  let gaps = 0;
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const key = cursor.toISOString().slice(0, 10);
    if (!have.has(key) && key !== dates[dates.length - 1]) gaps += 1;
  }
  return gaps;
}
