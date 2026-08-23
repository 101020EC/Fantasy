import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLPicks } from '@/lib/fpl-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gw: string }> }
) {
  try {
    const { id, gw } = await params;
    if (!id || isNaN(Number(id)) || !gw || isNaN(Number(gw))) {
      return NextResponse.json({ error: 'Invalid Parameters' }, { status: 400 });
    }

    const data = await fetchFPLPicks(id, gw);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch FPL Picks' },
      { status: 404 }
    );
  }
}
