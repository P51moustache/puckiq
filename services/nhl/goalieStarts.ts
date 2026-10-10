/**
 * The calendar facts behind a goalie's start outlook: which nights his team plays twice in
 * a row, and — on the second night — who started the first night in its box score. The NHL
 * names starters only at puck drop, so a first night that hasn't started is "unknown". Every
 * load fails soft: a slate or box score that doesn't load reads as unknown.
 */

import { addDays, daysBetween, weekdayAbbrev } from './dates';
import { fetchStartingGoalies } from './gamecenter';
import {
  fantasyGamesOn,
  fetchDaySlate,
  fetchWeekSchedule,
  gameForTeam,
  isGameFinal,
  isGameStarted,
  type NhlGame,
  type ScheduleDay,
} from './schedule';

/** 'first': the team plays the next day too. 'second': it played the day before. */
export type BackToBackRole = 'first' | 'second';

/** On a second night, who started the first one: this goalie, a teammate, or not known (yet). */
export type FirstNightStarter = 'him' | 'partner' | 'unknown';

/** A goalie to look up: his NHL id and team. */
export interface GoalieRef {
  playerId: number;
  team: string;
}

/** One goalie's night as the schedule and box scores tell it. */
export interface GoalieNight {
  backToBack: BackToBackRole | null;
  /** 'unknown' unless this is a second night whose first game has started. */
  firstNightStarter: FirstNightStarter;
}

/** Goalie id → date → his night, for each date his team plays. */
export type GoalieNights = Map<number, Map<string, GoalieNight>>;

export interface GoalieStartsOptions {
  force?: boolean;
}

/**
 * The NHL never schedules three games in three nights, so a night is one half of a back-to-back
 * at most. Were both true, the second-night read wins: the first night's box score informs it.
 */
export function backToBackRole(playedBefore: boolean, playsAfter: boolean): BackToBackRole | null {
  if (playedBefore) return 'second';
  return playsAfter ? 'first' : null;
}

/** The team's game that counts on a schedule day (regular season, not postponed), or null. */
function teamGame(day: ScheduleDay | undefined, team: string): NhlGame | null {
  return day ? gameForTeam(fantasyGamesOn(day), team) : null;
}

/**
 * Back-to-back roles for one team across schedule days in date order. Only neighbouring dates
 * pair up, so a day missing at either end (or a gap) just means no role there.
 */
export function teamBackToBacks(days: ScheduleDay[], team: string): Map<string, BackToBackRole> {
  const roles = new Map<string, BackToBackRole>();
  const playsOn = (day: ScheduleDay | undefined, date: string, offset: number) =>
    !!day && daysBetween(date, day.date) === offset && teamGame(day, team) !== null;
  days.forEach((day, index) => {
    if (!teamGame(day, team)) return;
    const role = backToBackRole(playsOn(days[index - 1], day.date, -1), playsOn(days[index + 1], day.date, 1));
    if (role) roles.set(day.date, role);
  });
  return roles;
}

/** One goalie's first-night read, from his team's starter that night (undefined: not known). */
export function firstNightStarterOf(goalieId: number, teamStarterId: number | undefined): FirstNightStarter {
  if (teamStarterId === undefined) return 'unknown';
  return teamStarterId === goalieId ? 'him' : 'partner';
}

/** One date's slate as a schedule day; null when it doesn't load. */
async function slateDay(date: string, options: GoalieStartsOptions): Promise<ScheduleDay | null> {
  try {
    return { date, dayAbbrev: weekdayAbbrev(date), games: await fetchDaySlate(date, options) };
  } catch {
    return null;
  }
}

/**
 * Each goalie's night on each of `dates` his team plays. `days` covers those dates plus the day
 * either side. Box scores load only for second nights from `today` on whose first game has
 * started: one fetch per game, however many goalies it informs. A box score that doesn't load
 * (fetchStartingGoalies fails soft to no starters) reads as unknown.
 */
async function nightsFrom(
  days: ScheduleDay[],
  dates: string[],
  goalies: GoalieRef[],
  today: string,
  options: GoalieStartsOptions,
): Promise<GoalieNights> {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const teams = [...new Set(goalies.map((goalie) => goalie.team))];
  const roles = new Map(teams.map((team) => [team, teamBackToBacks(days, team)]));
  const firstGame = (team: string, date: string) =>
    roles.get(team)?.get(date) === 'second' ? teamGame(byDate.get(addDays(date, -1)), team) : null;

  const pending = new Map<number, Promise<Map<string, number>>>();
  for (const team of teams) {
    for (const date of dates) {
      const game = date >= today ? firstGame(team, date) : null;
      if (!game || pending.has(game.id)) continue;
      // A first night before today is over; today's has started once the slate says so.
      const over = addDays(date, -1) < today;
      const final = over || isGameFinal(game);
      if (over || isGameStarted(game)) pending.set(game.id, fetchStartingGoalies(game.id, { final, force: options.force }));
    }
  }
  const starters = new Map(await Promise.all([...pending].map(async ([id, load]) => [id, await load] as const)));

  const nights: GoalieNights = new Map();
  for (const goalie of goalies) {
    const mine = new Map<string, GoalieNight>();
    for (const date of dates) {
      if (!teamGame(byDate.get(date), goalie.team)) continue;
      const game = firstGame(goalie.team, date);
      const teamStarter = game ? starters.get(game.id)?.get(goalie.team) : undefined;
      mine.set(date, {
        backToBack: roles.get(goalie.team)?.get(date) ?? null,
        firstNightStarter: firstNightStarterOf(goalie.playerId, teamStarter),
      });
    }
    if (mine.size > 0) nights.set(goalie.playerId, mine);
  }
  return nights;
}

const loaded = (day: ScheduleDay | null): day is ScheduleDay => day !== null;

/**
 * One night (Tonight, or tomorrow): each goalie whose team plays on `date`, read from that
 * day's slate and its neighbours' — the same slates Tonight and the recap load.
 */
export async function loadGoalieNights(
  goalies: GoalieRef[],
  date: string,
  today: string,
  options: GoalieStartsOptions = {},
): Promise<Map<number, GoalieNight>> {
  if (goalies.length === 0) return new Map();
  const days = await Promise.all([addDays(date, -1), date, addDays(date, 1)].map((day) => slateDay(day, options)));
  const nights = await nightsFrom(days.filter(loaded), [date], goalies, today, options);
  const tonight = new Map<number, GoalieNight>();
  for (const [playerId, byDate] of nights) {
    const night = byDate.get(date);
    if (night) tonight.set(playerId, night);
  }
  return tonight;
}

/**
 * A fantasy week (Monday–Sunday): back-to-backs from the week's schedule plus the Sunday before
 * and the Monday after, so a week's first and last nights pair up too.
 */
export async function loadWeekGoalieNights(
  goalies: GoalieRef[],
  monday: string,
  today: string,
  options: GoalieStartsOptions = {},
): Promise<GoalieNights> {
  if (goalies.length === 0) return new Map();
  const [week, before, after] = await Promise.all([
    fetchWeekSchedule(monday, options).catch(() => null),
    slateDay(addDays(monday, -1), options),
    slateDay(addDays(monday, 7), options),
  ]);
  if (!week) return new Map();
  const days = [before, ...week.days, after].filter(loaded);
  return nightsFrom(days, week.days.map((day) => day.date), goalies, today, options);
}
