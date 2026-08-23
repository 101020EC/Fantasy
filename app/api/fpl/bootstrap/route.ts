import { NextResponse } from 'next/server';
import { fetchFPLBootstrap } from '@/lib/fpl-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await fetchFPLBootstrap();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch FPL Bootstrap static data' },
      { status: 500 }
    );
  }
}
