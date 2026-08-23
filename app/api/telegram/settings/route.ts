import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import {
  getTelegramConfig,
  saveTelegramConfig,
  clearTelegramConfig,
  maskToken,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // firebase-admin cannot run on the Edge runtime

/** Reports the settings without ever returning the bot token itself. */
export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cfg = await getTelegramConfig();
  return NextResponse.json({
    configured: cfg.configured,
    source: cfg.source,
    botTokenMask: maskToken(cfg.botToken),
    chatId: cfg.chatId,
    teamId: cfg.teamId,
    storable: isAdminConfigured,
  });
}

export async function PUT(req: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });

  const chatId = String(body.chatId ?? '').trim();
  const teamId = String(body.teamId ?? '').trim();
  const submittedToken = String(body.botToken ?? '').trim();

  if (!/^-?\d+$/.test(chatId)) {
    return NextResponse.json({ error: 'Chat ID must be a number' }, { status: 400 });
  }
  if (!/^\d+$/.test(teamId)) {
    return NextResponse.json({ error: 'Team ID must be a number' }, { status: 400 });
  }

  // An empty token field means "leave the stored one alone" — the UI never
  // receives the real token, so it cannot echo it back.
  const existing = await getTelegramConfig();
  const botToken = submittedToken || existing.botToken;
  if (!botToken) {
    return NextResponse.json({ error: 'Bot token is required' }, { status: 400 });
  }
  if (!/^\d{6,}:[\w-]{30,}$/.test(botToken)) {
    return NextResponse.json(
      { error: 'That does not look like a bot token — expected 123456789:AA...' },
      { status: 400 }
    );
  }

  await saveTelegramConfig({ botToken, chatId, teamId });
  return NextResponse.json({ saved: true, botTokenMask: maskToken(botToken), chatId, teamId });
}

export async function DELETE() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }
  await clearTelegramConfig();
  return NextResponse.json({ cleared: true });
}
