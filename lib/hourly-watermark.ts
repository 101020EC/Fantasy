/**
 * The watermark the hourly alert writes back, given what it could see this run.
 *
 * Normally the new watermark replaces the old one wholesale, so players who
 * left the squad or watchlist stop being tracked. But when FPL or Firestore
 * would not say who is in the squad (or on the watchlist), "not tracked this
 * hour" means "unknown", not "dropped". Replacing wholesale then would erase
 * their last values, the next hour would re-seed them silently, and any price
 * move or injury in between would never be alerted.
 *
 * So after a failed lookup, every player missing from this run keeps the value
 * from the previous watermark. Kept in its own module, free of Firebase, so it
 * can be tested on its own.
 */
export interface Watermark {
  price: Record<string, number>;
  news: Record<string, string>;
  flag: Record<string, string>;
}

export function nextWatermark(prev: Watermark, seen: Watermark, lookupFailed: boolean): Watermark {
  if (!lookupFailed) return seen;
  return {
    price: { ...prev.price, ...seen.price },
    news: { ...prev.news, ...seen.news },
    flag: { ...prev.flag, ...seen.flag },
  };
}
