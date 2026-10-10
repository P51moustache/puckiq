/**
 * The week planner: for each day, which of MY players play, who gets a lineup slot,
 * who sits on overflow, and which slots go empty. This is the math behind
 * "games that actually count" — the number head-to-head weeks are won on.
 */

import type { FantasyPlayer, LineupSlots, SlotKey } from '../../types/fantasy';
import { daysBetween } from '../nhl/dates';
import type { BackToBackRole } from '../nhl/goalieStarts';
import { fantasyGamesOn, gameForTeam, isOffNight, opponentOf, type NhlGame, type WeekSchedule } from '../nhl/schedule';
import { assignLineup, type SeatedPlayer } from './lineup';
import { eligibleSlots, isGoalie, isNhlLinked } from './positions';

export interface PlayerGameDay {
  date: string;
  gameId: number;
  opponent: string;
  isHome: boolean;
  startTimeUTC: string | null;
  state: string;
  offNight: boolean;
  /** Set only when the planner's `backToBackOn` names one: his team's back-to-back role this night. */
  backToBack?: BackToBackRole;
}

export interface DayPlan {
  date: string;
  dayAbbrev: string;
  leagueGames: number;
  offNight: boolean;
  isPast: boolean;
  isToday: boolean;
  /** Players with an NHL game this day (IR excluded). */
  playing: number[];
  starters: SeatedPlayer[];
  /** Playing but no slot left. */
  bench: number[];
  empty: SlotKey[];
}

export interface PlayerWeek {
  playerId: number;
  games: number;
  remainingGames: number;
  offNightGames: number;
  /** Days the planner seats this player (games that count). */
  starts: number;
  remainingStarts: number;
  /** Days the player plays but the lineup is full at his positions. */
  benched: number;
  byDate: Record<string, PlayerGameDay>;
}

export interface PlanTotals {
  games: number;
  starts: number;
  benched: number;
  emptySlots: number;
  value: number;
  /** Expected goalie starts: team games × each goalie's start share, capped at G slots per night. */
  goalieStarts: number;
}

export interface WeekPlan {
  monday: string;
  today: string;
  days: DayPlan[];
  players: Record<number, PlayerWeek>;
  week: PlanTotals;
  remaining: PlanTotals;
}

export interface PlanInput {
  schedule: WeekSchedule;
  players: FantasyPlayer[];
  slots: LineupSlots;
  /** Value per team game (from form). Missing players rank last but still count. */
  values: Map<number, number>;
  today: string;
  /** Goalie start share (0–1). Missing goalies count as 0.5. */
  startShares?: Map<number, number>;
  /**
   * A goalie's chance to start on one date (0–1), e.g. low on the second night of a back-to-back
   * he'd start the first of. When it returns a number, that night uses it instead of his flat
   * share: in expected goalie starts, and in his value (per-start value × chance, so pass
   * `startShares` too). Undefined, or no function, keeps the flat share.
   */
  startChanceOn?: (playerId: number, date: string) => number | undefined;
  /** A player's back-to-back role on one date, recorded on his game day for the Week grid. */
  backToBackOn?: (playerId: number, date: string) => BackToBackRole | undefined;
}

/** A goalie with no start share splits his team's starts. */
const DEFAULT_START_SHARE = 0.5;

function emptyTotals(): PlanTotals {
  return { games: 0, starts: 0, benched: 0, emptySlots: 0, value: 0, goalieStarts: 0 };
}

/** A goalie's flat share of his team's starts, or an even split when unknown. */
export function startShareOf(playerId: number, startShares: Map<number, number> | undefined): number {
  return startShares?.get(playerId) ?? DEFAULT_START_SHARE;
}

/** Expected starts in net on `date`: the per-night chance when the planner has one, else the flat share. */
function goalieStartsOn(player: FantasyPlayer, date: string, input: PlanInput): number {
  return input.startChanceOn?.(player.playerId, date) ?? startShareOf(player.playerId, input.startShares);
}

/**
 * A goalie's value on one night. His value per team game is his per-start value × start share, so
 * a per-night chance rescales it by chance / share. No chance (or no share to rescale from) keeps it.
 */
export function goalieValueOnNight(value: number, share: number, chance: number | undefined): number {
  return chance === undefined || share <= 0 ? value : value * (chance / share);
}

/** His value on `date`: skaters keep theirs; a goalie's follows his chance to start that night. */
function valueOn(player: FantasyPlayer, date: string, input: PlanInput): number {
  const value = input.values.get(player.playerId) ?? 0;
  if (!input.startChanceOn || !isGoalie(player)) return value;
  return goalieValueOnNight(value, startShareOf(player.playerId, input.startShares), input.startChanceOn(player.playerId, date));
}

export function playerGameOn(player: FantasyPlayer, games: NhlGame[], offNight: boolean): PlayerGameDay | null {
  if (!player.teamAbbrev) return null;
  const game = gameForTeam(games, player.teamAbbrev);
  if (!game) return null;
  const { opponent, isHome } = opponentOf(game, player.teamAbbrev);
  return {
    date: game.date,
    gameId: game.id,
    opponent,
    isHome,
    startTimeUTC: game.startTimeUTC,
    state: game.state,
    offNight,
  };
}

export function buildWeekPlan(input: PlanInput): WeekPlan {
  const { schedule, players, slots, today } = input;
  const active = players.filter((player) => isNhlLinked(player) && !player.injuredReserve);
  const summaries: Record<number, PlayerWeek> = {};
  for (const player of active) {
    summaries[player.playerId] = {
      playerId: player.playerId,
      games: 0,
      remainingGames: 0,
      offNightGames: 0,
      starts: 0,
      remainingStarts: 0,
      benched: 0,
      byDate: {},
    };
  }

  const week = emptyTotals();
  const remaining = emptyTotals();

  const days: DayPlan[] = schedule.days.map((day) => {
    const games = fantasyGamesOn(day);
    const offNight = isOffNight(day);
    const isPast = daysBetween(today, day.date) < 0;
    const isToday = day.date === today;

    const playing: FantasyPlayer[] = [];
    for (const player of active) {
      const gameDay = playerGameOn(player, games, offNight);
      if (!gameDay) continue;
      playing.push(player);
      const summary = summaries[player.playerId];
      const backToBack = input.backToBackOn?.(player.playerId, day.date);
      summary.byDate[day.date] = backToBack ? { ...gameDay, backToBack } : gameDay;
      summary.games += 1;
      if (!isPast) summary.remainingGames += 1;
      if (offNight) summary.offNightGames += 1;
    }

    const nightValues = new Map(playing.map((player) => [player.playerId, valueOn(player, day.date, input)]));
    const lineup = assignLineup(
      playing.map((player) => ({
        playerId: player.playerId,
        slots: eligibleSlots(player),
        value: nightValues.get(player.playerId) ?? 0,
      })),
      slots,
    );

    const dayValue = lineup.starters.reduce((sum, seat) => sum + (nightValues.get(seat.playerId) ?? 0), 0);
    const goalieStarts = Math.min(
      slots.G,
      playing.filter((player) => isGoalie(player)).reduce((sum, player) => sum + goalieStartsOn(player, day.date, input), 0),
    );
    for (const seat of lineup.starters) {
      summaries[seat.playerId].starts += 1;
      if (!isPast) summaries[seat.playerId].remainingStarts += 1;
    }
    for (const id of lineup.bench) summaries[id].benched += 1;

    const bucket = [week, ...(isPast ? [] : [remaining])];
    for (const totals of bucket) {
      totals.games += playing.length;
      totals.starts += lineup.starters.length;
      totals.benched += lineup.bench.length;
      // An empty slot only matters on a night with NHL games.
      totals.emptySlots += games.length > 0 ? lineup.empty.length : 0;
      totals.value += dayValue;
      totals.goalieStarts += goalieStarts;
    }

    return {
      date: day.date,
      dayAbbrev: day.dayAbbrev,
      leagueGames: games.length,
      offNight,
      isPast,
      isToday,
      playing: playing.map((player) => player.playerId),
      starters: lineup.starters,
      bench: lineup.bench,
      empty: games.length > 0 ? lineup.empty : [],
    };
  });

  return { monday: schedule.monday, today, days, players: summaries, week, remaining };
}

/** Remaining days (today onward) where `slot`-eligible positions have an empty slot. */
export function openSlotDays(plan: WeekPlan, slotsForPlayer: SlotKey[]): string[] {
  return plan.days
    .filter((day) => !day.isPast && day.empty.some((slot) => slotsForPlayer.includes(slot)))
    .map((day) => day.date);
}
