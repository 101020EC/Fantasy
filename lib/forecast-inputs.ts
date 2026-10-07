import { getAdminDb } from './firebase-admin';
import { analystPaths } from './analyst-store';
import { gwDocId } from './analyst';
import { PlayerPriors, PlayerStatsGameweek } from './player-stats';
import { SeasonFixtures } from './fixtures-store';
import { FeatureInputs } from './feature-builder';
import { Calibration, EliteDerivedGameweek, FPLBootstrap } from './types';

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
async function loadMarketBefore(deadline: string | null, memo?: ReadMemo) {
  const db = getAdminDb();
  // No snapshot is dated in the future, so for a deadline after today "before
  // the deadline" and "before tomorrow" select the same document. Keying the
  // memo that way lets several upcoming gameweeks share one read.
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const before = deadline ? [deadline.slice(0, 10), tomorrow].sort()[0] : null;
  const snap = await readOnce(memo, `market<${before ?? 'any'}`, () =>
    before
      ? db.collection('market').where('date', '<', before).orderBy('date', 'desc').limit(1).get()
      : db.collection('market').orderBy('date', 'desc').limit(1).get()
  );
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return { date: String(d.date), players: d.players ?? {}, fields: d.fields ?? [] };
}

/**
 * Reads shared by several loadFeatureInputs calls in one request — a
 * multi-gameweek forecast asks for the same fixtures, priors, market and
 * overlapping playerStats once per gameweek. Create one per request with
 * `new Map()`; it is never kept across requests, so nothing goes stale.
 *
 * Snapshots are shared, not the data: every caller still gets its own object
 * from `.data()`, so one gameweek's inputs cannot mutate another's.
 */
export type ReadMemo = Map<string, Promise<any>>;

function readOnce<T>(memo: ReadMemo | undefined, key: string, read: () => Promise<T>): Promise<T> {
  if (!memo) return read();
  if (!memo.has(key)) memo.set(key, read());
  return memo.get(key) as Promise<T>;
}

export async function loadFeatureInputs(
  bootstrap: FPLBootstrap,
  season: string,
  targetGameweek: number,
  opts: { includeElite?: boolean; window?: number; memo?: ReadMemo } = {}
): Promise<FeatureInputs> {
  const db = getAdminDb();
  const window = opts.window ?? 6;
  const memo = opts.memo;
  const get = (ref: FirebaseFirestore.DocumentReference) => readOnce(memo, ref.path, () => ref.get());

  // Only gameweeks strictly before the target are even requested. The guard in
  // assertNoLookahead is a backstop; not asking is the mechanism.
  const wanted: number[] = [];
  for (let gw = Math.max(1, targetGameweek - window); gw < targetGameweek; gw++) wanted.push(gw);

  const deadline =
    bootstrap.events.find((e) => e.id === targetGameweek)?.deadline_time ?? null;

  const calibrationRef = db
    .doc(analystPaths.forecastCalibration(season))
    .collection('gameweeks')
    .doc(gwDocId(targetGameweek));

  const statsParent = db.doc(analystPaths.playerStats(season)).collection('gameweeks');
  const eliteParent = db.doc(analystPaths.eliteCohort(season)).collection('derived');

  const [statDocs, eliteDocs, fixturesSnap, market, priorsSnap, calibrationSnap] = await Promise.all([
    Promise.all(wanted.map((gw) => get(statsParent.doc(gwDocId(gw))))),
    opts.includeElite
      ? Promise.all(wanted.map((gw) => get(eliteParent.doc(gwDocId(gw)))))
      : Promise.resolve([]),
    get(db.doc(analystPaths.fixtures(season))),
    loadMarketBefore(deadline, memo),
    get(db.doc(analystPaths.playerPriors(season))),
    // The document stored FOR this gameweek, which was fitted only on earlier
    // ones. Reading a single latest-wins document instead would hand a replay of
    // GW5 the factors fitted on GW5 onward.
    calibrationRef.get(),
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
    calibration: calibrationSnap.exists ? (calibrationSnap.data() as Calibration) : null,
  };
}
