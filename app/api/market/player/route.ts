import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** One player's captured series, oldest first. */
export async function GET(req: NextRequest) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }

  const raw = new URL(req.url).searchParams.get('id');
  const elementId = Number(raw);
  if (!raw || !Number.isInteger(elementId) || elementId <= 0) {
    return NextResponse.json({ error: 'Invalid player id' }, { status: 400 });
  }

  const snap = await getAdminDb().collection('market').get();

  const series = snap.docs
    .map((doc) => {
      const data = doc.data();
      const fields: string[] = data.fields ?? [];
      const values = (data.players ?? {})[String(elementId)];
      if (!values) return null;

      const at = (name: string) => {
        const i = fields.indexOf(name);
        return i === -1 ? null : values[i];
      };

      const inEvent = Number(at('transfers_in_event')) || 0;
      const outEvent = Number(at('transfers_out_event')) || 0;

      return {
        date: data.date as string,
        gameweek: (data.gameweek as number) ?? null,
        price: Number(at('now_cost')) / 10,
        netTransfers: inEvent - outEvent,
        ownership: parseFloat(String(at('selected_by_percent'))) || 0,
        eventPoints: Number(at('event_points')) || 0,
        status: String(at('status') ?? 'a'),
        news: String(at('news') ?? ''),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ elementId, series });
}
