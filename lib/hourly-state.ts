import { getAdminDb, isAdminConfigured } from './firebase-admin';
import { DeadlineState, EMPTY_DEADLINE_STATE } from './deadline-alerts';

/**
 * The last state the hourly alert has already told the user about.
 *
 * The nightly job could compare against yesterday's snapshot and be sure that
 * anything it found was news. An hourly job cannot: the same price change is
 * still there an hour later, and again the hour after that. Without a memory of
 * what was already sent, "prices changed" would be re-sent twenty-three times.
 *
 * So this stores one watermark per player per signal. A signal fires only when
 * its value differs from the stored one, which also makes a re-run of the same
 * hour a no-op — the cron can be retried safely.
 */
const DOC = { collection: 'settings', doc: 'hourlyState' } as const;

export interface HourlyState {
  /** elementId → now_cost, in tenths. */
  price: Record<string, number>;
  /** elementId → the `news` string as last reported. */
  news: Record<string, string>;
  /** elementId → availability status char ('a', 'i', 'd', …). */
  flag: Record<string, string>;
  /** ISO timestamp of the run that wrote this, for the status page. */
  updatedAt: string | null;
  /**
   * False when no state has ever been written. The first run must seed rather
   * than alert: every tracked player would otherwise look like a fresh change
   * and the user's first hourly message would be their entire squad.
   */
  seeded: boolean;
}

export const EMPTY_STATE: HourlyState = {
  price: {},
  news: {},
  flag: {},
  updatedAt: null,
  seeded: false,
};

export async function readHourlyState(): Promise<HourlyState> {
  if (!isAdminConfigured) return EMPTY_STATE;
  try {
    const snap = await getAdminDb().collection(DOC.collection).doc(DOC.doc).get();
    const d = snap.data();
    if (!d) return EMPTY_STATE;
    return {
      price: d.price ?? {},
      news: d.news ?? {},
      flag: d.flag ?? {},
      updatedAt: d.updatedAt ?? null,
      seeded: true,
    };
  } catch (err) {
    // Reading the watermark must never take the alert down. Treating a read
    // failure as "unseeded" would blast the whole squad, so it reads as an
    // empty-but-seeded state instead: quiet this hour, correct the next.
    console.warn('Could not read the hourly alert state:', err);
    return { ...EMPTY_STATE, seeded: true };
  }
}

/**
 * Replaces the watermark wholesale rather than merging, so players dropped from
 * the squad and watchlist stop being tracked and the document stays the size of
 * what is actually being watched.
 */
export async function writeHourlyState(next: Omit<HourlyState, 'updatedAt' | 'seeded'>) {
  if (!isAdminConfigured) return;
  await getAdminDb()
    .collection(DOC.collection)
    .doc(DOC.doc)
    .set({ ...next, updatedAt: new Date().toISOString() });
}

/**
 * Which deadline slots have gone out for the gameweek being counted down to.
 * Its own document so the wholesale rewrite of the watermark above can never
 * erase it, which would re-send a summary.
 */
const DEADLINE_DOC = { collection: 'settings', doc: 'deadlineAlerts' } as const;

export async function readDeadlineState(): Promise<DeadlineState | null> {
  if (!isAdminConfigured) return EMPTY_DEADLINE_STATE;
  try {
    const d = (await getAdminDb().collection(DEADLINE_DOC.collection).doc(DEADLINE_DOC.doc).get()).data();
    if (!d) return EMPTY_DEADLINE_STATE;
    return {
      event: d.event ?? null,
      sent: d.sent ?? {},
      attempts: d.attempts ?? {},
      newsAtSummary: d.newsAtSummary ?? {},
    };
  } catch (err) {
    // Unknown, not empty: reading it as empty could send the same summary
    // every hour until Firestore answers again. The caller skips this run.
    console.warn('Could not read the deadline alert state:', err);
    return null;
  }
}

export async function writeDeadlineState(next: DeadlineState) {
  if (!isAdminConfigured) return;
  await getAdminDb()
    .collection(DEADLINE_DOC.collection)
    .doc(DEADLINE_DOC.doc)
    .set({ ...next, updatedAt: new Date().toISOString() });
}
