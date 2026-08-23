import { cookies } from 'next/headers';
import { SESSION_COOKIE, isAuthConfigured, verifySessionToken } from './auth';

/**
 * True when the caller holds a valid session — or when no password is set, in
 * which case the app is deliberately open and routes should not pretend
 * otherwise. Node runtime only (reads the request cookie store).
 */
export async function requireSession(): Promise<boolean> {
  if (!isAuthConfigured()) return true;
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
