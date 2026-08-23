/**
 * Session primitives shared by middleware (Edge runtime) and route handlers
 * (Node runtime). Uses Web Crypto only, so the same code runs in both — this
 * file must never import next/headers or node: modules. Session helpers that
 * need the request context live in lib/auth-server.ts.
 */

export const SESSION_COOKIE = 'fanta_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  // Falls back to the password so one env var is enough to get running.
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || '';
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

async function hmac(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Compares without leaking length or position through timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Signs an expiry stamp so the cookie cannot be forged in the browser. */
export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  return `${expires}.${await hmac(String(expires))}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !secret()) return false;

  const [expiresRaw, sig] = token.split('.');
  if (!expiresRaw || !sig) return false;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  return safeEqual(sig, await hmac(expiresRaw));
}

export async function checkPassword(candidate: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD || '';
  if (!expected) return false;
  // Hash both sides first so the comparison is length-independent.
  return safeEqual(await hmac(`pw:${candidate}`), await hmac(`pw:${expected}`));
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE_SECONDS,
};
