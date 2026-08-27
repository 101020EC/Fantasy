import { unstable_cache } from 'next/cache';
import { getAdminDb, isAdminConfigured } from './firebase-admin';
import {
  findTransferBaselines,
  PriceChangeDay,
  SnapshotLike,
  ThresholdObservation,
  TransferBaseline,
} from './price-changes';
import { PriceContext } from './price-calculator';
import { PriceThresholds } from './price-thresholds';

/**
 * Firestore access for price changes. Kept apart from lib/price-changes.ts so
 * that module stays pure and testable without a database — the diff is the part
 * with the interesting edge cases, and it should never need firebase-admin to
 * exercise them.
 */

const MARKET = 'market';
const CHANGES = 'priceChanges';
const THRESHOLDS = 'priceThresholds';

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

/** Which days have a computed diff. Ids only. */
export async function storedChangeDates(): Promise<string[]> {
  if (!isAdminConfigured) return [];
  const snap = await getAdminDb().collection(CHANGES).select().get();
  return snap.docs.map((d) => d.id).sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Fitted thresholds
// ─────────────────────────────────────────────────────────────────────────────

export async function readPriceThresholds(season: string): Promise<PriceThresholds | null> {
  if (!isAdminConfigured) return null;
  const doc = await getAdminDb().collection(THRESHOLDS).doc(season).get();
  return doc.exists ? (doc.data() as PriceThresholds) : null;
}

export async function writePriceThresholds(t: PriceThresholds): Promise<void> {
  await getAdminDb().collection(THRESHOLDS).doc(t.season).set(t);
}

/**
 * Every threshold sample recorded on recent change documents, newest days first.
 *
 * Reads the same `priceChanges/` documents the UI uses rather than keeping a
 * second store, so a sample can never exist that the Past tab cannot account
 * for.
 */
export async function collectObservations(
  limit = 30
): Promise<{ observations: ThresholdObservation[]; sourceDays: string[] }> {
  const days = await listPriceChangeDays(limit);
  const observations: ThresholdObservation[] = [];
  const sourceDays: string[] = [];
  for (const day of days) {
    if (!day.observations?.length) continue;
    observations.push(...day.observations);
    sourceDays.push(day.date);
  }
  return { observations, sourceDays };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-facing context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Baselines and thresholds, ready to hand to analyzePlayerPrice().
 *
 * Both change at most once a day — baselines only when FPL resets a counter,
 * thresholds only when the nightly cron refits — so this is cached rather than
 * re-read on every request. Reading the raw snapshots costs ~330KB; only the
 * derived baselines are cached, which is a fraction of that.
 *
 * Every failure degrades to an empty context rather than propagating: without
 * it the score falls back to a gameweek-start baseline and the unfitted
 * formula, which is exactly what the page did before any of this existed.
 */
const baselineCache = unstable_cache(
  async () => {
    const snapshots = await readRecentSnapshots(8);
    const map = findTransferBaselines(snapshots);
    return {
      snapshotDates: snapshots.map((s) => s.date),
      baselines: Object.fromEntries([...map].map(([id, b]) => [String(id), b])),
    };
  },
  ['price-baselines'],
  { revalidate: 900, tags: ['price-baselines'] }
);

export async function loadPriceContext(season: string): Promise<PriceContext> {
  const [cached, thresholds] = await Promise.all([
    baselineCache().catch(() => ({ snapshotDates: [], baselines: {} })),
    readPriceThresholds(season).catch(() => null),
  ]);

  const baselines = new Map<number, TransferBaseline>(
    Object.entries(cached.baselines).map(([id, b]) => [Number(id), b as TransferBaseline])
  );

  return { baselines, thresholds };
}
