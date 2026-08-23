import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { listNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // firebase-admin cannot run on the Edge runtime

export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAdminConfigured) {
    return NextResponse.json({ notifications: [], configured: false });
  }

  const notifications = await listNotifications();
  return NextResponse.json({ notifications, configured: true });
}
