/**
 * The Elite Cohort roster — the source of truth for rebuilding it.
 *
 * The cohort itself lives in Firestore (eliteCohort/{season}), but that document
 * is derived from this list, so keeping the list in the repo means the roster
 * can be rebuilt from scratch and the reason each manager is in it is reviewable.
 *
 * Every entry was resolved against /entry/{id}/ and /entry/{id}/history/ before
 * being written: all 20 exist, and all 20 have at least one Top 1K finish. Best
 * rank and Top-1K count below are as reported by the API on 2026-08-24 and are
 * evidence, not something the code reads — priorSeasons is captured live by
 * buildCohort() so it stays current.
 *
 * A reminder about what this sample is: 20 managers selected on PAST results.
 * That is survivorship bias by construction, they act on the same public
 * information as everyone else, and their choices correlate with each other.
 * It is a consensus signal among strong managers, not ground truth — which is
 * why elite features default to off in the forecast engine.
 */
export interface EliteSeedEntry {
  managerId: number;
  /** Team name at the time of verification, for recognising the row. */
  label: string;
  qualification: string;
}

export const ELITE_COHORT_SEED: EliteSeedEntry[] = [
  { managerId: 47394,  label: 'Ricos Roughnecks',        qualification: 'Top 1K x3 in 18 seasons, best 60' },
  { managerId: 53517,  label: 'Ben Crellin',             qualification: 'Top 1K x1 in 19 seasons, best 550' },
  { managerId: 616,    label: "Mark's Team",             qualification: 'Top 1K x3 in 15 seasons, best 24' },
  { managerId: 16499,  label: 'Andoni’s Wirtzdom',       qualification: 'Top 1K x1 in 12 seasons, best 504' },
  { managerId: 806,    label: 'Taken Quickly Origi',     qualification: 'Top 1K x2 in 11 seasons, best 155' },
  { managerId: 18203,  label: 'De Wahlistiske',          qualification: 'Top 1K x2 in 17 seasons, best 473' },
  { managerId: 25452,  label: "The duke's army",         qualification: 'Top 1K x3 in 13 seasons, best 359' },
  { managerId: 6098,   label: 'Hill 16 Salalahhh',       qualification: 'Top 1K x1 in 15 seasons, best 379' },
  { managerId: 881,    label: '100% AI rating',          qualification: 'Top 1K x2 in 19 seasons, best 123' },
  { managerId: 515217, label: 'NASL All-Stars',          qualification: 'Top 1K x1 in 16 seasons, best 440' },
  { managerId: 2086,   label: 'The Prodigious Ones',     qualification: 'Top 1K x1 in 17 seasons, best 339' },
  { managerId: 82578,  label: 'DanNistelrooy',           qualification: 'Top 1K x1 in 17 seasons, best 44' },
  { managerId: 179777, label: '@FPL_Barbossa',           qualification: 'Top 1K x2 in 8 seasons, best 291' },
  { managerId: 485455, label: 'Uz Ray',                  qualification: 'Top 1K x1 in 10 seasons, best 968' },
  { managerId: 9267,   label: 'WeDontTalkAboutBruno',    qualification: 'Top 1K x2 in 6 seasons, best 62' },
  { managerId: 19797,  label: 'DubraLocoMoSonWijMee',    qualification: 'Top 1K x1 in 12 seasons, best 66' },
  { managerId: 22493,  label: 'Yoro Wizard Bruno',       qualification: 'Top 1K x1 in 8 seasons, best 41' },
  { managerId: 41,     label: "Let's Talk FPL (Andy)",   qualification: 'Top 1K x1 in 16 seasons, best 588' },
  { managerId: 5133,   label: 'The Malouda Triangle (BigMan Bakar)', qualification: 'Top 1K x2 in 16 seasons, best 4' },
  { managerId: 252,    label: 'Sutherns Comfort',        qualification: 'Top 1K x4 in 20 seasons, best 42' },
];

export const ELITE_COHORT_IDS = ELITE_COHORT_SEED.map((m) => m.managerId);

export const ELITE_COHORT_QUALIFICATIONS: Record<string, string> = Object.fromEntries(
  ELITE_COHORT_SEED.map((m) => [String(m.managerId), m.qualification])
);
