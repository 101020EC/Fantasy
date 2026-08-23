import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

/**
 * Gates every page and API route behind the session cookie. The old gate was a
 * client component, so server-rendered pages and /api/* answered before it ever
 * mounted — and localStorage could be edited to walk past it.
 */
// /login must be reachable without a session, or the redirect below loops.
// /api/cron carries its own CRON_SECRET check instead.
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/session', '/api/cron'];

export async function middleware(req: NextRequest) {
  // No password configured: the app is deliberately open.
  if (!process.env.APP_PASSWORD) return NextResponse.next();

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
  if (hasSession) return NextResponse.next();

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
