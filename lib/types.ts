export interface FPLElement {
  id: number;
  /**
   * Stable across seasons, unlike `id`. Cross-season joins must resolve
   * through this — see Risk F-9.
   */
  code: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  team_code: number;
  element_type: number; // 1: GKP, 2: DEF, 3: MID, 4: FWD
  now_cost: number; // in tenths of a million (e.g. 100 = £10.0m)
  cost_change_event: number;
  cost_change_start: number;
  transfers_in_event: number;
  transfers_out_event: number;
  selected_by_percent: string;
  total_points: number;
  event_points: number;
  form: string;
  status: 'a' | 'd' | 'i' | 's' | 'u' | string;
  news: string;
  chance_of_playing_next_round: number | null;
  ep_this: string | null;
  ep_next: string | null;
}

export interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
  code: number;
  strength: number;
  // Attack/defence splits the forecast engine needs for opponent difficulty.
  // The single `strength` above is too coarse to model a fixture with.
  strength_overall_home: number;
  strength_overall_away: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
}

/**
 * Stand-in for a club the bootstrap did not return. Exists so the strength
 * fields only have to be defaulted in one place.
 */
export function placeholderTeam(id = 0, name = 'Unknown', short_name = 'UNK'): FPLTeam {
  return {
    id, name, short_name, code: 0, strength: 3,
    strength_overall_home: 1000, strength_overall_away: 1000,
    strength_attack_home: 1000, strength_attack_away: 1000,
    strength_defence_home: 1000, strength_defence_away: 1000,
  };
}

export interface FPLEvent {
  id: number;
  name: string;
  deadline_time: string;
  is_previous: boolean;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
  data_checked: boolean;
}

export interface FPLElementType {
  id: number;
  plural_name: string;
  plural_name_short: string;
  singular_name: string;
  singular_name_short: string;
}

export interface FPLBootstrap {
  events: FPLEvent[];
  teams: FPLTeam[];
  elements: FPLElement[];
  element_types: FPLElementType[];
}

export interface FPLEntry {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  player_region_name: string;
  summary_overall_points: number;
  summary_overall_rank: number | null;
  summary_event_points: number | null;
  summary_event_rank: number | null;
  current_event: number;
  last_deadline_value: number;
  last_deadline_bank: number;
  last_deadline_total_transfers: number;
}

export interface FPLPick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export interface FPLPicksResponse {
  active_chip: string | null;
  picks: FPLPick[];
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    rank: number | null;
    rank_sort: number | null;
    overall_rank: number | null;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
    points_on_bench: number;
  };
}

export interface FPLFixture {
  id: number;
  code: number;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  team_h_score: number | null;
  team_a_score: number | null;
  event: number | null;
  /** Kicked off. Scores are live from this point — `finished` lags behind. */
  started: boolean;
  finished: boolean;
  kickoff_time: string;
}

export interface SquadFixture {
  event: number;
  opponent: FPLTeam;
  isHome: boolean;
  /** FPL's 1–5 rating from this player's side. */
  difficulty: number;
  started: boolean;
  /** Populated once the match kicks off; the player's team first. */
  scoreFor: number | null;
  scoreAgainst: number | null;
}

export type PriceStatus = 'rising_soon' | 'likely_riser' | 'stable' | 'likely_faller' | 'falling_soon';

export interface PriceAnalysis {
  elementId: number;
  webName: string;
  fullName: string;
  team: FPLTeam;
  elementType: FPLElementType;
  currentCost: number; // in £m (e.g. 10.5)
  costChangeEvent: number;
  transfersInEvent: number;
  transfersOutEvent: number;
  netTransfers: number;
  selectedByPercent: number;
  status: PriceStatus;
  changeScore: number; // -100 to +100 index estimate
  news: string;
  /** FPL's own 0/25/50/75 estimate; always sent alongside a flag. */
  chanceOfPlaying: number | null;
  availability: 'available' | 'doubtful' | 'injured' | 'suspended' | 'unavailable';
}

export interface TeamSquadPlayer {
  pick: FPLPick;
  element: FPLElement;
  team: FPLTeam;
  elementType: FPLElementType;
  priceAnalysis: PriceAnalysis;
  nextFixture?: {
    opponent: FPLTeam;
    isHome: boolean;
    difficulty: number;
  };
  /** This gameweek onward, up to three — a blank week simply yields fewer. */
  fixtures: SquadFixture[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Analyst extension — elite cohort, features, forecasts, scoring.
//
// Naming rule, applied everywhere including UI strings: this is the "Elite
// Cohort", never "Top 1K". It is ~20 self-selected managers whose qualification
// is a PAST season's rank — a small, survivorship-biased, mutually-correlated
// sample. It is evidence about what strong managers did, which is a different
// thing from what was correct.
// ─────────────────────────────────────────────────────────────────────────────

export interface EliteManager {
  managerId: number;
  teamName: string;
  managerName: string;
  region: string;
  addedAt: string;
  /** Why this manager is in the cohort, e.g. "Top 1K 2024/25". Free text. */
  qualification: string;
  priorSeasons: { season: string; rank: number; totalPoints: number }[];
}

export interface EliteCohort {
  season: string;
  /** Managers the cohort is DEFINED to contain. Not the same as availableManagerCount. */
  cohortSize: number;
  managerIds: number[];
  startedAt: string;
  updatedAt: string;
  notes: string;
  managers: Record<string, EliteManager>;
}

/** Attached to every derived artefact. Without it a stored number cannot be trusted later. */
export interface SignalProvenance {
  /** The gameweek the numbers were computed FROM. Must be < any forecast target. */
  sourceGameweek: number;
  generatedAt: string;
  dataChecked: boolean;
  cohortSize: number;
  /** Managers actually captured — the denominator for every percentage. */
  availableManagerCount: number;
  /** Managers absent this gameweek. Never treated as 0% ownership. */
  missing: number[];
  /** Bumped when a formula changes, so stale documents are identifiable. */
  computeVersion: number;
}

type AnalystCell = string | number | boolean | null;

export interface EliteManagerGameweek {
  /** Positional, per the document's entryFields. */
  entry: AnalystCell[];
  /** 15 x pickFields.length, row-major. */
  picks: AnalystCell[];
  /** automatic_subs, flattened per subFields. */
  subs: AnalystCell[];
  /** Transfers made INTO this gameweek, flattened per transferFields. */
  transfers: AnalystCell[];
  activeChip: string | null;
}

/** RAW capture. Immutable once written — the derived layer is what gets recomputed. */
export interface EliteGameweekSnapshot {
  season: string;
  gameweek: number;
  capturedAt: string;
  dataChecked: boolean;
  cohortSize: number;
  availableManagerCount: number;
  missing: number[];
  entryFields: string[];
  pickFields: string[];
  subFields: string[];
  transferFields: string[];
  managers: Record<string, EliteManagerGameweek>;
}

export const ELITE_DERIVED_FIELDS = [
  'owned', 'captained', 'viceCaptained', 'startedXI', 'benched',
  'transferredIn', 'transferredOut', 'ownerCount',
] as const;

/**
 * DERIVED signals. Stores integer COUNTS, never percentages.
 *
 * With 20 managers a percentage is a lossy re-encoding of a small integer, and
 * it goes silently wrong the moment availableManagerCount differs from the value
 * it was computed against: 12/20 = 60.0%, then 11/18 = 61.1% next week — but a
 * stored 11/20 would read 55.0% and show a 6-point drop that never happened.
 * A count stays true forever. pct = count / availableManagerCount at read time.
 */
export interface EliteDerivedGameweek extends SignalProvenance {
  season: string;
  gameweek: number;
  fields: string[];
  /** element id -> counts in `fields` order */
  players: Record<string, number[]>;
  chips: Record<string, number>;
  consensus: {
    captainEntropy: number;
    xiOverlapMean: number;
    uniqueOwnedCount: number;
  };
}

/**
 * In-memory only, never persisted — so changing a definition later needs no
 * migration and no re-capture, only a recompute from the raw snapshots.
 *
 * null means "not computable", NEVER "zero". A gap in capture and "no elite
 * manager owns this player" are different facts and only one is information.
 */
export interface EliteSignals {
  elite_ownership_pct: number | null;
  elite_ownership_change_1gw: number | null;   // percentage points
  elite_ownership_change_3gw: number | null;   // percentage points
  elite_captain_pct: number | null;
  elite_captain_change_1gw: number | null;     // percentage points
  elite_transfer_in_rate: number | null;
  elite_transfer_out_rate: number | null;
  /** Effective elite ownership minus general selected_by_percent, in points. */
  delta_eo: number | null;
  delta_eo_change_1gw: number | null;
  /**
   * (freehit + wildcard) / availableManagerCount. Those chips produce a
   * one-week squad that reverts, so when this is high the change features
   * describe a chip, not a trend.
   */
  chipVolatility: number | null;
}

export interface FeatureSources {
  playerStats: number[];
  elite: number[];
  market: string[];
  fixtures: string;
}

export interface PlayerFeatures {
  elementId: number;
  base: Record<string, number | null>;
  /** Present only when includeElite is true. */
  elite?: EliteSignals;
}

export interface FeatureSet {
  season: string;
  targetGameweek: number;
  includeElite: boolean;
  sources: FeatureSources;
  /** e.g. 'stale_elite_data', 'low_cohort_availability', 'high_chip_volatility' */
  qualityFlags: string[];
  players: PlayerFeatures[];
}

export interface PlayerForecast {
  xPts: number;
  floor: number;
  ceiling: number;
  minutesProb: number;
  confidence: number;
}

export interface GameweekForecast {
  season: string;
  gameweek: number;
  generatedAt: string;
  model: 'base' | 'elite' | 'ep_next';
  computeVersion: number;
  includeElite: boolean;
  featureSources: FeatureSources;
  qualityFlags: string[];
  predictions: Record<string, PlayerForecast>;
}

export interface ModelScore {
  mae: number;
  rmse: number;
  /** Spearman rank correlation — the ordering is what a manager acts on. */
  spearman: number;
  top10Hit: number;
  top20Hit: number;
  n: number;
  computeVersion: number;
}

export interface GameweekAccuracy {
  season: string;
  gameweek: number;
  scoredAt: string;
  /** Declared, and identical across every model variant. */
  population: string;
  n: number;
  models: Partial<Record<'base' | 'elite' | 'ep_next', ModelScore>>;
  /**
   * Manager-level, unlike the player-level scores above — never plot them on
   * one axis. Mean and median both, because one Triple Captain haul drags the
   * mean of 20 managers several points.
   */
  eliteActual: {
    mean: number;
    median: number;
    min: number;
    max: number;
    availableManagerCount: number;
  } | null;
}

export class LookaheadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LookaheadError';
  }
}
