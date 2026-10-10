/**
 * Head-to-head category leagues (Yahoo's default league type). A week is won category by
 * category, not on total points, so the planner's single "value per game" has to weigh each
 * counted category equally. One standard deviation of a category's per-game rate among regular
 * NHL players is worth the same in every category (the z-score idea behind category rankings).
 * Rate stats (GAA, SV%) are measured against a league-average start, so playing a goalie is
 * never a minus by itself — only playing him badly is.
 */

import type { CategoryKey, FantasyTeam, ScoringWeights } from '../../types/fantasy';

export interface CategoryDef {
  key: CategoryKey;
  /** Column label, as the host apps print it. */
  short: string;
  label: string;
  goalie: boolean;
}

/** Every category PuckIQ can count from a box score, in the order the host apps list them. */
export const CATEGORIES: CategoryDef[] = [
  { key: 'goals', short: 'G', label: 'Goals', goalie: false },
  { key: 'assists', short: 'A', label: 'Assists', goalie: false },
  { key: 'points', short: 'P', label: 'Points', goalie: false },
  { key: 'plusMinus', short: '+/-', label: 'Plus/minus', goalie: false },
  { key: 'ppp', short: 'PPP', label: 'Power-play points', goalie: false },
  { key: 'shots', short: 'SOG', label: 'Shots on goal', goalie: false },
  { key: 'hits', short: 'HIT', label: 'Hits', goalie: false },
  { key: 'blocks', short: 'BLK', label: 'Blocks', goalie: false },
  { key: 'wins', short: 'W', label: 'Wins', goalie: true },
  { key: 'gaa', short: 'GAA', label: 'Goals-against average', goalie: true },
  { key: 'savePct', short: 'SV%', label: 'Save percentage', goalie: true },
  { key: 'saves', short: 'SV', label: 'Saves', goalie: true },
  { key: 'shutouts', short: 'SO', label: 'Shutouts', goalie: true },
];

const BY_KEY = new Map(CATEGORIES.map((category) => [category.key, category]));

export function isCategoryLeague(team: Pick<FantasyTeam, 'format'> | null | undefined): boolean {
  return team?.format === 'categories';
}

/** Has anyone said how this league scores? Teams set up before category leagues existed haven't. */
export function leagueFormatChosen(team: Pick<FantasyTeam, 'format'>): boolean {
  return team.format !== undefined;
}

/** Yahoo's default head-to-head categories (help.yahoo.com/kb/SLN6815, checked 2026-10-10). */
export const YAHOO_DEFAULT_CATEGORIES: CategoryKey[] = ['goals', 'assists', 'plusMinus', 'ppp', 'shots', 'hits', 'wins', 'gaa', 'savePct', 'shutouts'];

/**
 * Spread of each skater stat per game: the standard deviation of the per-game rate among the
 * 130 forwards and 70 defensemen with the most ice time per game in 2025-26 (30+ games).
 */
const SKATER_SPREAD = {
  goals: 0.15,
  assists: 0.186,
  points: 0.288,
  plusMinus: 0.226,
  ppp: 0.139,
  shots: 0.672,
  hits: 0.615,
  blocks: 0.556,
} as const;

/** The same per start among the 61 goalies with 20+ starts in 2025-26. */
const GOALIE_SPREAD = { wins: 0.104, shutouts: 0.0357, saves: 2.18, goalsAgainst: 0.373, savePct: 0.0124 } as const;
/** League-average start in that group: what the rate categories are measured against. */
const AVERAGE_START = { goalsAgainst: 2.905, saves: 24.85, shotsAgainst: 27.75, savePct: 0.8954 } as const;

/** What one standard deviation is worth. Half a unit lands a typical skater game near 5 — the scale of a points league. */
const CATEGORY_UNIT = 0.5;

/** Each category as per-stat weights, so a category league reuses the points machinery unchanged. */
const CATEGORY_WEIGHTS: Record<CategoryKey, Partial<ScoringWeights>> = {
  goals: { goals: CATEGORY_UNIT / SKATER_SPREAD.goals },
  assists: { assists: CATEGORY_UNIT / SKATER_SPREAD.assists },
  points: { goals: CATEGORY_UNIT / SKATER_SPREAD.points, assists: CATEGORY_UNIT / SKATER_SPREAD.points },
  plusMinus: { plusMinus: CATEGORY_UNIT / SKATER_SPREAD.plusMinus },
  ppp: { ppp: CATEGORY_UNIT / SKATER_SPREAD.ppp },
  shots: { shots: CATEGORY_UNIT / SKATER_SPREAD.shots },
  hits: { hits: CATEGORY_UNIT / SKATER_SPREAD.hits },
  blocks: { blocks: CATEGORY_UNIT / SKATER_SPREAD.blocks },
  wins: { wins: CATEGORY_UNIT / GOALIE_SPREAD.wins },
  shutouts: { shutouts: CATEGORY_UNIT / GOALIE_SPREAD.shutouts },
  saves: { saves: CATEGORY_UNIT / GOALIE_SPREAD.saves },
  // (average GA − GA) / spread: each goal against costs, and a start's worth of saves pays back
  // the average start's goals against, so a league-average start nets zero.
  gaa: {
    goalsAgainst: -CATEGORY_UNIT / GOALIE_SPREAD.goalsAgainst,
    saves: (CATEGORY_UNIT * AVERAGE_START.goalsAgainst) / GOALIE_SPREAD.goalsAgainst / AVERAGE_START.saves,
  },
  // (SV% − average) / spread, linearised over an average start's shots: saves add, goals cost,
  // and they cancel at the league-average save percentage.
  savePct: {
    saves: (CATEGORY_UNIT * (1 - AVERAGE_START.savePct)) / (GOALIE_SPREAD.savePct * AVERAGE_START.shotsAgainst),
    goalsAgainst: (-CATEGORY_UNIT * AVERAGE_START.savePct) / (GOALIE_SPREAD.savePct * AVERAGE_START.shotsAgainst),
  },
};

const ZERO_WEIGHTS: ScoringWeights = {
  goals: 0,
  assists: 0,
  ppp: 0,
  shots: 0,
  hits: 0,
  blocks: 0,
  plusMinus: 0,
  wins: 0,
  saves: 0,
  goalsAgainst: 0,
  shutouts: 0,
};

/** Weights are stored to the thousandth; finer than that changes no ranking. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The planner's weights for a league that counts these categories (and nothing else). */
export function categoryWeights(categories: CategoryKey[]): ScoringWeights {
  const out = { ...ZERO_WEIGHTS };
  for (const key of new Set(categories)) {
    for (const [stat, weight] of Object.entries(CATEGORY_WEIGHTS[key] ?? {}) as [keyof ScoringWeights, number][]) {
      out[stat] += weight;
    }
  }
  for (const stat of Object.keys(out) as (keyof ScoringWeights)[]) out[stat] = round3(out[stat]);
  return out;
}

/** Known categories only, once each, in catalog order. An empty list falls back to Yahoo's defaults. */
export function sanitizeCategories(raw: unknown): CategoryKey[] {
  const wanted = new Set(Array.isArray(raw) ? raw : []);
  const out = CATEGORIES.filter((category) => wanted.has(category.key)).map((category) => category.key);
  return out.length > 0 ? out : [...YAHOO_DEFAULT_CATEGORIES];
}

export function categoryDef(key: CategoryKey): CategoryDef {
  return BY_KEY.get(key)!;
}

/** "G · A · +/- · PPP · SOG · HIT · W · GAA · SV% · SO" */
export function categoriesLabel(categories: CategoryKey[]): string {
  return categories.map((key) => categoryDef(key).short).join(' · ');
}
