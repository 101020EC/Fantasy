import { NextRequest, NextResponse } from 'next/server';
import { fetchFPLBootstrap } from '@/lib/fpl-api';
import { isAdminConfigured, ADMIN_NOT_CONFIGURED } from '@/lib/firebase-admin';
import { requireSession } from '@/lib/auth-server';
import { seasonKey } from '@/lib/analyst';
import { ELITE_DERIVED_FIELDS } from '@/lib/types';
import { readEliteCohort, readEliteDerived } from '@/lib/analyst-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Elite Cohort Signals for one gameweek, as percentages computed at read time.
 *
 * The stored document holds integer counts, not percentages. With ~20 managers
 * a stored percentage is a lossy re-encoding that goes silently wrong the moment
 * availableManagerCount changes: 12 of 20 is 60.0%, and 11 of 18 next week is
 * 61.1% — but 11 read against 20 would show 55.0% and a six-point drop that
 * never happened. So the division happens here, against the denominator recorded
 * in the same document.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gw: string }> }
) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: ADMIN_NOT_CONFIGURED }, { status: 503 });
  }

  const gameweek = Number((await params).gw);
  if (!Number.isInteger(gameweek) || gameweek < 1 || gameweek > 38) {
    return NextResponse.json({ error: 'Gameweek must be 1-38' }, { status: 400 });
  }

  const bootstrap = await fetchFPLBootstrap();
  const season = seasonKey(bootstrap);
  const derived = await readEliteDerived(season, gameweek);

  if (!derived) {
    return NextResponse.json(
      { season, gameweek, captured: false, message: `No cohort data stored for GW${gameweek}.` },
      { status: 404 }
    );
  }

  const cohort = await readEliteCohort(season);
  const available = derived.availableManagerCount;
  const F = (name: string) => derived.fields.indexOf(name);
  const names = new Map(bootstrap.elements.map((e) => [e.id, e.web_name]));
  const general = new Map(
    bootstrap.elements.map((e) => [e.id, Number(e.selected_by_percent) || 0])
  );

  const players = Object.entries(derived.players)
    .map(([id, counts]) => {
      const elementId = Number(id);
      const owned = counts[F('owned')] ?? 0;
      const captained = counts[F('captained')] ?? 0;
      const ownerCount = counts[F('ownerCount')] ?? 0;
      const pct = (n: number) => (available > 0 ? (n / available) * 100 : null);
      // Effective ownership: a captained player counts twice, which is what
      // actually drives rank risk.
      const eeo = available > 0 ? ((owned + captained) / available) * 100 : null;
      return {
        elementId,
        name: names.get(elementId) ?? String(elementId),
        counts: Object.fromEntries(derived.fields.map((f, i) => [f, counts[i] ?? 0])),
        ownershipPct: pct(owned),
        captainPct: pct(captained),
        transferInPct: pct(counts[F('transferredIn')] ?? 0),
        transferOutPct: pct(counts[F('transferredOut')] ?? 0),
        // Denominator discipline: started/benched divide by that player's own
        // owners, not by the cohort. Mixing the two gives plausible, wrong numbers.
        startedPct: ownerCount > 0 ? ((counts[F('startedXI')] ?? 0) / ownerCount) * 100 : null,
        effectiveOwnershipPct: eeo,
        deltaEO: eeo === null ? null : eeo - (general.get(elementId) ?? 0),
      };
    })
    .sort((a, b) => (b.effectiveOwnershipPct ?? 0) - (a.effectiveOwnershipPct ?? 0));

  return NextResponse.json({
    season,
    gameweek,
    captured: true,
    provenance: {
      sourceGameweek: derived.sourceGameweek,
      generatedAt: derived.generatedAt,
      dataChecked: derived.dataChecked,
      cohortSize: derived.cohortSize,
      availableManagerCount: available,
      missing: derived.missing,
      computeVersion: derived.computeVersion,
    },
    // Both numbers, always: cohortSize is what the sample is meant to be,
    // availableManagerCount is what it was. Collapsing them loses the ability
    // to tell "nobody owns him" from "half the cohort was unreachable".
    quality:
      available < derived.cohortSize
        ? `${derived.cohortSize - available} of ${derived.cohortSize} managers were unreachable; percentages are out of ${available}.`
        : null,
    chips: derived.chips,
    consensus: derived.consensus,
    cohortName: cohort?.notes ?? null,
    fields: [...ELITE_DERIVED_FIELDS],
    players,
  });
}
