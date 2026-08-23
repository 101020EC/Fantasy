import { NextResponse } from 'next/server';
import { isAuthConfigured } from '@/lib/auth';
import { requireSession } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    authenticated: await requireSession(),
    required: isAuthConfigured(),
  });
}
