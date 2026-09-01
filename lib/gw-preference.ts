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
