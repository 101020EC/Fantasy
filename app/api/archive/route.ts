import { NextRequest, NextResponse } from 'next/server';
import { buildArchivePayload, CompleteArchiveData } from '@/lib/archive';
import { getAdminDb, isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // firebase-admin cannot run on the Edge runtime

/**
 * Reports whether the server can write to Firestore, so the UI can explain
 * itself before the user clicks anything.
 */
export async function GET() {
  return NextResponse.json({
    configured: isAdminConfigured,
    message: isAdminConfigured ? null : ADMIN_NOT_CONFIGURED,
  });
}

async function writeArchive(archive: CompleteArchiveData) {
  const db = getAdminDb();
  const id = String(archive.teamId);
  const gw = archive.gameweek;

  const batch = db.batch();

  // A. Team gameweek snapshot: teams/{teamId}/gameweeks/gw_{gw}
  batch.set(db.collection('teams').doc(id).collection('gameweeks').doc(`gw_${gw}`), archive, {
    merge: true,
  });

  // B. Team root document: teams/{teamId}
  batch.set(
    db.collection('teams').doc(id),
    {
      teamName: archive.teamName,
      managerName: archive.managerName,
      region: archive.region,
      overallPoints: archive.overallPoints,
      overallRank: archive.overallRank,
      lastUpdatedGw: gw,
      selectedLeagueIds: archive.selectedPrivateLeagues.map((l) => l.id),
      lastSynced: archive.lastSynced,
    },
    { merge: true }
  );

  // C. Standings per selected league: leagues/{leagueId}/gameweeks/gw_{gw}
  for (const league of archive.selectedPrivateLeagues) {
    if (league.standings.length === 0) continue;
    batch.set(
      db.collection('leagues').doc(String(league.id)).collection('gameweeks').doc(`gw_${gw}`),
      {
        leagueId: league.id,
        leagueName: league.name,
        gameweek: gw,
        totalMembers: league.membersCount,
        standings: league.standings,
        updatedAt: archive.lastSynced,
      },
      { merge: true }
    );
  }

  await batch.commit();
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
