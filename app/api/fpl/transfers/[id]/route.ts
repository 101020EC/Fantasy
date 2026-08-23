import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLTransfers } from '@/lib/fpl-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Invalid Team ID' }, { status: 400 });
    }

    const data = await fetchFPLTransfers(id);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch FPL Transfers' },
      { status: 500 }
    );
  }
}
