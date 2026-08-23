export type { LeagueMemberStanding, CompleteArchiveData } from './archive';

export interface ArchiveResult {
  teamId: string;
  teamName: string;
  gameweek: number;
  squadSize: number;
  leaguesArchived: number;
  membersArchived: number;
  lastSynced: string;
}

/**
 * Asks the server for a backup. Everything happens over there: the FPL API
 * blocks browser requests, and Firestore is closed to clients by its rules.
 * Throws with a usable message so callers can show what actually went wrong.
 */
export async function archiveSelectedLeaguesData(
  teamId: string | number,
  gw: number,
  selectedLeagueIds: number[] = []
): Promise<ArchiveResult> {
  const res = await fetch('/api/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, gw, selectedLeagueIds }),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || 'ไม่สามารถสำรองข้อมูลได้');
  }

  return payload as ArchiveResult;
}

/** Whether the server holds Firebase credentials. */
export async function fetchArchiveStatus(): Promise<{ configured: boolean; message: string | null }> {
  try {
    const res = await fetch('/api/archive');
    if (!res.ok) return { configured: false, message: null };
    return await res.json();
  } catch {
    return { configured: false, message: null };
  }
}
