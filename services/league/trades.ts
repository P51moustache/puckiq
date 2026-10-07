/**
 * Trade finder (Pro): 1-for-1 swaps with another member where BOTH lineups gain. Value is the
 * fantasy engine's own — `buildWeekPlan`'s remaining starter value per schedule, summed — so a
 * swap only shows up when it fills real slots (a D for a team with no D, a skater into nights
 * with an empty slot), never on raw player value alone.
 *
 * Cost. Each plan is cheap (≤ 7 days of `assignLineup` over ≤ 30 players); the number of plans is
 * what matters. With W schedules: 2·W baselines, (|mine| + |theirs|)·W for the bounds, then W per
 * surviving pair for my side and W more only when my side qualifies. With no pruning (a negative
 * value somewhere) the worst case is 2·|mine|·|theirs|·W plans: 16 × 16 × 2 × 2 ≈ 1,000 plans,
 * tens of milliseconds.
 */

import type { FantasyPlayer, LineupSlots } from '../../types/fantasy';
import { isNhlLinked } from '../fantasy/positions';
import { buildWeekPlan } from '../fantasy/weekPlan';
import type { WeekSchedule } from '../nhl/schedule';

/** A card's worth of ideas. */
export const DEFAULT_TRADE_LIMIT = 5;

/**
 * Smallest gain worth suggesting, in lineup value (≈ fantasy points). Form estimates are rough;
 * half a point over the period is inside their noise, not a reason to start a trade talk.
 */
export const DEFAULT_MIN_TRADE_GAIN = 0.5;

/** Float sums of the same values in a different order can differ in the last bits; compare and rank on a clean number. */
const GAIN_PRECISION = 1e6;

export interface TradeInput {
  mine: FantasyPlayer[];
  theirs: FantasyPlayer[];
  slots: LineupSlots;
  /** Value per team game (form) for players on BOTH rosters; missing players count 0, as in the planner. */
  values: Map<number, number>;
  startShares?: Map<number, number>;
  /** The weeks to judge by — e.g. this week and next. Days before `today` don't count. */
  schedules: WeekSchedule[];
  today: string;
  limit?: number;
  minGain?: number;
}

export interface TradeIdea {
  give: FantasyPlayer;
  get: FantasyPlayer;
  myGain: number;
  theirGain: number;
}

/** IR players are never offered or asked for; unlinked 2.x names can't be planned. */
function tradeable(player: FantasyPlayer): boolean {
  return !player.injuredReserve && isNhlLinked(player);
}

function cleanGain(value: number): number {
  return Math.round(value * GAIN_PRECISION) / GAIN_PRECISION;
}

function without(players: FantasyPlayer[], playerId: number): FantasyPlayer[] {
  return players.filter((player) => player.playerId !== playerId);
}

/**
 * Swaps where my gain and their gain are both at least `minGain`, best first: by the smaller of
 * the two gains (a trade both sides like), then by their sum, then by player ids.
 */
export function findTrades(input: TradeInput): TradeIdea[] {
  const { mine, theirs, slots, values, startShares, schedules, today } = input;
  const limit = input.limit ?? DEFAULT_TRADE_LIMIT;
  const minGain = input.minGain ?? DEFAULT_MIN_TRADE_GAIN;

  const lineupValue = (players: FantasyPlayer[]) =>
    schedules.reduce(
      (total, schedule) => total + buildWeekPlan({ schedule, players, slots, values, today, startShares }).remaining.value,
      0,
    );
  const gainFor = (players: FantasyPlayer[], base: number) => cleanGain(lineupValue(players) - base);

  const baseMine = lineupValue(mine);
  const baseTheirs = lineupValue(theirs);
  const mineIds = new Set(mine.map((player) => player.playerId));
  const theirIds = new Set(theirs.map((player) => player.playerId));
  let gives = mine.filter((player) => tradeable(player) && !theirIds.has(player.playerId));
  let gets = theirs.filter((player) => tradeable(player) && !mineIds.has(player.playerId));

  // With no negative values a lineup never loses value by gaining a player, so getting someone for
  // nothing bounds what any swap for him can add. Drop players who can't clear the bar either way.
  const canPrune = [...mine, ...theirs].every((player) => (values.get(player.playerId) ?? 0) >= 0);
  if (canPrune) {
    gets = gets.filter((get) => gainFor([...mine, get], baseMine) >= minGain);
    gives = gives.filter((give) => gainFor([...theirs, give], baseTheirs) >= minGain);
  }

  const ideas: TradeIdea[] = [];
  for (const give of gives) {
    const mineWithout = without(mine, give.playerId);
    for (const get of gets) {
      const myGain = gainFor([...mineWithout, get], baseMine);
      if (myGain < minGain) continue;
      const theirGain = gainFor([...without(theirs, get.playerId), give], baseTheirs);
      if (theirGain < minGain) continue;
      ideas.push({ give, get, myGain, theirGain });
    }
  }

  return ideas.sort(compareTradeIdeas).slice(0, Math.max(0, limit));
}

/**
 * The fair-deal order every trade list uses: the smaller of the two gains first (a deal both
 * sides like), then the total gain, then player ids so ties are stable.
 */
export function compareTradeIdeas(a: TradeIdea, b: TradeIdea): number {
  return (
    Math.min(b.myGain, b.theirGain) - Math.min(a.myGain, a.theirGain) ||
    b.myGain + b.theirGain - (a.myGain + a.theirGain) ||
    a.give.playerId - b.give.playerId ||
    a.get.playerId - b.get.playerId
  );
}
