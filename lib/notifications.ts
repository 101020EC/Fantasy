import { getAdminDb, isAdminConfigured } from './firebase-admin';

/**
 * A log of every alert attempt, delivered or not.
 *
 * The alert job used to send and forget, so there was no way to answer "did it
 * go out, and what did it say" without opening Telegram. Worse, only successful
 * sends were recorded, which made three very different situations look
 * identical from outside: nothing qualified, the bot was not configured, and
 * Telegram rejected every message. Failures and skips are recorded too, so
 * silence always has a reason attached to it.
 */
export type NotificationOutcome = 'sent' | 'failed' | 'skipped';

export interface SentNotification {
  id: string;
  sentAt: string;
  /** 'alert' for the nightly run, 'test' for the button in settings. */
  kind: 'alert' | 'test';
  /**
   * What happened. Entries written before this field existed are all
   * successful sends, so a missing value reads as 'sent'.
   */
  outcome: NotificationOutcome;
  /** Telegram's own description, or why the run had nothing to say. */
  error: string | null;
  /** Bangkok date, so the list groups the way the reader thinks about days. */
  date: string;
  summary: {
    risers: number;
    fallers: number;
    watchlist: number;
    injuries: number;
    /** Players whose price actually moved since the last snapshot. */
    priceChanges?: number;
    deadlineIn: number | null;
  };
  /** The message as Telegram received it, minus the escaping. */
  text: string;
}

const COLLECTION = 'notifications';
/** Old entries stop being interesting long before they stop costing anything. */
const KEEP_DAYS = 90;

function bangkokDate(at: Date): string {
  // en-CA gives YYYY-MM-DD, which sorts correctly as a string.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(at);
}

/** Strips MarkdownV2 escaping so the stored copy reads like the delivered one. */
function unescape(text: string): string {
  return text.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1');
}

export async function recordNotification(entry: {
  kind: SentNotification['kind'];
  summary: SentNotification['summary'];
  text: string;
  /** Defaults to 'sent' so existing call sites keep their meaning. */
  outcome?: NotificationOutcome;
  error?: string | null;
}): Promise<void> {
  if (!isAdminConfigured) return;

  const now = new Date();
  try {
    await getAdminDb()
      .collection(COLLECTION)
      .add({
        sentAt: now.toISOString(),
        date: bangkokDate(now),
        kind: entry.kind,
        outcome: entry.outcome ?? 'sent',
        error: entry.error ?? null,
        summary: entry.summary,
        text: unescape(entry.text),
      });
  } catch (err) {
    // Never fail a delivered alert because the log write failed — the message
    // has already reached the user by this point.
    console.warn('Could not record the sent notification:', err);
  }
}

export async function listNotifications(limit = 60): Promise<SentNotification[]> {
  if (!isAdminConfigured) return [];

  const snap = await getAdminDb()
    .collection(COLLECTION)
    .orderBy('sentAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map((d) => {
    const data = d.data() as Partial<SentNotification>;
    return {
      ...(data as Omit<SentNotification, 'id'>),
      // Entries predate these fields; they were only ever written on success.
      outcome: data.outcome ?? 'sent',
      error: data.error ?? null,
      id: d.id,
    };
  });
}

/** Drops entries past the retention window. Called opportunistically on write. */
export async function pruneNotifications(): Promise<number> {
  if (!isAdminConfigured) return 0;

  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  const old = await getAdminDb()
    .collection(COLLECTION)
    .where('sentAt', '<', cutoff)
    .limit(200)
    .get();

  if (old.empty) return 0;
  const batch = getAdminDb().batch();
  old.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return old.size;
}
