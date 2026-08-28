import { getAdminDb } from './firebase-admin';
import { gwDocId } from './analyst';
import { SeasonFixtures } from './fixtures-store';
import { PlayerPriors, PlayerStatsGameweek } from './player-stats';
import {
  EliteCohort,
  EliteDerivedGameweek,
  EliteGameweekSnapshot,
  Calibration,
  GameweekAccuracy,
  GameweekForecast,
} from './types';

/**
 * Firestore access for the analyst collections. Nothing here touches an
 * existing collection — teams/, leagues/, market/, players/, settings/,
 * watchlists/ and notifications/ are read and written only by the code that
 * already owned them.
 *
 * Every parent document is written WITH DATA. A parent that holds only
 * subcollections is invisible to a collection query and needs listDocuments()
 * to find at all — the trap app/api/market/status/route.ts already documents
 * for leagues/{id}. Writing the parent avoids it entirely.
 */

export const analystPaths = {
  playerStats: (season: string) => `playerStats/${season}`,
  playerPriors: (season: string) => `playerPriors/${season}`,
  fixtures: (season: string) => `fixtures/${season}`,
  eliteCohort: (season: string) => `eliteCohort/${season}`,
  forecasts: (season: string) => `forecasts/${season}`,
  forecastAccuracy: (season: string) => `forecastAccuracy/${season}`,
  forecastCalibration: (season: string) => `forecastCalibration/${season}`,
};

export async function writeSeasonFixtures(doc: SeasonFixtures): Promise<void> {
  await getAdminDb().doc(analystPaths.fixtures(doc.season)).set(doc);
}

export async function readSeasonFixtures(season: string): Promise<SeasonFixtures | null> {
  const snap = await getAdminDb().doc(analystPaths.fixtures(season)).get();
  return snap.exists ? (snap.data() as SeasonFixtures) : null;
}

export async function writePlayerStats(doc: PlayerStatsGameweek): Promise<void> {
  const db = getAdminDb();
  const parent = db.doc(analystPaths.playerStats(doc.season));
  const batch = db.batch();
  batch.set(
    parent,
    { season: doc.season, updatedAt: doc.capturedAt, lastGameweek: doc.gameweek },
    { merge: true }
  );
  batch.set(parent.collection('gameweeks').doc(gwDocId(doc.gameweek)), doc);
  await batch.commit();
}

/**
 * Gameweeks already stored and final. The capture skips these, which is what
 * makes a retry, a redeploy or a manual trigger safe.
 */
export async function storedPlayerStatGameweeks(season: string): Promise<number[]> {
  const snap = await getAdminDb()
    .doc(analystPaths.playerStats(season))
    .collection('gameweeks')
    .select('gameweek', 'dataChecked')
    .get();
  return snap.docs
    .filter((d) => d.data().dataChecked)
    .map((d) => Number(d.data().gameweek))
    .sort((a, b) => a - b);
}

export async function writePlayerPriors(doc: PlayerPriors): Promise<void> {
  await getAdminDb().doc(analystPaths.playerPriors(doc.season)).set(doc);
}

export async function readPlayerPriors(season: string): Promise<PlayerPriors | null> {
  const snap = await getAdminDb().doc(analystPaths.playerPriors(season)).get();
  return snap.exists ? (snap.data() as PlayerPriors) : null;
}

export async function writeEliteCohort(cohort: EliteCohort): Promise<void> {
  await getAdminDb().doc(analystPaths.eliteCohort(cohort.season)).set(cohort, { merge: true });
}

export async function readEliteCohort(season: string): Promise<EliteCohort | null> {
  const snap = await getAdminDb().doc(analystPaths.eliteCohort(season)).get();
  return snap.exists ? (snap.data() as EliteCohort) : null;
}

/**
 * Raw snapshot and derived signals in one batch, kept in separate
 * subcollections. Raw is never rewritten once final; derived can be recomputed
 * from it whenever a formula changes, with no re-capture and no migration.
 */
export async function writeEliteGameweek(
  snapshot: EliteGameweekSnapshot,
  derived: EliteDerivedGameweek
): Promise<void> {
  const db = getAdminDb();
  const parent = db.doc(analystPaths.eliteCohort(snapshot.season));
  const batch = db.batch();
  batch.set(parent, { season: snapshot.season, updatedAt: snapshot.capturedAt }, { merge: true });
  batch.set(parent.collection('gameweeks').doc(gwDocId(snapshot.gameweek)), snapshot);
  batch.set(parent.collection('derived').doc(gwDocId(derived.gameweek)), derived);
  await batch.commit();
}

export async function readEliteDerived(
  season: string,
  gameweek: number
): Promise<EliteDerivedGameweek | null> {
  const snap = await getAdminDb()
    .doc(analystPaths.eliteCohort(season))
    .collection('derived')
    .doc(gwDocId(gameweek))
    .get();
  return snap.exists ? (snap.data() as EliteDerivedGameweek) : null;
}

export async function readEliteSnapshot(
  season: string,
  gameweek: number
): Promise<EliteGameweekSnapshot | null> {
  const snap = await getAdminDb()
    .doc(analystPaths.eliteCohort(season))
    .collection('gameweeks')
    .doc(gwDocId(gameweek))
    .get();
  return snap.exists ? (snap.data() as EliteGameweekSnapshot) : null;
}

export async function readForecast(
  season: string,
  gameweek: number
): Promise<GameweekForecast | null> {
  const snap = await getAdminDb()
    .doc(analystPaths.forecasts(season))
    .collection('gameweeks')
    .doc(gwDocId(gameweek))
    .get();
  return snap.exists ? (snap.data() as GameweekForecast) : null;
}

/**
 * Calibration is stored per gameweek, not as one current document.
 *
 * A single latest-wins document would be refitted every week, and a backtest
 * replaying GW5 would then apply factors fitted on GW5 through GW11. That leak
 * is invisible in the output and flatters every number. Storing the factors that
 * were usable when forecasting each gameweek makes the replay honest and leaves
 * an audit trail of how the correction moved.
 */
export async function readCalibration(
  season: string,
  gameweek: number
): Promise<Calibration | null> {
  const snap = await getAdminDb()
    .doc(analystPaths.forecastCalibration(season))
    .collection('gameweeks')
    .doc(gwDocId(gameweek))
    .get();
  return snap.exists ? (snap.data() as Calibration) : null;
}

/** `gameweek` is the gameweek these factors may be USED for, not fitted from. */
export async function writeCalibration(
  doc: Calibration,
  gameweek: number
): Promise<void> {
  const db = getAdminDb();
  const parent = db.doc(analystPaths.forecastCalibration(doc.season));
  const batch = db.batch();
  batch.set(
    parent,
    { season: doc.season, updatedAt: doc.generatedAt, lastGameweek: gameweek },
    { merge: true }
  );
  batch.set(parent.collection('gameweeks').doc(gwDocId(gameweek)), { ...doc, gameweek });
  await batch.commit();
}

export async function writeForecast(doc: GameweekForecast): Promise<void> {
  const db = getAdminDb();
  const parent = db.doc(analystPaths.forecasts(doc.season));
  const batch = db.batch();
  batch.set(
    parent,
    { season: doc.season, updatedAt: doc.generatedAt, lastGameweek: doc.gameweek },
    { merge: true }
  );
  batch.set(parent.collection('gameweeks').doc(gwDocId(doc.gameweek)), doc);
  await batch.commit();
}

export async function writeAccuracy(doc: GameweekAccuracy): Promise<void> {
  const db = getAdminDb();
  const parent = db.doc(analystPaths.forecastAccuracy(doc.season));
  const batch = db.batch();
  batch.set(
    parent,
    { season: doc.season, updatedAt: doc.scoredAt, lastGameweek: doc.gameweek },
    { merge: true }
  );
  batch.set(parent.collection('gameweeks').doc(gwDocId(doc.gameweek)), doc);
  await batch.commit();
}

export async function readAccuracyHistory(season: string): Promise<GameweekAccuracy[]> {
  const snap = await getAdminDb()
    .doc(analystPaths.forecastAccuracy(season))
    .collection('gameweeks')
    .get();
  return snap.docs
    .map((d) => d.data() as GameweekAccuracy)
    .sort((a, b) => a.gameweek - b.gameweek);
}

/**
 * Every gameweek with a snapshot, provisional ones included.
 *
 * `storedEliteGameweeks` deliberately reports only finalised captures, so the
 * cron re-captures a provisional week once FPL data-checks it. This one answers
 * the different question "have we captured this at all yet", which is what stops
 * the provisional pass running again every night for the same week.
 */
export async function storedEliteGameweeksAny(season: string): Promise<number[]> {
  const snap = await getAdminDb()
    .doc(analystPaths.eliteCohort(season))
    .collection('gameweeks')
    .select('gameweek')
    .get();
  return snap.docs.map((d) => Number(d.data().gameweek)).sort((a, b) => a - b);
}

export async function storedEliteGameweeks(season: string): Promise<number[]> {
  const snap = await getAdminDb()
    .doc(analystPaths.eliteCohort(season))
    .collection('gameweeks')
    .select('gameweek', 'dataChecked')
    .get();
  return snap.docs
    .filter((d) => d.data().dataChecked)
    .map((d) => Number(d.data().gameweek))
    .sort((a, b) => a - b);
}
