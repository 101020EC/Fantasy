import { FPLBootstrap } from './types';
import { getAdminDb, isAdminConfigured } from './firebase-admin';

/**
 * The last bootstrap FPL confirmed, kept in Firestore.
 *
 * Instance memory covers a warm lambda, but a cold start during an outage has
 * nothing — which is exactly the case that takes the whole site down, since
 * every page begins by loading the bootstrap. ~270KB, comfortably inside the
 * 1MB document limit.
 */
const DOC = 'settings/fplBootstrapCache';
/** Rewrites are rate-limited: this is a safety net, not a live mirror. */
const MIN_WRITE_INTERVAL_MS = 60 * 60 * 1000;

let lastWriteAt = 0;

export async function saveBootstrapFallback(bootstrap: FPLBootstrap): Promise<void> {
  if (!isAdminConfigured) return;
  const now = Date.now();
  if (now - lastWriteAt < MIN_WRITE_INTERVAL_MS) return;
  lastWriteAt = now;
  const [collection, id] = DOC.split('/');
  await getAdminDb()
    .collection(collection)
    .doc(id)
    .set({ capturedAt: new Date().toISOString(), bootstrap: JSON.stringify(bootstrap) });
}

export async function loadBootstrapFallback(): Promise<{
  bootstrap: FPLBootstrap;
  capturedAt: string;
} | null> {
  if (!isAdminConfigured) return null;
  const [collection, id] = DOC.split('/');
  const snap = await getAdminDb().collection(collection).doc(id).get();
  const data = snap.data();
  if (!data?.bootstrap) return null;
  // Stored as a JSON string: the trimmed bootstrap nests arrays inside arrays,
  // which Firestore refuses outright.
  return { bootstrap: JSON.parse(data.bootstrap) as FPLBootstrap, capturedAt: data.capturedAt };
}
