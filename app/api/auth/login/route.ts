import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, createSessionToken, isAuthConfigured, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ success: true, open: true });
  }

  const { password } = await req.json().catch(() => ({ password: '' }));
  if (typeof password !== 'string' || !(await checkPassword(password.trim()))) {
    return NextResponse.json({ success: false, error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), SESSION_COOKIE_OPTIONS);
  return res;
}
