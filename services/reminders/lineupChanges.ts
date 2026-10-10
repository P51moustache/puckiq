/**
 * What to change in the host app's lineup each night: the moves a "set your lineup" reminder names.
 *
 * Yahoo, ESPN and Fantrax carry a lineup forward from day to day, so each night starts from the
 * lineup carried over from the last night the team had a starter: that night's best lineup, plus
 * idle players who kept their seats because nobody needed them. A night needs a move when its best
 * lineup seats someone the carried lineup doesn't. Moves are minimal: a carried player sits only
 * when he plays but is outranked, or when tonight's starters need his seat. Then the idle player
 * whose next start is furthest off gives up his seat first, so later nights need fewer moves
 * (ties: the lower-value player).
 *
 * Pure: services/reminders/reminderInputs.ts builds the week plans, the planner words the result.
 */

import type { FantasyPlayer, LineupSlots, SlotKey } from '../../types/fantasy';
import { assignLineup, type SeatedPlayer } from '../fantasy/lineup';
import { eligibleSlots } from '../fantasy/positions';
import { shortNames } from '../fantasy/names';
import type { DayPlan, WeekPlan } from '../fantasy/weekPlan';

export interface LineupStart {
  playerId: number;
  /** Last name, with a first initial when two of the team's players share one. */
  name: string;
  /** The slot he takes tonight. */
  slot: SlotKey;
}

export interface LineupBench {
  playerId: number;
  name: string;
}

export interface LineupChange {
  /** In tonight's best lineup but not the carried one, best first: start them. */
  start: LineupStart[];
  /** In the carried lineup but out tonight (outranked first, then idle in a seat a starter needs). */
  bench: LineupBench[];
  /** Slots the best lineup still can't fill on a night with NHL games: a pickup, not a lineup move. */
  emptySlots: SlotKey[];
}

export interface LineupChangeInput {
  /** The team's week plans, in any order. Their days are walked in date order, across weeks. */
  plans: WeekPlan[];
  /** The roster the plans were built from: names and slot eligibility. */
  players: FantasyPlayer[];
  slots: LineupSlots;
  /** Value per team game (form): orders the starts and breaks ties between idle players. */
  values: Map<number, number>;
}

/** Does the host lineup need a move tonight? Open slots alone need a pickup, not a move. */
export function needsLineupMove(change: LineupChange): boolean {
  return change.start.length > 0 || change.bench.length > 0;
}

/** Moves to make. A start and the player he replaces are one swap. */
export function lineupMoveCount(change: LineupChange): number {
  return Math.max(change.start.length, change.bench.length);
}

interface Walk {
  days: DayPlan[];
  slots: LineupSlots;
  values: Map<number, number>;
  roster: Map<number, FantasyPlayer>;
  names: Map<number, string>;
  /** The day indexes each player starts on, ascending. */
  startDays: Map<number, number[]>;
}

/**
 * Each date's change. Null on and before the team's first night with a starter: nothing is
 * carried into those nights, so there's no lineup to compare with.
 */
export function lineupChangesByDate({ plans, players, slots, values }: LineupChangeInput): Map<string, LineupChange | null> {
  const days = daysInOrder(plans);
  const walk: Walk = {
    days,
    slots,
    values,
    roster: new Map(players.map((player) => [player.playerId, player])),
    names: namesById(players),
    startDays: startDaysOf(days),
  };
  const changes = new Map<string, LineupChange | null>();
  let carried: SeatedPlayer[] | null = null;
  for (let index = 0; index < days.length; index += 1) {
    const day = days[index];
    if (!carried) {
      changes.set(day.date, null);
      if (day.starters.length > 0) carried = day.starters;
      continue;
    }
    const next = reseat(carried, index, walk);
    changes.set(day.date, next.change);
    carried = next.lineup;
  }
  return changes;
}

/** Tonight's lineup from the carried one, with the fewest moves. */
function reseat(carried: SeatedPlayer[], index: number, walk: Walk): { lineup: SeatedPlayer[]; change: LineupChange } {
  const day = walk.days[index];
  const tonight = new Set(day.starters.map((seat) => seat.playerId));
  const playing = new Set(day.playing);
  // An idle player may keep his seat. One who plays but isn't in tonight's best lineup is outranked.
  const idle = carried
    .filter((seat) => !tonight.has(seat.playerId) && !playing.has(seat.playerId))
    .sort(leastWorthKeeping(index, walk));
  const seated = assignLineup([
    // Tonight's starters outrank every idle player. They all get seats: together they're tonight's lineup.
    ...day.starters.map((seat) => ({ playerId: seat.playerId, slots: slotsOf(seat, walk), value: idle.length })),
    // Idle players stay in their own slots, the ones most worth keeping seated first.
    ...idle.map((seat, rank) => ({ playerId: seat.playerId, slots: [seat.slot], value: rank })),
  ], walk.slots).starters;
  // Plans built with other slots than `walk.slots` might not seat everyone; fall back to tonight's own lineup.
  const seatedIds = new Set(seated.map((seat) => seat.playerId));
  const lineup = day.starters.every((seat) => seatedIds.has(seat.playerId)) ? seated : day.starters;

  const inLineup = new Set(lineup.map((seat) => seat.playerId));
  const wasSeated = new Set(carried.map((seat) => seat.playerId));
  const valueOf = (id: number) => walk.values.get(id) ?? 0;
  const nameOf = (id: number) => walk.names.get(id) ?? 'Player';
  const start = lineup
    .filter((seat) => !wasSeated.has(seat.playerId))
    .sort((a, b) => valueOf(b.playerId) - valueOf(a.playerId) || a.playerId - b.playerId)
    .map((seat) => ({ playerId: seat.playerId, name: nameOf(seat.playerId), slot: seat.slot }));
  // Outranked players first: they play tonight, so benching them is the move nobody would guess.
  const bench = carried
    .filter((seat) => !inLineup.has(seat.playerId))
    .sort((a, b) => Number(playing.has(b.playerId)) - Number(playing.has(a.playerId))
      || valueOf(b.playerId) - valueOf(a.playerId)
      || a.playerId - b.playerId)
    .map((seat) => ({ playerId: seat.playerId, name: nameOf(seat.playerId) }));
  return { lineup, change: { start, bench, emptySlots: day.empty } };
}

/** Idle players in the order they give up their seats: next start furthest off first, then lower value. */
function leastWorthKeeping(index: number, walk: Walk): (a: SeatedPlayer, b: SeatedPlayer) => number {
  // Past the last day: no start left in the plans.
  const noStart = walk.days.length;
  const nextStart = (id: number) => walk.startDays.get(id)?.find((day) => day > index) ?? noStart;
  const valueOf = (id: number) => walk.values.get(id) ?? 0;
  return (a, b) => nextStart(b.playerId) - nextStart(a.playerId)
    || valueOf(a.playerId) - valueOf(b.playerId)
    || b.playerId - a.playerId;
}

function slotsOf(seat: SeatedPlayer, walk: Walk): SlotKey[] {
  const player = walk.roster.get(seat.playerId);
  return player ? eligibleSlots(player) : [seat.slot];
}

/** One day per date (the first plan to list a date wins), oldest first. */
function daysInOrder(plans: WeekPlan[]): DayPlan[] {
  const byDate = new Map<string, DayPlan>();
  for (const plan of plans) {
    for (const day of plan.days) {
      if (!byDate.has(day.date)) byDate.set(day.date, day);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function startDaysOf(days: DayPlan[]): Map<number, number[]> {
  const startDays = new Map<number, number[]>();
  days.forEach((day, index) => {
    for (const seat of day.starters) {
      const indexes = startDays.get(seat.playerId);
      if (indexes) indexes.push(index);
      else startDays.set(seat.playerId, [index]);
    }
  });
  return startDays;
}

/** Last names, with a first initial where two of the team's players share one ("J. Hughes"). */
function namesById(players: FantasyPlayer[]): Map<number, string> {
  const names = shortNames(players.map((player) => player.playerName));
  return new Map(players.map((player, index) => [player.playerId, names[index]]));
}
