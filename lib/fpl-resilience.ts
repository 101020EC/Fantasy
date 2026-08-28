/**
 * An FPL request that failed, with enough detail for the UI to say something
 * true. Collapsing every failure into one message is what put "Team Not Found"
 * on screen during a Cloudflare block, sending people to re-check a team ID
 * that was never wrong.
 */
export class FplError extends Error {
  readonly status: number;
  readonly kind: 'not_found' | 'unavailable';

  constructor(kind: 'not_found' | 'unavailable', status: number, message: string) {
    super(message);
    this.name = 'FplError';
    this.kind = kind;
    this.status = status;
  }
}

export function isUnavailable(err: unknown): boolean {
  return err instanceof FplError && err.kind === 'unavailable';
}

/**
 * Which served values FPL could not confirm.
 *
 * Keyed by the returned object itself rather than by request. The first design
 * used React's `cache()` for per-request state, and a probe route proved it
 * silently returns a fresh object on every call outside a render — the banner
 * would never have appeared. Identity has no such ambiguity: a value served
 * from the fallback is marked, a freshly fetched one is a new object and is
 * not, and nothing leaks between concurrent requests.
 */
const staleMarks = new WeakMap<object, StaleInfo>();

export interface StaleInfo {
  /** When the served copy was last confirmed fresh. */
  capturedAt: string;
  /** The status FPL answered with, or 0 if it could not be reached. */
  status: number;
}

export function markStale(value: unknown, capturedAt: string, status: number): void {
  if (value && typeof value === 'object') {
    staleMarks.set(value as object, { capturedAt, status });
  }
}

/** Stale details for a value, or null if FPL confirmed it. */
export function staleInfoFor(value: unknown): StaleInfo | null {
  if (!value || typeof value !== 'object') return null;
  return staleMarks.get(value as object) ?? null;
}

/**
 * The oldest stale mark among several values — a page built from two fallbacks
 * is only as fresh as its stalest part.
 */
export function stalest(...values: unknown[]): StaleInfo | null {
  let worst: StaleInfo | null = null;
  for (const v of values) {
    const info = staleInfoFor(v);
    if (info && (!worst || info.capturedAt < worst.capturedAt)) worst = info;
  }
  return worst;
}

interface Entry {
  value: unknown;
  capturedAt: string;
}

/**
 * Last known-good response per path, in instance memory.
 *
 * Deliberately unbounded in time but bounded in keys: FPL's blocks last minutes
 * to hours, and a stale squad is worth incomparably more than an error page.
 * A cold start loses it, which is why the bootstrap — the one every page needs —
 * also has a durable fallback in Firestore.
 */
const lastGood = new Map<string, Entry>();

export function remember(key: string, value: unknown): void {
  lastGood.set(key, { value, capturedAt: new Date().toISOString() });
}

export function recall<T>(key: string): T | null {
  const hit = lastGood.get(key);
  if (!hit) return null;
  return hit.value as T;
}

export function recallEntry(key: string): Entry | null {
  return lastGood.get(key) ?? null;
}

/** Status codes worth trying again — a block, a throttle, or a wobble. */
const RETRYABLE = new Set([403, 408, 429, 500, 502, 503, 504]);

/**
 * One retry, not five. FPL's 403 is an IP-level block that a burst makes worse,
 * so this covers a single transient failure and then gets out of the way.
 */
export async function withRetry(attempt: () => Promise<Response>): Promise<Response> {
  const first = await attempt().catch(() => null);
  if (first && (first.ok || !RETRYABLE.has(first.status))) return first;
  await new Promise((r) => setTimeout(r, 400));
  const second = await attempt().catch(() => null);
  if (second) return second;
  if (first) return first;
  throw new FplError('unavailable', 0, 'The FPL API could not be reached');
}
