import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, isAdminConfigured } from './firebase-admin';
// Type-only: lib/openai.ts imports this module for the guard, so a value import
// here would close a require cycle at runtime.
import type { LLMProvider } from './openai';

/**
 * A hard monthly ceiling on language-model spend.
 *
 * This is a brake on NEW calls, and nothing else. It never deletes, rolls back
 * or invalidates work that already completed: a forecast, a captured gameweek
 * and a stored analysis all stay exactly as they are when the ceiling is
 * reached. The only thing that changes is that the next call does not happen.
 *
 * It lives beside the key it guards rather than at the route, because a guard a
 * future call site can forget to apply is not a guard. lib/openai.ts reserves
 * before every request and settles after, so adding a second caller inherits
 * the ceiling automatically.
 *
 * The deterministic forecast has no dependency on any of this — it reads
 * Firestore and arithmetic, never a model — so an exhausted budget costs the
 * commentary and leaves the product intact.
 *
 * ── Money is integers ────────────────────────────────────────────────────────
 * Every amount below is an integer count of MICRO-DOLLARS. Floating point is
 * not merely imprecise here, it is imprecise in a way that shows up immediately:
 * ten reservations of $0.10 summed as doubles give 0.9999999999999999, which
 * leaves a sliver of room under a $1 ceiling that should be exactly full.
 * Doubles appear only at the display boundary, via microsToUsd.
 */

const SETTINGS_DOC = { collection: 'settings', doc: 'aiBudget' } as const;
const USAGE_COLLECTION = 'aiUsage';

/** $1 = 1,000,000 micros. Integers up to 2^53 are exact, so this cannot drift. */
export const MICROS_PER_USD = 1_000_000;

export const usdToMicros = (usd: number) => Math.round(usd * MICROS_PER_USD);
/** Display only. Never feed the result back into a comparison or a sum. */
export const microsToUsd = (micros: number) => micros / MICROS_PER_USD;

/** Deliberately low. Overspending is the failure this exists to prevent. */
export const DEFAULT_MONTHLY_LIMIT_USD = 1;
export const DEFAULT_MONTHLY_LIMIT_MICROS = usdToMicros(DEFAULT_MONTHLY_LIMIT_USD);
export const BUDGET_PRESETS_USD = [1, 2, 5, 10, 20] as const;
/** A ceiling on the ceiling, so a typo cannot become a $10,000 month. */
export const MAX_MONTHLY_LIMIT_USD = 500;

/**
 * A reservation left behind by a crashed request is released after this long.
 *
 * Without it a process that dies between reserving and settling would hold that
 * money for the rest of the month. Comfortably longer than the 30s request
 * timeout in lib/openai.ts, so a slow call is never swept out from under itself.
 */
const RESERVATION_TTL_MS = 5 * 60 * 1000;

export const AI_BUDGET_EXCEEDED = 'AI_BUDGET_EXCEEDED' as const;

/**
 * Micro-dollars per MILLION tokens, as integers.
 *
 * A local table, because neither provider exposes prices over the API. It is
 * therefore a figure that can drift from what is actually billed, and the
 * numbers this module reports are estimates labelled as such — the provider's
 * own dashboard remains the authority on what was spent.
 */
const PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  'gpt-4o-mini': { inputPerM: 150_000, outputPerM: 600_000 },
  'gpt-4o': { inputPerM: 2_500_000, outputPerM: 10_000_000 },
  'gpt-4.1-mini': { inputPerM: 400_000, outputPerM: 1_600_000 },
  'claude-sonnet-5': { inputPerM: 3_000_000, outputPerM: 15_000_000 },
  'claude-haiku-4-5-20251001': { inputPerM: 1_000_000, outputPerM: 5_000_000 },
};

/**
 * What an unknown model is assumed to cost.
 *
 * Set to the most expensive entry above rather than an average: guessing low
 * would let an unrecognised model quietly overshoot the ceiling, which is the
 * one outcome this module exists to prevent.
 */
const UNKNOWN_MODEL_PRICING = { inputPerM: 3_000_000, outputPerM: 15_000_000 };

export function priceFor(model: string) {
  return PRICING[model] ?? UNKNOWN_MODEL_PRICING;
}

/** Cost in whole micro-dollars, rounded up so an estimate is never short. */
export function estimateCostMicros(model: string, inputTokens: number, outputTokens: number): number {
  const p = priceFor(model);
  return Math.ceil((inputTokens * p.inputPerM) / 1_000_000)
    + Math.ceil((outputTokens * p.outputPerM) / 1_000_000);
}

/** Rough token count. Only used for the pre-call estimate, never for billing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Calendar month in UTC. A new month is a new document, so the reset is free. */
export function monthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface BudgetStatus {
  month: string;
  limitMicros: number;
  spentMicros: number;
  /** Held by calls currently in flight. Counts against the ceiling. */
  reservedMicros: number;
  remainingMicros: number;
  calls: number;
  /** `ok` while there is room for a typical call, `exhausted` when there is not. */
  state: 'ok' | 'low' | 'exhausted';
  source: 'firestore' | 'default';
  updatedAt: string | null;
}

/**
 * The only place micros become dollars.
 *
 * Routes call this on the way out so the browser gets familiar units while
 * every comparison behind it stayed in integers.
 */
export function budgetStatusForDisplay(s: BudgetStatus) {
  return {
    month: s.month,
    limitUsd: microsToUsd(s.limitMicros),
    spentUsd: microsToUsd(s.spentMicros),
    reservedUsd: microsToUsd(s.reservedMicros),
    remainingUsd: microsToUsd(s.remainingMicros),
    limitMicros: s.limitMicros,
    spentMicros: s.spentMicros,
    remainingMicros: s.remainingMicros,
    calls: s.calls,
    state: s.state,
    source: s.source,
    updatedAt: s.updatedAt,
  };
}

export async function getMonthlyLimitMicros(): Promise<{ limitMicros: number; source: 'firestore' | 'default' }> {
  if (!isAdminConfigured) return { limitMicros: DEFAULT_MONTHLY_LIMIT_MICROS, source: 'default' };
  try {
    const d = (await getAdminDb().collection(SETTINGS_DOC.collection).doc(SETTINGS_DOC.doc).get()).data();
    // Micros are authoritative; the dollar field is kept beside them so the
    // stored document stays readable, and is only used for a document written
    // before micros existed.
    const micros = Number(d?.monthlyLimitMicros);
    if (Number.isInteger(micros) && micros >= 0) return { limitMicros: micros, source: 'firestore' };
    const usd = Number(d?.monthlyLimitUsd);
    if (Number.isFinite(usd) && usd >= 0) return { limitMicros: usdToMicros(usd), source: 'firestore' };
  } catch (err) {
    // A settings read that fails must not open the gate. Falling back to the
    // default keeps the ceiling low rather than removing it.
    console.warn('Could not read the AI budget setting:', err);
  }
  return { limitMicros: DEFAULT_MONTHLY_LIMIT_MICROS, source: 'default' };
}

/** Takes dollars because that is what the UI offers; stores micros as truth. */
export async function setMonthlyLimitUsd(limitUsd: number): Promise<void> {
  const limitMicros = usdToMicros(limitUsd);
  await getAdminDb()
    .collection(SETTINGS_DOC.collection)
    .doc(SETTINGS_DOC.doc)
    .set(
      { monthlyLimitMicros: limitMicros, monthlyLimitUsd: microsToUsd(limitMicros), updatedAt: new Date().toISOString() },
      { merge: true }
    );
}

interface OpenReservation {
  micros: number;
  at: number;
  operation: string;
}

interface MonthDoc {
  month: string;
  spentMicros: number;
  calls: number;
  openReservations: Record<string, OpenReservation>;
  updatedAt: string;
}

const emptyMonth = (month: string): MonthDoc => ({
  month,
  spentMicros: 0,
  calls: 0,
  openReservations: {},
  updatedAt: new Date(0).toISOString(),
});

function readMonth(data: any, month: string): MonthDoc {
  if (!data) return emptyMonth(month);
  const spentMicros = Number.isFinite(Number(data.spentMicros))
    ? Number(data.spentMicros)
    : usdToMicros(Number(data.spentUsd) || 0);
  const raw = (data.openReservations ?? {}) as Record<string, any>;
  const openReservations: Record<string, OpenReservation> = {};
  for (const [id, r] of Object.entries(raw)) {
    if (!r || typeof r !== 'object') continue;
    openReservations[id] = {
      micros: Number.isFinite(Number(r.micros)) ? Number(r.micros) : usdToMicros(Number(r.usd) || 0),
      at: Number(r.at) || 0,
      operation: String(r.operation ?? ''),
    };
  }
  return {
    month,
    spentMicros,
    calls: Number(data.calls) || 0,
    openReservations,
    updatedAt: String(data.updatedAt ?? new Date(0).toISOString()),
  };
}

/**
 * Splits stored reservations into those still counting and those to erase.
 *
 * Expired entries are returned as ids to delete rather than simply left out of
 * the next write. Omitting a key from a set(merge:true) does NOT remove it:
 * the Admin SDK builds its field mask from leaf paths, so a map written that
 * way is merged key by key and anything missing survives. Only an explicit
 * FieldValue.delete() at that path removes it.
 */
function partitionReservations(doc: MonthDoc, now: number) {
  const live: Record<string, OpenReservation> = {};
  const expired: string[] = [];
  let heldMicros = 0;
  for (const [id, r] of Object.entries(doc.openReservations)) {
    if (now - r.at > RESERVATION_TTL_MS) {
      expired.push(id);
      continue;
    }
    live[id] = r;
    heldMicros += r.micros;
  }
  return { live, expired, heldMicros };
}

/** The map patch that erases the given reservation ids, and nothing else. */
function deletions(ids: string[]): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const id of ids) patch[id] = FieldValue.delete();
  return patch;
}

export interface Reservation {
  id: string;
  month: string;
  estimatedMicros: number;
  operation: string;
}

export type ReserveResult =
  | { ok: true; reservation: Reservation; status: BudgetStatus }
  | { ok: false; code: typeof AI_BUDGET_EXCEEDED; message: string; status: BudgetStatus };

function statusOf(
  doc: MonthDoc,
  limitMicros: number,
  heldMicros: number,
  source: 'firestore' | 'default'
): BudgetStatus {
  const remaining = limitMicros - doc.spentMicros - heldMicros;
  return {
    month: doc.month,
    limitMicros,
    spentMicros: doc.spentMicros,
    reservedMicros: heldMicros,
    remainingMicros: Math.max(0, remaining),
    calls: doc.calls,
    // Integer comparison throughout: `low` is the last tenth of the ceiling.
    state: remaining <= 0 ? 'exhausted' : remaining * 10 < limitMicros ? 'low' : 'ok',
    source,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Claims budget for one call, atomically.
 *
 * The check and the claim happen inside a single Firestore transaction on the
 * month document, so two requests arriving together cannot both see the same
 * remaining balance and both proceed. Whichever transaction commits second
 * re-reads the first one's reservation and is refused.
 *
 * On refusal nothing is written: a rejected call consumes no budget.
 */
export async function reserveBudget(
  operation: string,
  estimatedMicros: number,
  now: Date = new Date()
): Promise<ReserveResult> {
  const month = monthKey(now);
  const { limitMicros, source } = await getMonthlyLimitMicros();
  const db = getAdminDb();
  const ref = db.collection(USAGE_COLLECTION).doc(month);
  // Generated outside the transaction so a Firestore retry reuses the same id
  // rather than leaving a duplicate reservation behind.
  const id = `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return db.runTransaction(async (txn): Promise<ReserveResult> => {
    const snap = await txn.get(ref);
    const doc = readMonth(snap.data(), month);
    const { expired, heldMicros } = partitionReservations(doc, now.getTime());

    if (doc.spentMicros + heldMicros + estimatedMicros > limitMicros) {
      return {
        ok: false,
        code: AI_BUDGET_EXCEEDED,
        message:
          `This call needs about $${microsToUsd(estimatedMicros).toFixed(4)} and the ${month} budget has ` +
          `$${microsToUsd(Math.max(0, limitMicros - doc.spentMicros - heldMicros)).toFixed(4)} left of ` +
          `$${microsToUsd(limitMicros).toFixed(2)}. ` +
          `No request was sent and no budget was used. Everything already computed is unaffected — ` +
          `the forecast does not use the model.`,
        status: statusOf(doc, limitMicros, heldMicros, source),
      };
    }

    txn.set(
      ref,
      {
        month,
        spentMicros: doc.spentMicros,
        calls: doc.calls,
        openReservations: {
          ...deletions(expired),
          [id]: { micros: estimatedMicros, at: now.getTime(), operation },
        },
        updatedAt: now.toISOString(),
      },
      { merge: true }
    );

    return {
      ok: true,
      reservation: { id, month, estimatedMicros, operation },
      status: statusOf(doc, limitMicros, heldMicros + estimatedMicros, source),
    };
  });
}

export interface UsageRecord {
  model: string;
  provider: LLMProvider;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  /** 'estimated' when the provider did not report token counts. */
  costBasis: 'reported' | 'estimated';
  operation: string;
  status: 'ok' | 'failed' | 'budget_exceeded';
  error?: string;
}

/**
 * Releases the reservation and records what the call actually cost.
 *
 * Append-only: it writes a usage record and advances the counters. It never
 * removes a record or reverses a spend, because spend cannot be reversed — the
 * provider was already called.
 *
 * A failed call settles at zero cost. That slightly under-counts a request the
 * provider billed for before erroring, which is the safer direction to be wrong
 * in only because the reservation is released either way.
 */
export async function settleBudget(
  reservation: Reservation,
  record: UsageRecord,
  now: Date = new Date()
): Promise<BudgetStatus> {
  const db = getAdminDb();
  const ref = db.collection(USAGE_COLLECTION).doc(reservation.month);
  const callRef = ref.collection('calls').doc();
  const { limitMicros, source } = await getMonthlyLimitMicros();

  return db.runTransaction(async (txn): Promise<BudgetStatus> => {
    const snap = await txn.get(ref);
    const doc = readMonth(snap.data(), reservation.month);
    const { live, expired } = partitionReservations(doc, now.getTime());

    // Erased by an explicit delete at its own path. Writing the surviving map
    // instead would leave this reservation in the document, still holding
    // budget alongside the spend it has just become — the same call counted
    // twice until its TTL ran out.
    delete live[reservation.id];
    const remove = [...new Set([...expired, reservation.id])];

    const spentMicros = doc.spentMicros + Math.max(0, Math.round(record.costMicros));
    const calls = doc.calls + 1;

    txn.set(
      ref,
      {
        month: reservation.month,
        spentMicros,
        calls,
        openReservations: deletions(remove),
        updatedAt: now.toISOString(),
      },
      { merge: true }
    );
    txn.set(callRef, { ...record, at: now.toISOString(), month: reservation.month });

    let heldMicros = 0;
    for (const r of Object.values(live)) heldMicros += r.micros;
    return statusOf({ ...doc, spentMicros, calls, updatedAt: now.toISOString() }, limitMicros, heldMicros, source);
  });
}

/** Read-only view for the UI. Never reserves, never writes. */
export async function getBudgetStatus(now: Date = new Date()): Promise<BudgetStatus> {
  const month = monthKey(now);
  const { limitMicros, source } = await getMonthlyLimitMicros();
  if (!isAdminConfigured) return statusOf(emptyMonth(month), limitMicros, 0, source);
  const snap = await getAdminDb().collection(USAGE_COLLECTION).doc(month).get();
  const doc = readMonth(snap.data(), month);
  const { heldMicros } = partitionReservations(doc, now.getTime());
  return statusOf(doc, limitMicros, heldMicros, source);
}

/** The most recent calls, for the usage list in the UI. */
export async function recentUsage(limit = 10, now: Date = new Date()) {
  if (!isAdminConfigured) return [];
  const snap = await getAdminDb()
    .collection(USAGE_COLLECTION)
    .doc(monthKey(now))
    .collection('calls')
    .orderBy('at', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return { ...data, costUsd: microsToUsd(Number(data.costMicros) || 0) };
  });
}
