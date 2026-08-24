import { getAdminDb } from './firebase-admin';
import { analystPaths } from './analyst-store';
import { gwDocId } from './analyst';
import { PlayerPriors, PlayerStatsGameweek } from './player-stats';
import { SeasonFixtures } from './fixtures-store';
import { FeatureInputs } from './feature-builder';
import { EliteDerivedGameweek, FPLBootstrap } from './types';

/**
 * Loads everything a forecast needs out of Firestore.
 *
 * Separate from lib/feature-builder.ts on purpose: the builder is pure and
 * testable without a database, and all the I/O lives here where it can be
 * counted. Loading one gameweek is one document read, which is the whole reason
 * the analyst collections are partitioned by gameweek.
 */

/**
 * The market snapshot to describe the world as it was before a deadline.
 *
 * Picks the most recent capture strictly BEFORE the deadline. A snapshot taken
 * after it already reflects transfers made once line-ups were known, which is
 * look-ahead however innocent it looks — assertNoLookahead will reject it, so
 * this selects correctly rather than leaving the guard to fail the run.
 */
async function loadMarketBefore(deadline: string | null) {
  const db = getAdminDb();
  let query = db.collection('market').orderBy('date', 'desc').limit(1);
  if (deadline) {
    query = db
      .collection('market')
      .where('date', '<', deadline.slice(0, 10))
      .orderBy('date', 'desc')
      .limit(1);
  }
  const snap = await query.get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return { date: String(d.date), players: d.players ?? {}, fields: d.fields ?? [] };
}

export async function loadFeatureInputs(
  bootstrap: FPLBootstrap,
  season: string,
  targetGameweek: number,
  opts: { includeElite?: boolean; window?: number } = {}
): Promise<FeatureInputs> {
  const db = getAdminDb();
  const window = opts.window ?? 6;

  // Only gameweeks strictly before the target are even requested. The guard in
  // assertNoLookahead is a backstop; not asking is the mechanism.
  const wanted: number[] = [];
  for (let gw = Math.max(1, targetGameweek - window); gw < targetGameweek; gw++) wanted.push(gw);

  const deadline =
    bootstrap.events.find((e) => e.id === targetGameweek)?.deadline_time ?? null;

  const statsParent = db.doc(analystPaths.playerStats(season)).collection('gameweeks');
  const eliteParent = db.doc(analystPaths.eliteCohort(season)).collection('derived');

  const [statDocs, eliteDocs, fixturesSnap, market, priorsSnap] = await Promise.all([
    Promise.all(wanted.map((gw) => statsParent.doc(gwDocId(gw)).get())),
    opts.includeElite
      ? Promise.all(wanted.map((gw) => eliteParent.doc(gwDocId(gw)).get()))
      : Promise.resolve([]),
    db.doc(analystPaths.fixtures(season)).get(),
    loadMarketBefore(deadline),
    db.doc(analystPaths.playerPriors(season)).get(),
  ]);

  const playerStats = new Map<number, PlayerStatsGameweek>();
  for (const doc of statDocs) {
    if (doc.exists) {
      const d = doc.data() as PlayerStatsGameweek;
      playerStats.set(d.gameweek, d);
    }
  }

  const eliteDerived = new Map<number, EliteDerivedGameweek>();
  for (const doc of eliteDocs) {
    if (doc.exists) {
      const d = doc.data() as EliteDerivedGameweek;
      eliteDerived.set(d.gameweek, d);
    }
  }

  return {
    season,
    targetGameweek,
    targetDeadline: deadline,
    bootstrap,
    playerStats,
    fixtures: fixturesSnap.exists ? (fixturesSnap.data() as SeasonFixtures) : null,
    market,
    eliteDerived,
    priors: priorsSnap.exists ? (priorsSnap.data() as PlayerPriors) : null,
  };
}
