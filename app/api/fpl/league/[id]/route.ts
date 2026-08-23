import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLLeagueStandings } from '@/lib/fpl-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Invalid League ID' }, { status: 400 });
    }

    const data = await fetchFPLLeagueStandings(id);
    if (!data) {
      return NextResponse.json({ error: 'League standings not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch FPL League Standings' },
      { status: 500 }
    );
  }
}
