/**
 * Week plans for other members' rosters. We don't load form for other teams, and don't need to:
 * the number of players a lineup can seat is the same whatever the values (the planner's lineup
 * is a matroid basis, and every basis has the same size), so games that count, overflow and
 * empty slots come out right with one value for everyone.
 */

import type { FantasyPlayer, LineupSlots } from '../../types/fantasy';
import type { WeekSchedule } from '../nhl/schedule';
import { buildWeekPlan, type WeekPlan } from '../fantasy/weekPlan';

/** Every player's value in a uniform plan. Any positive constant works; 1 makes `value` read as starts. */
export const UNIFORM_VALUE = 1;

export function uniformValues(players: FantasyPlayer[]): Map<number, number> {
  return new Map(players.map((player) => [player.playerId, UNIFORM_VALUE]));
}

export interface UniformPlanInput {
  schedule: WeekSchedule;
  roster: FantasyPlayer[];
  slots: LineupSlots;
  today: string;
}

/** The fantasy engine's week plan with uniform values: counts are exact, starter picks at a crowded position are by id. */
export function uniformWeekPlan({ schedule, roster, slots, today }: UniformPlanInput): WeekPlan {
  return buildWeekPlan({ schedule, players: roster, slots, values: uniformValues(roster), today });
}
