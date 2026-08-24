import { GameweekForecast } from './types';
import { FPLBootstrap } from './types';
import { EliteDerivedGameweek } from './types';

/**
 * Turns a computed forecast into a prompt, and checks what comes back.
 *
 * The division of labour is strict and structural, not a matter of prompt
 * politeness: every number originates in lib/forecast-engine.ts, and the model
 * is given those numbers and asked for sentences. It is never asked what a
 * player will score.
 *
 * The reason is not stylistic. A projection from a language model cannot be
 * reproduced, backtested, or improved on evidence — it would quietly destroy
 * the only thing that makes this project checkable.
 */

export interface AnalysisPlayer {
  name: string;
  team: string;
  position: string;
  cost: number;
  xPts: number;
  floor: number;
  ceiling: number;
  minutesProb: number;
  epNext: number | null;
  opponent?: string;
  isHome?: boolean;
  /** Elite Cohort context, when captured. Never used to produce a number. */
  eliteOwnedOf?: string;
  eliteCaptainedOf?: string;
}

export interface AnalysisContext {
  gameweek: number;
  season: string;
  model: string;
  qualityFlags: string[];
  top: AnalysisPlayer[];
  squad?: AnalysisPlayer[];
  cohortNote?: string;
}

const POSITIONS = ['', 'GKP', 'DEF', 'MID', 'FWD'];

export function buildAnalysisContext(
  forecast: GameweekForecast,
  bootstrap: FPLBootstrap,
  opts: {
    topN?: number;
    squadElementIds?: number[];
    elite?: EliteDerivedGameweek | null;
    fixtureByClub?: Map<number, { opponent: number; isHome: boolean }[]>;
  } = {}
): AnalysisContext {
  const topN = opts.topN ?? 12;
  const elements = new Map(bootstrap.elements.map((e) => [e.id, e]));
  const teams = new Map(bootstrap.teams.map((t) => [t.id, t.short_name]));
  const elite = opts.elite ?? null;
  const eliteIndex = (name: string) => (elite ? elite.fields.indexOf(name) : -1);

  const toPlayer = (id: number): AnalysisPlayer | null => {
    const el = elements.get(id);
    const p = forecast.predictions[String(id)];
    if (!el || !p) return null;

    const fixtures = opts.fixtureByClub?.get(el.team) ?? [];
    const first = fixtures[0];

    const out: AnalysisPlayer = {
      name: el.web_name,
      team: teams.get(el.team) ?? '',
      position: POSITIONS[el.element_type] ?? '',
      cost: el.now_cost / 10,
      xPts: p.xPts,
      floor: p.floor,
      ceiling: p.ceiling,
      minutesProb: p.minutesProb,
      epNext: el.ep_next ? Number(el.ep_next) : null,
      opponent: first ? teams.get(first.opponent) ?? '' : undefined,
      isHome: first?.isHome,
    };

    // Counts, expressed as "12 of 18", so the model never has to divide —
    // and so a reader can see the denominator that a percentage would hide.
    if (elite && elite.availableManagerCount > 0) {
      const counts = elite.players[String(id)];
      if (counts) {
        const owned = counts[eliteIndex('owned')] ?? 0;
        const capped = counts[eliteIndex('captained')] ?? 0;
        if (owned > 0) out.eliteOwnedOf = `${owned} of ${elite.availableManagerCount}`;
        if (capped > 0) out.eliteCaptainedOf = `${capped} of ${elite.availableManagerCount}`;
      }
    }
    return out;
  };

  const top = Object.keys(forecast.predictions)
    .map(Number)
    .map(toPlayer)
    .filter((p): p is AnalysisPlayer => p !== null && p.minutesProb > 0.25)
    .sort((a, b) => b.xPts - a.xPts)
    .slice(0, topN);

  const squad = opts.squadElementIds
    ?.map(toPlayer)
    .filter((p): p is AnalysisPlayer => p !== null)
    .sort((a, b) => b.xPts - a.xPts);

  return {
    gameweek: forecast.gameweek,
    season: forecast.season,
    model: forecast.model,
    qualityFlags: forecast.qualityFlags,
    top,
    squad,
    cohortNote: elite
      ? `Elite Cohort: ${elite.availableManagerCount} of ${elite.cohortSize} managers captured for GW${elite.sourceGameweek}.`
      : undefined,
  };
}

const FLAG_MEANING: Record<string, string> = {
  no_player_history: 'no gameweek has been finalised yet, so projections rest on last season alone',
  short_player_history: 'fewer than six finalised gameweeks, so fringe players are over-projected',
  no_fixtures: 'no stored fixture list, so opponent difficulty was not applied',
  no_market_snapshot: 'no market snapshot before the deadline, so availability is assumed',
  no_prior_season: 'no prior-season data for some players',
  no_elite_data: 'no Elite Cohort data available',
  stale_elite_data: 'the Elite Cohort data was too old to use and was dropped',
  low_cohort_availability: 'part of the Elite Cohort could not be reached',
  high_chip_volatility: 'many cohort managers played a chip, so their squad changes reflect that, not a trend',
};

export const SYSTEM_PROMPT = `You are an analyst who explains Fantasy Premier League projections that have ALREADY been calculated.

Absolute rules:
- Never invent, estimate, adjust, or predict a number. Every figure you use must appear verbatim in the data given to you.
- If asked something the data does not answer, say the data does not cover it.
- Never state a projection of your own. The numbers are the model's; your job is to say what drives them and where they are weak.
- Elite Cohort figures describe roughly twenty selected managers. Call it the Elite Cohort, never "the top 1k" and never "everyone". Describe it as what those managers did, not as what is correct.
- Respect the stated caveats. If the data says projections are unreliable, say so plainly rather than writing around it.

Style: direct and specific. Short paragraphs, no headings, no bullet lists unless comparing three or more players. Do not open by restating the question. British English.`;

export function buildUserPrompt(ctx: AnalysisContext, question?: string): string {
  const lines: string[] = [];
  lines.push(`Gameweek ${ctx.gameweek}, season ${ctx.season}. Model: ${ctx.model}.`);

  if (ctx.qualityFlags.length) {
    lines.push(
      `Known weaknesses in this forecast: ${ctx.qualityFlags
        .map((f) => FLAG_MEANING[f] ?? f)
        .join('; ')}.`
    );
  }
  if (ctx.cohortNote) lines.push(ctx.cohortNote);

  const fmt = (p: AnalysisPlayer) => {
    const bits = [
      `${p.name} (${p.team}, ${p.position}, £${p.cost.toFixed(1)}m)`,
      `xPts ${p.xPts.toFixed(2)}`,
      `range ${p.floor.toFixed(2)} to ${p.ceiling.toFixed(2)}`,
      `expected minutes share ${p.minutesProb.toFixed(2)}`,
    ];
    if (p.opponent) bits.push(`opponent ${p.opponent} ${p.isHome ? 'at home' : 'away'}`);
    if (p.epNext !== null) bits.push(`FPL's own projection ${p.epNext.toFixed(2)}`);
    if (p.eliteOwnedOf) bits.push(`owned by ${p.eliteOwnedOf} elite managers`);
    if (p.eliteCaptainedOf) bits.push(`captained by ${p.eliteCaptainedOf}`);
    return `- ${bits.join('; ')}`;
  };

  lines.push('', 'Highest projected players:', ...ctx.top.map(fmt));

  if (ctx.squad?.length) {
    lines.push('', "The manager's current squad:", ...ctx.squad.map(fmt));
  }

  lines.push(
    '',
    question?.trim()
      ? `Question: ${question.trim()}`
      : ctx.squad?.length
        ? 'Explain what this forecast implies for the squad: where its points are expected to come from, which picks look weakest and why, and what the caveats mean for acting on it. Around 200 words.'
        : 'Explain what stands out in this forecast: which players the model rates and what drives it, where it disagrees with FPL, and what the caveats mean. Around 180 words.'
  );

  return lines.join('\n');
}

/**
 * Checks that the model did not invent figures.
 *
 * Only decimals are checked, and that is the point: the projections are
 * decimals, while integers in prose are almost always ranks, counts or
 * gameweek numbers ("3 of the top 5", "GW2"). Checking integers would produce
 * constant false positives and train everyone to ignore the warning.
 *
 * A finding is surfaced, not suppressed — the caller decides. Silently
 * deleting a sentence would hide exactly the failure worth knowing about.
 */
export function findUngroundedNumbers(response: string, ctx: AnalysisContext): string[] {
  const grounded = new Set<string>();
  const add = (n: number | null | undefined) => {
    if (n === null || n === undefined || Number.isNaN(n)) return;
    grounded.add(n.toFixed(2));
    grounded.add(n.toFixed(1));
    grounded.add(String(n));
  };

  for (const p of [...ctx.top, ...(ctx.squad ?? [])]) {
    add(p.xPts); add(p.floor); add(p.ceiling); add(p.minutesProb); add(p.epNext); add(p.cost);
  }

  const found = response.match(/\d+\.\d+/g) ?? [];
  const bad = new Set<string>();
  for (const raw of found) {
    const n = Number(raw);
    if (grounded.has(raw) || grounded.has(n.toFixed(1)) || grounded.has(n.toFixed(2))) continue;
    bad.add(raw);
  }
  return [...bad];
}
