import { NextResponse } from 'next/server';
import { fetchFPLFixtures } from '@/lib/fpl-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await fetchFPLFixtures();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch FPL Fixtures' },
      { status: 500 }
    );
  }
}
