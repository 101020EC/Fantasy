import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { GW_OFFSET_COOKIE } from '@/lib/gw-preference';

/**
 * Gates every page and API route behind the session cookie. The old gate was a
 * client component, so server-rendered pages and /api/* answered before it ever
 * mounted — and localStorage could be edited to walk past it.
 */
// /login must be reachable without a session, or the redirect below loops.
// /api/cron carries its own CRON_SECRET check instead.
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/session', '/api/cron'];

/**
 * Puts the gameweek in the path so the team page can be cached.
 *
 * `/team/123` and `/team/123?gw=6` both become `/team/123/{segment}`. The page
 * behind it reads neither `cookies()` nor `searchParams`, which is what lets it
 * be prefetched and cached — reading either one opts a route into dynamic
 * rendering, and the team page was doing both.
 *
 * The rewrite deliberately emits `live`/`next` rather than a gameweek number:
 * the cookie stores an offset, and turning that offset into a number needs the
 * event list, which is a fetch this edge function has no business making on
 * every request. Words also keep their meaning all season, so a shared
 * /team/123/live does not rot, and the cache does not grow a fresh unused entry
 * every week.
 *
 * An explicit ?gw= wins over the cookie: following someone's link to a specific
 * gameweek is not the viewer choosing that week as their default.
 */
function gameweekRewrite(req: NextRequest): URL | null {
  // A malformed gameweek segment is caught here rather than by `notFound()` in
  // the page, because the page is cached now and a cached `notFound()` comes
  // back as HTTP 200 with an empty shell — measured, not assumed. Sending a
  // stale or mistyped link to the team's current week is both a better answer
  // than a blank 200 and a cacheable one.
  const stray = /^\/team\/(\d+)\/([^/]+)\/?$/.exec(req.nextUrl.pathname);
  if (stray) {
    const [, teamId, segment] = stray;
    const asNumber = Number(segment);
    const valid =
      segment === 'live' ||
      segment === 'next' ||
      (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 38);
    if (valid) return null;

    const url = req.nextUrl.clone();
    url.pathname = `/team/${teamId}/live`;
    url.search = '';
    return url;
  }

  const match = /^\/team\/(\d+)\/?$/.exec(req.nextUrl.pathname);
  if (!match) return null;

  const queryGw = Number(req.nextUrl.searchParams.get('gw'));
  const segment =
    Number.isInteger(queryGw) && queryGw >= 1 && queryGw <= 38
      ? String(queryGw)
      : req.cookies.get(GW_OFFSET_COOKIE)?.value === '1'
      ? 'next'
      : 'live';

  const url = req.nextUrl.clone();
  url.pathname = `/team/${match[1]}/${segment}`;
  url.searchParams.delete('gw');
  return url;
}

export async function middleware(req: NextRequest) {
  // No password configured: the app is deliberately open.
  if (!process.env.APP_PASSWORD) {
    const rewrite = gameweekRewrite(req);
    return rewrite ? NextResponse.rewrite(rewrite) : NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const hasSession = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  // Signed in already? No reason to show the login screen again.
  if (pathname === '/login' && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (hasSession) {
    const rewrite = gameweekRewrite(req);
    return rewrite ? NextResponse.rewrite(rewrite) : NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Static assets are matched by extension rather than by name. The old list
  // named icon.png, which no longer exists, and missed icon-192.png and
  // icon-512.png — the two the manifest actually points at — so an installed
  // app could not fetch its own icons while signed out.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)',
  ],
};
