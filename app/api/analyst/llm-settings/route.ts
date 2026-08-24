import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import {
  clearLLMConfig,
  DEFAULT_MODEL,
  getLLMConfig,
  LLMProvider,
  maskKey,
  saveLLMConfig,
} from '@/lib/openai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Reports the settings without ever returning the key itself. */
export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const cfg = await getLLMConfig();
  return NextResponse.json({
    configured: cfg.configured,
    source: cfg.source,
    provider: cfg.provider,
    model: cfg.model,
    apiKeyMask: maskKey(cfg.apiKey),
    storable: isAdminConfigured,
    defaults: DEFAULT_MODEL,
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

  const provider: LLMProvider = body.provider === 'anthropic' ? 'anthropic' : 'openai';
  const model = String(body.model ?? '').trim() || DEFAULT_MODEL[provider];
  const apiKey = String(body.apiKey ?? '').trim();

  if (!apiKey) {
    return NextResponse.json({ error: 'An API key is required' }, { status: 400 });
  }

  await saveLLMConfig({ apiKey, provider, model });
  return NextResponse.json({ saved: true, provider, model, apiKeyMask: maskKey(apiKey) });
}

export async function DELETE() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }
  await clearLLMConfig();
  return NextResponse.json({ cleared: true });
}
