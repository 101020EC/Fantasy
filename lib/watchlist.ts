import { getAdminDb, isAdminConfigured } from './firebase-admin';

/**
 * The watchlist, read server-side.
 *
 * It already lives at `watchlists/{teamId}` because the nightly Telegram job
 * has no browser to hold a local list. The team page needs the same read: a
 * watchlisted player about to move is exactly the thing you would act on from
 * there, and until now that page did not load the list at all.
 */
export async function readWatchlist(teamId: string | number): Promise<number[]> {
  if (!isAdminConfigured) return [];
  const snap = await getAdminDb().collection('watchlists').doc(String(teamId)).get();
  const ids = snap.data()?.elementIds;
  return Array.isArray(ids) ? ids.filter((n) => typeof n === 'number') : [];
}
