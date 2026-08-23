export interface FPLElement {
  id: number;
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
  event: number;
  finished: boolean;
  kickoff_time: string;
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
}
