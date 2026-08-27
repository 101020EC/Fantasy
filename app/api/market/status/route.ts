import { NextResponse } from 'next/server';
import { getAdminDb, isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';
import { listPriceChangeDays, storedChangeDates } from '@/lib/price-changes-store';
import { listNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * What the archive actually holds. This is the only place the daily capture's
 * health is visible — without it a silent cron failure would go unnoticed
 * until somebody opened the Firebase console.
 */
export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ configured: false, message: ADMIN_NOT_CONFIGURED }, { status: 200 });
  }

  const db = getAdminDb();

  const [marketSnap, rosterSnap, leagueRefs] = await Promise.all([
    db.collection('market').select('date', 'gameweek', 'playerCount', 'capturedAt').get(),
    db.collection('players').doc('roster').get(),
    // listDocuments, not get: nothing ever writes leagues/{id} itself, only its
    // gameweeks subcollection, and Firestore treats such a parent as a missing
    // document that a collection query does not return.
    db.collection('leagues').listDocuments(),
  ]);

  const days = marketSnap.docs
    .map((d) => ({
      date: d.data().date as string,
      gameweek: (d.data().gameweek as number) ?? null,
      playerCount: (d.data().playerCount as number) ?? 0,
      capturedAt: d.data().capturedAt as string,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calendar gaps between the first and last capture, so a cron that stopped
  // running is visible as missing dates rather than an unchanged total.
  const missingDates: string[] = [];
  if (days.length > 1) {
    const cursor = new Date(days[0].date + 'T00:00:00Z');
    const end = new Date(days[days.length - 1].date + 'T00:00:00Z');
    const have = new Set(days.map((d) => d.date));
    while (cursor < end) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      const key = cursor.toISOString().slice(0, 10);
      if (!have.has(key) && key !== days[days.length - 1].date) missingDates.push(key);
    }
  }

  const leagues = await Promise.all(
    leagueRefs.map(async (ref) => {
      const gwSnap = await ref.collection('gameweeks').select('gameweek', 'leagueName', 'source').get();
      const gameweeks = gwSnap.docs
        .map((g) => ({ gw: g.data().gameweek as number, source: (g.data().source as string) ?? 'live' }))
        .sort((a, b) => a.gw - b.gw);
      return {
        leagueId: ref.id,
        leagueName: (gwSnap.docs[0]?.data()?.leagueName as string) ?? ref.id,
        gameweeks: gameweeks.map((g) => g.gw),
        reconstructed: gameweeks.filter((g) => g.source === 'reconstructed').length,
      };
    })
  );

  // Price changes and the alert log. Both answer "is this actually working",
  // which nothing else in the app could report before — a failed Telegram send
  // and a quiet night used to be indistinguishable.
  const [changeDates, recentChanges, notifications] = await Promise.all([
    storedChangeDates().catch((): string[] => []),
    listPriceChangeDays(7).catch(() => []),
    listNotifications(20).catch(() => []),
  ]);

  const lastSent = notifications.find((n) => n.outcome === 'sent') ?? null;
  const lastFailure = notifications.find((n) => n.outcome === 'failed') ?? null;

  return NextResponse.json({
    configured: true,
    priceChanges: {
      dayCount: changeDates.length,
      firstDate: changeDates[0] ?? null,
      lastDate: changeDates[changeDates.length - 1] ?? null,
      recent: recentChanges.map((d) => ({
        date: d.date,
        changedOn: d.changedOn,
        rises: d.risesCount,
        falls: d.fallsCount,
        spansGap: d.spansGap,
        observations: d.observations?.length ?? 0,
      })),
    },
    alerts: {
      attempts: notifications.length,
      lastSentAt: lastSent?.sentAt ?? null,
      lastFailureAt: lastFailure?.sentAt ?? null,
      lastFailureReason: lastFailure?.error ?? null,
      recent: notifications.slice(0, 10).map((n) => ({
        sentAt: n.sentAt,
        outcome: n.outcome,
        error: n.error,
        summary: n.summary,
      })),
    },
    days,
    dayCount: days.length,
    firstDate: days[0]?.date ?? null,
    lastDate: days[days.length - 1]?.date ?? null,
    missingDates,
    lastCapturedAt: days[days.length - 1]?.capturedAt ?? null,
    roster: rosterSnap.exists
      ? {
          playerCount: rosterSnap.data()!.playerCount as number,
          updatedAt: rosterSnap.data()!.updatedAt as string,
          fields: rosterSnap.data()!.fields as string[],
          players: rosterSnap.data()!.players as Record<string, (string | number | null)[]>,
        }
      : null,
    leagues,
  });
}
