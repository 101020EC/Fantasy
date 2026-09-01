import { getAdminDb, isAdminConfigured } from './firebase-admin';
import { PriceChangeDay, SnapshotLike } from './price-changes';

/**
 * Firestore access for price changes. Kept apart from lib/price-changes.ts so
 * that module stays pure and testable without a database — the diff is the part
 * with the interesting edge cases, and it should never need firebase-admin to
 * exercise them.
 */

const MARKET = 'market';
const CHANGES = 'priceChanges';
const THRESHOLDS = 'priceThresholds';

/**
 * Two seasons. Small (~2KB/day, ~1.5MB total), but unbounded growth with
 * nothing reading the far end is rent for no benefit. Mirrors the KEEP_DAYS
 * pattern in lib/notifications.ts.
 */
const KEEP_DAYS = 730;

/**
 * How far back the threshold fit looks.
 *
 * This was 30 days by accident, not by choice. A short window was defensible
 * while the threshold was a raw transfer count that drifts as the manager base
 * grows — but the rise threshold is now stored as a *fraction* of
 * `total_players`, which removes that drift, and the fall threshold is per 1%
 * of ownership. With the drift gone, more samples are strictly better.
 */
const FIT_WINDOW_DAYS = 90;

/** Every captured snapshot date, oldest first. */
export async function listSnapshotDates(): Promise<string[]> {
  if (!isAdminConfigured) return [];
  // .select() with no arguments returns document ids only — the idiom
  // /api/market/status established. A snapshot is ~41KB and none of it is
  // needed to answer "which days exist".
  const snap = await getAdminDb().collection(MARKET).select().get();
  return snap.docs.map((d) => d.id).sort();
}

export async function readSnapshot(date: string): Promise<SnapshotLike | null> {
  if (!isAdminConfigured) return null;
  const doc = await getAdminDb().collection(MARKET).doc(date).get();
  const data = doc.data();
  if (!data?.fields || !data?.players) return null;
  return {
    date: (data.date as string) ?? date,
    gameweek: (data.gameweek as number) ?? null,
    fields: data.fields as string[],
    players: data.players as SnapshotLike['players'],
  };
}

/**
 * The most recent `limit` snapshots, oldest first.
 *
 * Used to locate transfer baselines, which need to look back far enough to find
 * each player's last price change. A week is generous: FPL resets the counters
 * at every change, and a player who has not moved in seven days is at their
 * gameweek baseline anyway.
 */
export async function readRecentSnapshots(limit = 8): Promise<SnapshotLike[]> {
  const dates = await listSnapshotDates();
  const wanted = dates.slice(-limit);
  const docs = await Promise.all(wanted.map((d) => readSnapshot(d)));
  return docs.filter((d): d is SnapshotLike => d !== null);
}

/** The snapshot immediately before `date`, or null when there is none. */
export async function previousSnapshotDate(date: string): Promise<string | null> {
  const dates = await listSnapshotDates();
  const earlier = dates.filter((d) => d < date);
  return earlier.length ? earlier[earlier.length - 1] : null;
}

export async function writePriceChanges(day: PriceChangeDay): Promise<void> {
  // Keyed by date, so a re-run of the cron on the same day overwrites its own
  // document rather than adding a second one — the same idempotency guarantee
  // market/{date} already has.
  await getAdminDb().collection(CHANGES).doc(day.date).set(day);
}

export async function readPriceChanges(date: string): Promise<PriceChangeDay | null> {
  if (!isAdminConfigured) return null;
  const doc = await getAdminDb().collection(CHANGES).doc(date).get();
  return doc.exists ? (doc.data() as PriceChangeDay) : null;
}

/** Recent days, newest first. Days with no movement are included and are real. */
export async function listPriceChangeDays(limit = 30): Promise<PriceChangeDay[]> {
  if (!isAdminConfigured) return [];
  const snap = await getAdminDb()
    .collection(CHANGES)
    .orderBy('date', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as PriceChangeDay);
}

/** Drops change documents past the retention window. Called after each write. */
export async function prunePriceChanges(): Promise<number> {
  if (!isAdminConfigured) return 0;

  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
  const old = await getAdminDb()
    .collection(CHANGES)
    .where('date', '<', cutoff)
    .limit(200)
    .get();

  if (old.empty) return 0;
  const batch = getAdminDb().batch();
  old.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return old.size;
}

/** Which days have a computed diff. Ids only. */
export async function storedChangeDates(): Promise<string[]> {
  if (!isAdminConfigured) return [];
  const snap = await getAdminDb().collection(CHANGES).select().get();
  return snap.docs.map((d) => d.id).sort();
}
