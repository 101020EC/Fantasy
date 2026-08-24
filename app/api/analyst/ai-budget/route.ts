import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import {
  BUDGET_PRESETS_USD,
  DEFAULT_MONTHLY_LIMIT_USD,
  MAX_MONTHLY_LIMIT_USD,
  budgetStatusForDisplay,
  getBudgetStatus,
  recentUsage,
  setMonthlyLimitUsd,
} from '@/lib/ai-budget';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The monthly language-model ceiling, and what has been spent against it.
 *
 * Reports money only. The API key is never read here, never returned, and lives
 * behind lib/openai.ts on the server exactly as before.
 */
export async function GET() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [status, recent] = await Promise.all([
      getBudgetStatus(),
      recentUsage(8).catch(() => []),
    ]);
    // Micros become dollars here and nowhere earlier: every comparison behind
    // this line was integer arithmetic.
    return NextResponse.json({
      ...budgetStatusForDisplay(status),
      presets: BUDGET_PRESETS_USD,
      defaultUsd: DEFAULT_MONTHLY_LIMIT_USD,
      maxUsd: MAX_MONTHLY_LIMIT_USD,
      storable: isAdminConfigured,
      recent,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not read the AI budget' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const limitUsd = Number(body?.monthlyLimitUsd);
  if (!Number.isFinite(limitUsd) || limitUsd < 0 || limitUsd > MAX_MONTHLY_LIMIT_USD) {
    return NextResponse.json(
      { error: `monthlyLimitUsd must be between 0 and ${MAX_MONTHLY_LIMIT_USD}` },
      { status: 400 }
    );
  }

  // Rounded to the cent so the stored ceiling is a number a person can read
  // back. Any preset and any custom amount both pass through here.
  await setMonthlyLimitUsd(Number(limitUsd.toFixed(2)));
  return NextResponse.json({ saved: true, ...budgetStatusForDisplay(await getBudgetStatus()) });
}
