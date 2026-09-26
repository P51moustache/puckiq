/**
 * Head-to-head week: my games that count vs my opponent's, same lineup rules.
 */

import type { WeekPlan } from './weekPlan';

export interface MatchupSide {
  games: number;
  starts: number;
  benched: number;
  emptySlots: number;
  value: number;
}

export interface MatchupSummary {
  mine: MatchupSide;
  theirs: MatchupSide;
  /** Positive = you have more starts left. */
  startEdge: number;
  valueEdge: number;
  verdict: 'ahead' | 'behind' | 'even';
}

function side(plan: WeekPlan): MatchupSide {
  const { games, starts, benched, emptySlots, value } = plan.remaining;
  return { games, starts, benched, emptySlots, value };
}

export function compareWeeks(mine: WeekPlan, theirs: WeekPlan): MatchupSummary {
  const a = side(mine);
  const b = side(theirs);
  const startEdge = a.starts - b.starts;
  const valueEdge = a.value - b.value;
  const relative = Math.abs(valueEdge) / Math.max(1, Math.max(a.value, b.value));
  const verdict = relative < 0.05 ? 'even' : valueEdge > 0 ? 'ahead' : 'behind';
  return { mine: a, theirs: b, startEdge, valueEdge, verdict };
}
