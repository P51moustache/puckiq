/**
 * Player form: season rate, last-14-days rate, and the single "value per team game"
 * the lineup planner ranks by. Early in a season we lean on last season so a
 * two-game sample does not decide anything.
 */

import type { ScoringWeights } from '../../types/fantasy';
import type { GoalieLine, SkaterLine } from '../nhl/stats';
import { DEFAULT_SCORING, goaliePoints, perGame, skaterPoints } from './scoring';

/** Games of last season blended into a thin current-season sample. */
const PRIOR_WEIGHT_GAMES = 10;
const RECENT_WEIGHT = 0.6;
const MIN_RECENT_GAMES = 3;
const HOT_RATIO = 1.25;
const COLD_RATIO = 0.75;
const FULL_SEASON_GAMES = 82;

export type Trend = 'hot' | 'cold' | 'steady' | 'unknown';
export type FormBasis = 'current' | 'blended' | 'previous' | 'none';

export interface PlayerForm {
  playerId: number;
  isGoalie: boolean;
  basis: FormBasis;
  seasonGp: number;
  /** Per game (skaters) / per start (goalies), current season or blended. */
  seasonRate: number;
  recentGp: number;
  recentRate: number | null;
  trend: Trend;
  /** Expected fantasy value per TEAM game — what the planner ranks by. */
  value: number;
  /** Goalies: share of team games started (0–1). Skaters: 1. */
  startShare: number;
  season: SkaterLine | GoalieLine | null;
  recent: SkaterLine | GoalieLine | null;
}

export interface FormInputs {
  current?: SkaterLine | GoalieLine;
  previous?: SkaterLine | GoalieLine;
  recent?: SkaterLine | GoalieLine;
  /** Current-season team games played (goalie start share). */
  teamGamesPlayed?: number;
}

function isGoalieLine(line: SkaterLine | GoalieLine | undefined): line is GoalieLine {
  return !!line && 'gs' in line;
}

function skaterTotal(line: SkaterLine, weights: ScoringWeights): number {
  return skaterPoints(line, weights);
}

function goalieTotal(line: GoalieLine, weights: ScoringWeights): number {
  return goaliePoints(
    { wins: line.wins, saves: line.saves, goalsAgainst: line.goalsAgainst, shutouts: line.shutouts },
    weights,
  );
}

function trendOf(recentRate: number | null, recentGp: number, seasonRate: number): Trend {
  if (recentRate === null || recentGp < MIN_RECENT_GAMES || seasonRate <= 0) return 'unknown';
  const ratio = recentRate / seasonRate;
  if (ratio >= HOT_RATIO) return 'hot';
  if (ratio <= COLD_RATIO) return 'cold';
  return 'steady';
}

export function buildSkaterForm(playerId: number, inputs: FormInputs, weights: ScoringWeights = DEFAULT_SCORING): PlayerForm {
  const current = inputs.current as SkaterLine | undefined;
  const previous = inputs.previous as SkaterLine | undefined;
  const recent = inputs.recent as SkaterLine | undefined;

  const curGp = current?.gp ?? 0;
  const curTotal = current ? skaterTotal(current, weights) : 0;
  const prevRate = previous && previous.gp > 0 ? perGame(skaterTotal(previous, weights), previous.gp) : null;

  let basis: FormBasis = 'none';
  let seasonRate = 0;
  if (curGp > 0 && prevRate !== null && curGp < 20) {
    basis = 'blended';
    seasonRate = (curTotal + prevRate * PRIOR_WEIGHT_GAMES) / (curGp + PRIOR_WEIGHT_GAMES);
  } else if (curGp > 0) {
    basis = 'current';
    seasonRate = perGame(curTotal, curGp);
  } else if (prevRate !== null) {
    basis = 'previous';
    seasonRate = prevRate;
  }

  const recentGp = recent?.gp ?? 0;
  const recentRate = recent && recentGp > 0 ? perGame(skaterTotal(recent, weights), recentGp) : null;
  const value = recentRate !== null && recentGp >= MIN_RECENT_GAMES
    ? RECENT_WEIGHT * recentRate + (1 - RECENT_WEIGHT) * seasonRate
    : seasonRate;

  return {
    playerId,
    isGoalie: false,
    basis,
    seasonGp: basis === 'previous' ? previous?.gp ?? 0 : curGp,
    seasonRate,
    recentGp,
    recentRate,
    trend: trendOf(recentRate, recentGp, seasonRate),
    value,
    startShare: 1,
    season: current ?? previous ?? null,
    recent: recent ?? null,
  };
}

export function buildGoalieForm(playerId: number, inputs: FormInputs, weights: ScoringWeights = DEFAULT_SCORING): PlayerForm {
  const current = isGoalieLine(inputs.current) ? inputs.current : undefined;
  const previous = isGoalieLine(inputs.previous) ? inputs.previous : undefined;
  const recent = isGoalieLine(inputs.recent) ? inputs.recent : undefined;

  const curGs = current?.gs ?? 0;
  const prevRate = previous && previous.gs > 0 ? perGame(goalieTotal(previous, weights), previous.gs) : null;
  const prevShare = previous && previous.gs > 0 ? Math.min(1, previous.gs / FULL_SEASON_GAMES) : null;

  let basis: FormBasis = 'none';
  let seasonRate = 0;
  let startShare = 0.5;
  const teamGp = inputs.teamGamesPlayed ?? 0;

  if (curGs > 0 && prevRate !== null && curGs < 12) {
    basis = 'blended';
    seasonRate = (goalieTotal(current as GoalieLine, weights) + prevRate * PRIOR_WEIGHT_GAMES) / (curGs + PRIOR_WEIGHT_GAMES);
  } else if (curGs > 0) {
    basis = 'current';
    seasonRate = perGame(goalieTotal(current as GoalieLine, weights), curGs);
  } else if (prevRate !== null) {
    basis = 'previous';
    seasonRate = prevRate;
  }

  if (teamGp > 0 && current) {
    const curShare = Math.min(1, curGs / teamGp);
    startShare = prevShare !== null && teamGp < 20
      ? (curGs + prevShare * PRIOR_WEIGHT_GAMES) / (teamGp + PRIOR_WEIGHT_GAMES)
      : curShare;
  } else if (prevShare !== null) {
    startShare = prevShare;
  }

  const recentGp = recent?.gs ?? 0;
  const recentRate = recent && recentGp > 0 ? perGame(goalieTotal(recent, weights), recentGp) : null;
  const perStart = recentRate !== null && recentGp >= MIN_RECENT_GAMES
    ? RECENT_WEIGHT * recentRate + (1 - RECENT_WEIGHT) * seasonRate
    : seasonRate;

  return {
    playerId,
    isGoalie: true,
    basis,
    seasonGp: basis === 'previous' ? previous?.gs ?? 0 : curGs,
    seasonRate,
    recentGp,
    recentRate,
    trend: trendOf(recentRate, recentGp, seasonRate),
    value: perStart * startShare,
    startShare,
    season: current ?? previous ?? null,
    recent: recent ?? null,
  };
}

export const TREND_LABEL: Record<Trend, string> = {
  hot: 'Hot',
  cold: 'Cold',
  steady: 'Steady',
  unknown: '—',
};
