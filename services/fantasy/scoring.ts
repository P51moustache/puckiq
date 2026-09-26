/**
 * Fantasy value per game. Transparent weights (shown in League settings), not a black box.
 * Defaults mirror a common Yahoo points setup; category leagues can use them as a proxy.
 */

import type { ScoringWeights } from '../../types/fantasy';

export const DEFAULT_SCORING: ScoringWeights = {
  goals: 3,
  assists: 2,
  ppp: 1,
  shots: 0.5,
  hits: 0.5,
  blocks: 0.5,
  plusMinus: 0,
  wins: 5,
  saves: 0.2,
  goalsAgainst: -1,
  shutouts: 3,
};

export const SCORING_FIELDS: Array<{ key: keyof ScoringWeights; label: string; goalie: boolean }> = [
  { key: 'goals', label: 'Goal', goalie: false },
  { key: 'assists', label: 'Assist', goalie: false },
  { key: 'ppp', label: 'Power-play point', goalie: false },
  { key: 'shots', label: 'Shot on goal', goalie: false },
  { key: 'hits', label: 'Hit', goalie: false },
  { key: 'blocks', label: 'Block', goalie: false },
  { key: 'plusMinus', label: 'Plus/minus', goalie: false },
  { key: 'wins', label: 'Win', goalie: true },
  { key: 'saves', label: 'Save', goalie: true },
  { key: 'goalsAgainst', label: 'Goal against', goalie: true },
  { key: 'shutouts', label: 'Shutout', goalie: true },
];

export interface SkaterTotals {
  goals: number;
  assists: number;
  ppp: number;
  shots: number;
  hits: number;
  blocks: number;
  plusMinus: number;
}

export interface GoalieTotals {
  wins: number;
  saves: number;
  goalsAgainst: number;
  shutouts: number;
}

export function skaterPoints(totals: Partial<SkaterTotals>, weights: ScoringWeights = DEFAULT_SCORING): number {
  return (
    (totals.goals ?? 0) * weights.goals +
    (totals.assists ?? 0) * weights.assists +
    (totals.ppp ?? 0) * weights.ppp +
    (totals.shots ?? 0) * weights.shots +
    (totals.hits ?? 0) * weights.hits +
    (totals.blocks ?? 0) * weights.blocks +
    (totals.plusMinus ?? 0) * weights.plusMinus
  );
}

export function goaliePoints(totals: Partial<GoalieTotals>, weights: ScoringWeights = DEFAULT_SCORING): number {
  return (
    (totals.wins ?? 0) * weights.wins +
    (totals.saves ?? 0) * weights.saves +
    (totals.goalsAgainst ?? 0) * weights.goalsAgainst +
    (totals.shutouts ?? 0) * weights.shutouts
  );
}

export function perGame(total: number, games: number): number {
  return games > 0 ? total / games : 0;
}

/** One decimal, no "-0.0". */
export function formatValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(1);
}

export function sanitizeScoring(input: Partial<ScoringWeights> | null | undefined): ScoringWeights {
  const out = { ...DEFAULT_SCORING };
  if (!input) return out;
  for (const field of SCORING_FIELDS) {
    const value = Number(input[field.key]);
    if (Number.isFinite(value) && Math.abs(value) <= 100) out[field.key] = value;
  }
  return out;
}
