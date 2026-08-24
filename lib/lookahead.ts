import { FeatureSet, LookaheadError } from './types';

/**
 * Refuses a feature set that contains information from the target gameweek or
 * later.
 *
 * This is the single most likely way for the whole project to produce a
 * convincing false result, so it throws rather than warning or filtering.
 *
 * The trap is specific: elite picks for gameweek N become public only AFTER the
 * N deadline, but a forecast is only useful BEFORE it. A backtest that reads
 * derived/gw_N while predicting N scores beautifully and means nothing, because
 * elite ownership and high points are both downstream of the same information.
 * The same applies to playerStats from N — that is the answer sheet — and to a
 * market snapshot captured after the deadline, which already reflects the
 * transfers the crowd made once teams were known, and to a calibration factor
 * fitted on N, which is the answer sheet reduced to a single multiplier.
 *
 * Called at the END of buildFeatures() and again at the START of forecast(),
 * so a hand-assembled feature set still cannot get past the second gate.
 */
export function assertNoLookahead(fs: FeatureSet): void {
  const T = fs.targetGameweek;
  const bad: string[] = [];

  for (const gw of fs.sources.playerStats) {
    if (gw >= T) bad.push(`playerStats gw_${gw}`);
  }
  for (const gw of fs.sources.elite) {
    if (gw >= T) bad.push(`elite gw_${gw}`);
  }
  // Calibration is fitted on realised results, which makes it the most direct
  // route to the answer sheet in the whole pipeline: a factor fitted on GW8 and
  // applied to GW8 knows how GW8 turned out.
  for (const gw of fs.sources.calibration) {
    if (gw >= T) bad.push(`calibration gw_${gw}`);
  }

  // A market snapshot is dated, not numbered: anything captured at or after the
  // deadline is already contaminated by knowledge of the deadline.
  if (fs.targetDeadline) {
    for (const date of fs.sources.market) {
      if (date >= fs.targetDeadline.slice(0, 10)) bad.push(`market ${date}`);
    }
  }

  if (bad.length) {
    throw new LookaheadError(
      `Feature set for GW${T} contains information from GW${T} or later: ${bad.join(', ')}. ` +
        `A forecast may only use data that existed before the GW${T} deadline.`
    );
  }
}
