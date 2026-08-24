import { NextRequest, NextResponse } from 'next/server';
import { buildArchivePayload, writeArchive } from '@/lib/archive';
import {
  getAdminConfigStatus,
  isAdminConfigured,
  ADMIN_NOT_CONFIGURED,
} from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // firebase-admin cannot run on the Edge runtime

/**
 * Reports whether the server can write to Firestore, so the UI can explain
 * itself before the user clicks anything.
 */
export async function GET() {
  const status = getAdminConfigStatus();

  if (status.ok) {
    return NextResponse.json({
      configured: true,
      projectId: status.projectId,
      serviceAccount: status.clientEmail,
      cronSecret: Boolean(process.env.CRON_SECRET),
      appPassword: Boolean(process.env.APP_PASSWORD),
    });
  }

  return NextResponse.json({
    configured: false,
    reason: status.reason,
    message: status.detail,
    cronSecret: Boolean(process.env.CRON_SECRET),
    appPassword: Boolean(process.env.APP_PASSWORD),
  });
}

/**
 * Gathers a snapshot from the FPL API and stores it. Both halves run here:
 * the FPL API is not CORS-enabled, and Firestore is closed to browsers.
 */
export async function POST(req: NextRequest) {
  try {
    const { teamId, gw, selectedLeagueIds } = await req.json();

    if (!teamId || isNaN(Number(teamId))) {
      return NextResponse.json({ error: 'Invalid Team ID' }, { status: 400 });
    }
    if (!gw || isNaN(Number(gw))) {
      return NextResponse.json({ error: 'Invalid Gameweek' }, { status: 400 });
    }
    if (!isAdminConfigured) {
      return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
    }

    const leagueIds = Array.isArray(selectedLeagueIds)
      ? selectedLeagueIds.map(Number).filter((n) => !isNaN(n))
      : [];

    const archive = await buildArchivePayload(teamId, Number(gw), leagueIds);
    await writeArchive(archive);

    return NextResponse.json({
      teamId: archive.teamId,
      teamName: archive.teamName,
      gameweek: archive.gameweek,
      squadSize: archive.squad.length,
      leaguesArchived: archive.selectedPrivateLeagues.length,
      membersArchived: archive.selectedPrivateLeagues.reduce((n, l) => n + l.membersCount, 0),
      lastSynced: archive.lastSynced,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to archive snapshot' },
      { status: 500 }
    );
  }
}
