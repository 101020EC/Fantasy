/**
 * Which gameweek chip the viewer last picked on the team page, as an offset
 * from the gameweek being played: 0 for this one, 1 for the one after.
 *
 * An offset rather than a gameweek number — gameweeks advance every week, so a
 * remembered "GW 6" would be a week in the past on the next visit.
 *
 * A cookie rather than localStorage because the team page renders on the
 * server. localStorage could only be read after mount, which means rendering
 * the wrong gameweek and then replacing it — visible as the page jumping.
 */
export const GW_OFFSET_COOKIE = 'fanta_gw_offset';

/** Records the choice for the next visit. No-op on the server. */
export function rememberGwOffset(offset: 0 | 1): void {
  if (typeof document === 'undefined') return;
  // A year: the preference is "which of these two I look at", which does not
  // expire with a session. SameSite=Lax is enough — it is only read on
  // navigations to our own pages.
  document.cookie = `${GW_OFFSET_COOKIE}=${offset}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * The remembered choice as a URL segment, read in the browser.
 *
 * Links are built with this rather than pointing at `/team/{id}` and letting
 * the middleware rewrite decide: a request that arrives through a middleware
 * rewrite does not get served from the route cache, so the rewritten path — the
 * one the menu used — was the one path that stayed uncached. Measured, not
 * assumed: `/team/{id}/live` reported `x-nextjs-cache: HIT` at 2.7ms while the
 * same page reached through the rewrite reported no cache at all.
 *
 * Returns 'live' anywhere there is no document, which is also the right answer
 * for a first visit.
 */
export function gwSegment(): 'live' | 'next' {
  if (typeof document === 'undefined') return 'live';
  return document.cookie.includes(`${GW_OFFSET_COOKIE}=1`) ? 'next' : 'live';
}
