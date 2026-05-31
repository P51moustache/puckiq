/**
 * Insight Finder — auto-surfaces non-obvious NHL patterns for fans.
 *
 * v1 scope: Trends + Regression candidates (skaters & goalies), built entirely
 * on top of the pre-computed Supabase trend views so no new ingestion or schema
 * is required:
 *   - skater_trend_summary  → hot/cold, streaks, shooting%, PDO, names
 *   - goalie_rolling_stats  → recent vs season save% (regression + hot goalies)
 *   - players               → goalie names
 *
 * The detector functions are PURE (rows in → Insight[] out) so they can be unit
 * tested without a database. `findInsights()` is the thin orchestrator that
 * pulls the rows and applies depth + favourite-team filtering.
 *
 * Framing: analytics & insights for fans — not betting advice.
 */

import { supabase } from '../lib/supabase';
import type { Insight, InsightDepth } from '../types/insights';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

export const FINDER_THRESHOLDS = {
  /** Minimum games played before a skater is eligible (avoids small samples). */
  minSkaterGames: 15,
  /** Minimum season points so we surface real contributors, not depth players. */
  minSeasonPoints: 8,
  /** Point streak length that's worth calling out on its own. */
  notableStreak: 5,
  /** Shooting% gap (recent 5 vs season, in pct points) to flag regression. */
  shootingGapPct: 7,
  /** Season shooting% above which "running hot" is especially noteworthy. */
  hotShootingPct: 18,
  /** PDO bands (on-ice shooting% + save%, ~100 is neutral). */
  pdoHigh: 102,
  pdoLow: 98,
  /** Goalie eligibility + save% swing (recent 5 starts vs season). */
  minGoalieStarts: 6,
  goalieSavePctSwing: 0.02,
  /** Absolute recent save% that reads as a hot goalie. */
  hotGoalieSavePct: 0.928,
  /** Max insights returned. */
  maxInsights: 50,
} as const;

const DEPTH_LABELS: Record<InsightDepth, string> = {
  1: 'Simple',
  2: 'Standard',
  3: 'Advanced',
};

// ---------------------------------------------------------------------------
// Row shapes (subset of the view columns we select)
// ---------------------------------------------------------------------------

export interface SkaterTrendRow {
  player_id: number;
  player_name: string | null;
  team_abbrev: string | null;
  position: string | null;
  games_played: number | null;
  season_points: number | null;
  season_ppg: number | null;
  recent_ppg: number | null;
  hot_cold_score: number | null;
  trend_label: 'HOT' | 'WARM' | 'STEADY' | 'COOL' | 'COLD' | null;
  point_streak: number | null;
  recent_shooting_pct: number | null;
  season_shooting_pct: number | null;
  avg_pdo_5g: number | null;
  season_pdo: number | null;
}

export interface GoalieRollingRow {
  player_id: number;
  team_abbrev: string | null;
  starts: number | null;
  save_pct_5g: number | null;
  season_save_pct: number | null;
  avg_ga_5g: number | null;
  wins_5g: number | null;
}

export interface GoalieName {
  firstName: string;
  lastName: string;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const num = (v: number | null | undefined, fallback = 0): number =>
  typeof v === 'number' && !Number.isNaN(v) ? v : fallback;

const pct = (v: number): string => `${v.toFixed(1)}%`;
/** Save% comes back as a 0–1 ratio in the goalie view. */
const svp = (v: number): string => `.${Math.round(v * 1000)}`;

/** Keep the single strongest insight per (player, category). */
function dedupePerPlayer(insights: Insight[]): Insight[] {
  const best = new Map<string, Insight>();
  for (const ins of insights) {
    const key = `${ins.category}:${ins.playerId ?? ins.id}`;
    const existing = best.get(key);
    if (!existing || num(ins.severity) > num(existing.severity)) {
      best.set(key, ins);
    }
  }
  return [...best.values()];
}

// ---------------------------------------------------------------------------
// Detectors — PURE. (rows) => Insight[]
// ---------------------------------------------------------------------------

/** Hot/cold streaks & form swings — the "who's heating up" signal. */
export function detectSkaterTrends(rows: SkaterTrendRow[]): Insight[] {
  const out: Insight[] = [];

  for (const r of rows) {
    const gp = num(r.games_played);
    const seasonPts = num(r.season_points);
    if (gp < FINDER_THRESHOLDS.minSkaterGames) continue;
    if (seasonPts < FINDER_THRESHOLDS.minSeasonPoints) continue;

    const name = r.player_name ?? `Player ${r.player_id}`;
    const team = r.team_abbrev ?? undefined;
    const recent = num(r.recent_ppg);
    const season = num(r.season_ppg);
    const streak = num(r.point_streak);
    const score = num(r.hot_cold_score);
    const label = r.trend_label ?? 'STEADY';

    const metrics = [
      { label: 'Last 5', value: `${recent.toFixed(2)} P/GP` },
      { label: 'Season', value: `${season.toFixed(2)} P/GP` },
    ];
    if (streak > 0) metrics.push({ label: 'Point streak', value: `${streak} GP` });

    if (label === 'HOT' || (label === 'WARM' && streak >= FINDER_THRESHOLDS.notableStreak)) {
      out.push({
        id: `trend-hot-${r.player_id}`,
        text: `${name} is heating up`,
        teamAbbrev: team,
        category: 'trend',
        sentiment: 'positive',
        depth: 1,
        playerId: r.player_id,
        detail:
          `Averaging ${recent.toFixed(2)} points per game over the last 5 vs ` +
          `${season.toFixed(2)} on the season` +
          (streak >= 3 ? `, on a ${streak}-game point streak.` : '.'),
        metrics,
        severity: 100 + score * 10 + streak,
        shareText: `${name} is heating up — ${recent.toFixed(2)} P/GP over his last 5 (season ${season.toFixed(2)}) — PuckIQ`,
      });
    } else if (label === 'COLD') {
      out.push({
        id: `trend-cold-${r.player_id}`,
        text: `${name} has cooled off`,
        teamAbbrev: team,
        category: 'trend',
        sentiment: 'negative',
        depth: 2,
        playerId: r.player_id,
        detail:
          `Down to ${recent.toFixed(2)} points per game over the last 5 vs ` +
          `${season.toFixed(2)} on the season.`,
        metrics,
        severity: 80 + Math.abs(score) * 10,
        shareText: `${name} has cooled off — ${recent.toFixed(2)} P/GP over his last 5 (season ${season.toFixed(2)}) — PuckIQ`,
      });
    } else if (streak >= FINDER_THRESHOLDS.notableStreak) {
      out.push({
        id: `trend-streak-${r.player_id}`,
        text: `${name} on a ${streak}-game point streak`,
        teamAbbrev: team,
        category: 'trend',
        sentiment: 'positive',
        depth: 1,
        playerId: r.player_id,
        detail: `Has recorded a point in ${streak} straight games.`,
        metrics,
        severity: 90 + streak,
        shareText: `${name} on a ${streak}-game point streak — PuckIQ`,
      });
    }
  }

  return out;
}

/** Shooting% sustainability — classic regression candidates. */
export function detectShootingRegression(rows: SkaterTrendRow[]): Insight[] {
  const out: Insight[] = [];

  for (const r of rows) {
    const gp = num(r.games_played);
    if (gp < FINDER_THRESHOLDS.minSkaterGames) continue;
    if (num(r.season_points) < FINDER_THRESHOLDS.minSeasonPoints) continue;

    const recent = num(r.recent_shooting_pct);
    const season = num(r.season_shooting_pct);
    if (season <= 0 && recent <= 0) continue;

    const gap = recent - season;
    if (Math.abs(gap) < FINDER_THRESHOLDS.shootingGapPct) continue;

    const name = r.player_name ?? `Player ${r.player_id}`;
    const team = r.team_abbrev ?? undefined;
    const metrics = [
      { label: 'Last 5 SH%', value: pct(recent), context: `vs ${pct(season)} season` },
    ];

    if (gap > 0) {
      out.push({
        id: `regr-shoot-hot-${r.player_id}`,
        text: `${name} shooting above his norm`,
        teamAbbrev: team,
        category: 'regression',
        sentiment: 'neutral',
        depth: 2,
        playerId: r.player_id,
        detail:
          `Converting ${pct(recent)} of shots over the last 5 vs ${pct(season)} on the season. ` +
          `Shooting percentage tends to normalise, so the goal pace may cool even if the chances keep coming.`,
        metrics,
        severity: 70 + gap,
        shareText: `${name} is shooting ${pct(recent)} over his last 5 (season ${pct(season)}) — regression watch — PuckIQ`,
      });
    } else {
      out.push({
        id: `regr-shoot-cold-${r.player_id}`,
        text: `${name} is snakebitten`,
        teamAbbrev: team,
        category: 'regression',
        sentiment: 'positive',
        depth: 2,
        playerId: r.player_id,
        detail:
          `Only ${pct(recent)} shooting over the last 5 vs ${pct(season)} on the season. ` +
          `If the shot volume holds, the finishing should bounce back — a positive-regression candidate.`,
        metrics,
        severity: 65 + Math.abs(gap),
        shareText: `${name} is shooting just ${pct(recent)} over his last 5 (season ${pct(season)}) — due to bounce back — PuckIQ`,
      });
    }
  }

  return out;
}

/** On-ice luck via PDO — advanced, lower-signal regression nuance. */
export function detectPdoRegression(rows: SkaterTrendRow[]): Insight[] {
  const out: Insight[] = [];

  for (const r of rows) {
    if (num(r.games_played) < FINDER_THRESHOLDS.minSkaterGames) continue;
    if (r.avg_pdo_5g == null) continue; // only after weekly advanced sync

    const pdo = num(r.avg_pdo_5g);
    if (pdo <= 0) continue;
    const name = r.player_name ?? `Player ${r.player_id}`;
    const team = r.team_abbrev ?? undefined;
    const seasonPdo = r.season_pdo == null ? undefined : num(r.season_pdo);

    const metrics = [
      {
        label: 'PDO (L5)',
        value: pdo.toFixed(1),
        context: seasonPdo != null ? `vs ${seasonPdo.toFixed(1)} season` : undefined,
      },
    ];

    if (pdo >= FINDER_THRESHOLDS.pdoHigh) {
      out.push({
        id: `regr-pdo-high-${r.player_id}`,
        text: `${name} riding high on-ice luck`,
        teamAbbrev: team,
        category: 'regression',
        sentiment: 'neutral',
        depth: 3,
        playerId: r.player_id,
        detail:
          `On-ice PDO of ${pdo.toFixed(1)} over the last 5 (shooting% + save% while on the ice). ` +
          `Sustained PDO well above 100 usually signals luck that regresses.`,
        metrics,
        severity: 55 + (pdo - 100),
        shareText: `${name} carrying a ${pdo.toFixed(1)} on-ice PDO over his last 5 — regression watch — PuckIQ`,
      });
    } else if (pdo <= FINDER_THRESHOLDS.pdoLow) {
      out.push({
        id: `regr-pdo-low-${r.player_id}`,
        text: `${name} due for on-ice bounces`,
        teamAbbrev: team,
        category: 'regression',
        sentiment: 'positive',
        depth: 3,
        playerId: r.player_id,
        detail:
          `On-ice PDO of ${pdo.toFixed(1)} over the last 5. ` +
          `PDO this far below 100 tends to climb back toward neutral — results should improve.`,
        metrics,
        severity: 50 + (100 - pdo),
        shareText: `${name} carrying a ${pdo.toFixed(1)} on-ice PDO over his last 5 — bounce-back candidate — PuckIQ`,
      });
    }
  }

  return out;
}

/** Goalie save% form & sustainability. */
export function detectGoalieInsights(
  rows: GoalieRollingRow[],
  names: Map<number, GoalieName>,
): Insight[] {
  const out: Insight[] = [];

  for (const r of rows) {
    const starts = num(r.starts);
    if (starts < FINDER_THRESHOLDS.minGoalieStarts) continue;
    if (r.save_pct_5g == null || r.season_save_pct == null) continue;

    const recent = num(r.save_pct_5g);
    const season = num(r.season_save_pct);
    const swing = recent - season;
    const info = names.get(r.player_id);
    const name = info ? `${info.firstName} ${info.lastName}` : `Goalie ${r.player_id}`;
    const team = r.team_abbrev ?? undefined;

    const metrics = [
      { label: 'SV% (L5)', value: svp(recent), context: `vs ${svp(season)} season` },
    ];

    // Hot goalie (trend) — clear, surfaces at Simple depth.
    if (recent >= FINDER_THRESHOLDS.hotGoalieSavePct && swing >= 0.005) {
      out.push({
        id: `goalie-hot-${r.player_id}`,
        text: `${name} is locked in`,
        teamAbbrev: team,
        category: 'goalie',
        sentiment: 'positive',
        depth: 1,
        playerId: r.player_id,
        detail: `Stopping ${svp(recent)} of shots over his last 5 starts (season ${svp(season)}).`,
        metrics,
        severity: 95 + swing * 1000,
        shareText: `${name} stopping ${svp(recent)} over his last 5 starts (season ${svp(season)}) — PuckIQ`,
      });
      continue;
    }

    // Save% regression in either direction (Standard depth).
    if (swing >= FINDER_THRESHOLDS.goalieSavePctSwing) {
      out.push({
        id: `goalie-regr-hot-${r.player_id}`,
        text: `${name} running hot`,
        teamAbbrev: team,
        category: 'goalie',
        sentiment: 'neutral',
        depth: 2,
        playerId: r.player_id,
        detail:
          `Save% of ${svp(recent)} over the last 5 starts is well above his ${svp(season)} season mark. ` +
          `Goalie save% is noisy and tends to regress toward the season number.`,
        metrics,
        severity: 70 + swing * 1000,
        shareText: `${name} at ${svp(recent)} over his last 5 starts vs ${svp(season)} season — regression watch — PuckIQ`,
      });
    } else if (swing <= -FINDER_THRESHOLDS.goalieSavePctSwing) {
      out.push({
        id: `goalie-regr-cold-${r.player_id}`,
        text: `${name} below his season form`,
        teamAbbrev: team,
        category: 'goalie',
        sentiment: 'positive',
        depth: 2,
        playerId: r.player_id,
        detail:
          `Save% of ${svp(recent)} over the last 5 starts sits below his ${svp(season)} season mark — ` +
          `a positive-regression candidate if the workload holds.`,
        metrics,
        severity: 65 + Math.abs(swing) * 1000,
        shareText: `${name} at ${svp(recent)} over his last 5 starts vs ${svp(season)} season — due to bounce back — PuckIQ`,
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface FindInsightsOptions {
  /** Max depth tier to include (1 simple → 3 advanced). Default 2. */
  depth?: InsightDepth;
  /** If provided, only insights for these team tri-codes are returned. */
  teams?: string[];
  limit?: number;
}

export interface FinderResult {
  insights: Insight[];
  depth: InsightDepth;
  /** Human label for the active depth, e.g. "Standard". */
  depthLabel: string;
  generatedAt: number;
}

// 5-minute cache, matching the playerTrends service pattern.
const CACHE_TTL = 5 * 60 * 1000;
let cache: { result: FinderResult; key: string } | null = null;

export function clearInsightFinderCache(): void {
  cache = null;
}

async function fetchSkaterRows(): Promise<SkaterTrendRow[]> {
  try {
    const { data, error } = await supabase
      .from('skater_trend_summary')
      .select(
        'player_id, player_name, team_abbrev, position, games_played, season_points, ' +
          'season_ppg, recent_ppg, hot_cold_score, trend_label, point_streak, ' +
          'recent_shooting_pct, season_shooting_pct, avg_pdo_5g, season_pdo',
      )
      .gt('games_played', FINDER_THRESHOLDS.minSkaterGames - 1);
    if (error || !data) {
      if (error) console.warn('[INSIGHT FINDER] skater query error:', error.message);
      return [];
    }
    return data as unknown as SkaterTrendRow[];
  } catch (err) {
    console.warn('[INSIGHT FINDER] skater query threw:', err);
    return [];
  }
}

async function fetchGoalieRows(): Promise<{ rows: GoalieRollingRow[]; names: Map<number, GoalieName> }> {
  try {
    const { data, error } = await supabase
      .from('goalie_rolling_stats')
      .select('player_id, team_abbrev, starts, save_pct_5g, season_save_pct, avg_ga_5g, wins_5g')
      .gt('starts', FINDER_THRESHOLDS.minGoalieStarts - 1);
    if (error || !data || data.length === 0) {
      if (error) console.warn('[INSIGHT FINDER] goalie query error:', error.message);
      return { rows: [], names: new Map() };
    }
    const rows = data as unknown as GoalieRollingRow[];
    const ids = rows.map((r) => r.player_id);
    const names = new Map<number, GoalieName>();
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .in('id', ids);
    for (const p of players ?? []) {
      names.set(p.id, { firstName: p.first_name, lastName: p.last_name });
    }
    return { rows, names };
  } catch (err) {
    console.warn('[INSIGHT FINDER] goalie query threw:', err);
    return { rows: [], names: new Map() };
  }
}

/**
 * Run all detectors, then rank, depth-filter, dedupe and (optionally) filter to
 * the user's favourite teams.
 */
export async function findInsights(options: FindInsightsOptions = {}): Promise<FinderResult> {
  const depth = options.depth ?? 2;
  const limit = options.limit ?? FINDER_THRESHOLDS.maxInsights;
  const teamFilter = options.teams && options.teams.length > 0 ? new Set(options.teams) : null;

  const cacheKey = `d${depth}:${teamFilter ? [...teamFilter].sort().join(',') : 'all'}:${limit}`;
  if (cache && cache.key === cacheKey && Date.now() - cache.result.generatedAt < CACHE_TTL) {
    return cache.result;
  }

  const [skaterRows, goalieData] = await Promise.all([fetchSkaterRows(), fetchGoalieRows()]);

  const raw = [
    ...detectSkaterTrends(skaterRows),
    ...detectShootingRegression(skaterRows),
    ...detectPdoRegression(skaterRows),
    ...detectGoalieInsights(goalieData.rows, goalieData.names),
  ];

  const result: FinderResult = {
    insights: rankAndFilter(raw, { depth, teams: teamFilter, limit }),
    depth,
    depthLabel: DEPTH_LABELS[depth],
    generatedAt: Date.now(),
  };

  cache = { result, key: cacheKey };
  return result;
}

/** Pure ranking/filtering step — exported for testing. */
export function rankAndFilter(
  insights: Insight[],
  opts: { depth: InsightDepth; teams: Set<string> | null; limit: number },
): Insight[] {
  let filtered = insights.filter((i) => (i.depth ?? 1) <= opts.depth);
  if (opts.teams) {
    filtered = filtered.filter((i) => i.teamAbbrev && opts.teams!.has(i.teamAbbrev));
  }
  return dedupePerPlayer(filtered)
    .sort((a, b) => num(b.severity) - num(a.severity))
    .slice(0, opts.limit);
}

/** Visible for testing. */
export const _internals = { dedupePerPlayer, num, svp, pct, DEPTH_LABELS };
