import { row } from './analyst';
import { FPLFixture } from './types';

/**
 * The season's fixture list, persisted.
 *
 * The app already fetches /fixtures/ for the team pitch but never stores it,
 * which is fine for display and wrong for backtesting: a forecast made at GW7
 * has to be reproducible later using only what was known then, and FDR is
 * revised during a season. One ~60KB document per season, rewritten daily.
 */

export const FIXTURE_FIELDS = [
  'event', 'kickoff_time', 'team_h', 'team_a',
  'team_h_difficulty', 'team_a_difficulty',
  'team_h_score', 'team_a_score', 'started', 'finished',
] as const;

type Cell = string | number | boolean | null;

export interface SeasonFixtures {
  season: string;
  updatedAt: string;
  fixtureCount: number;
  fields: string[];
  /** fixture id -> values in `fields` order */
  fixtures: Record<string, Cell[]>;
  /** gameweek -> club id -> number of fixtures. Blank = 0, double = 2. */
  fixtureCounts: Record<string, Record<string, number>>;
}

/**
 * `fixtureCounts` is what lets a reader tell a blank gameweek from missing data,
 * and tell a double from a normal week. Elite ownership in a double means
 * something different from a normal week (Addendum 1 §E), and this is how the
 * derived layer knows which it is looking at without re-reading every fixture.
 */
export function buildSeasonFixtures(
  season: string,
  fixtures: FPLFixture[],
  now: Date = new Date()
): SeasonFixtures {
  const out: Record<string, Cell[]> = {};
  const counts: Record<string, Record<string, number>> = {};

  for (const f of fixtures) {
    out[String(f.id)] = row(f, FIXTURE_FIELDS);
    if (f.event === null) continue; // not yet scheduled
    const gw = String(f.event);
    counts[gw] ??= {};
    for (const club of [f.team_h, f.team_a]) {
      counts[gw][String(club)] = (counts[gw][String(club)] ?? 0) + 1;
    }
  }

  return {
    season,
    updatedAt: now.toISOString(),
    fixtureCount: fixtures.length,
    fields: [...FIXTURE_FIELDS],
    fixtures: out,
    fixtureCounts: counts,
  };
}
