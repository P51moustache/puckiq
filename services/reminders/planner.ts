/**
 * Which game-night reminders to schedule, and when. Per night: a lineup reminder `minutesBefore`
 * the earliest puck drop among my players on any team, and with `liveStart` a second one at that
 * puck drop. With lineup data, the lineup reminder names the moves; with `onlyWhenNeeded`, it's
 * skipped on nights every team's lineup already works. A team or night without lineup data gets
 * the player count, so missing data never silently drops a reminder.
 *
 * Pure: services/lineupReminders.ts schedules the result.
 */

import type { FantasyTeam } from '../../types/fantasy';
import { formatPuckDrop } from '../nhl/dates';
import { fantasyGamesOn, gameForTeam, type ScheduleDay, type WeekSchedule } from '../nhl/schedule';
import { isNhlLinked } from '../fantasy/positions';
import { needsLineupMove, type LineupChange } from './lineupChanges';
import { lineupReminderCopy, liveReminderCopy, type TeamNight } from './reminderCopy';

/**
 * Pending notifications kept scheduled: one week of nights with both kinds. Re-planned on
 * every launch and foreground, and well under iOS's limit of 64 pending local notifications.
 */
export const MAX_SCHEDULED_REMINDERS = 14;

export type ReminderKind = 'lineup' | 'live';

export interface PlannedReminder {
  kind: ReminderKind;
  date: string;
  fireAt: Date;
  title: string;
  body: string;
}

export interface ReminderPlanOptions {
  minutesBefore: number;
  liveStart: boolean;
  /** Skip the lineup reminder on nights no team needs a lineup move. Absent: every game night. */
  onlyWhenNeeded?: boolean;
}

/** Team id → date → that night's lineup change (null: unknown). A missing team has no lineup data. */
export type ReminderLineups = ReadonlyMap<string, ReadonlyMap<string, LineupChange | null>>;

interface Night {
  /** Earliest puck drop among my players (epoch ms). */
  firstPuck: number;
  /** Teams with at least one player in a game. */
  teams: TeamNight[];
}

export function planReminders(
  teams: FantasyTeam[],
  schedules: WeekSchedule[],
  options: ReminderPlanOptions,
  now: Date = new Date(),
  lineups?: ReminderLineups,
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  const seen = new Set<string>();

  for (const day of schedules.flatMap((schedule) => schedule.days)) {
    if (seen.has(day.date)) continue;
    seen.add(day.date);
    const night = nightOf(day, teams, lineups);
    if (!night) continue;

    const lineupAt = night.firstPuck - options.minutesBefore * 60 * 1000;
    if (lineupAt > now.getTime() && (!options.onlyWhenNeeded || needsReminder(night))) {
      const firstPuck = formatPuckDrop(new Date(night.firstPuck).toISOString());
      planned.push({ kind: 'lineup', date: day.date, fireAt: new Date(lineupAt), ...lineupReminderCopy(night.teams, firstPuck) });
    }
    if (options.liveStart && night.firstPuck > now.getTime()) {
      planned.push({ kind: 'live', date: day.date, fireAt: new Date(night.firstPuck), ...liveReminderCopy(night.teams) });
    }
  }
  return planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, MAX_SCHEDULED_REMINDERS);
}

/** A team needs the reminder when its lineup needs a move, or when we can't tell (no lineup data). */
function needsReminder(night: Night): boolean {
  return night.teams.some((team) => !team.change || needsLineupMove(team.change));
}

function nightOf(day: ScheduleDay, teams: FantasyTeam[], lineups: ReminderLineups | undefined): Night | null {
  const games = fantasyGamesOn(day);
  if (games.length === 0) return null;

  let first: number | null = null;
  const rows: TeamNight[] = [];
  for (const team of teams) {
    let playing = 0;
    for (const player of team.players) {
      if (!isNhlLinked(player) || player.injuredReserve) continue;
      const game = gameForTeam(games, player.teamAbbrev);
      if (!game?.startTimeUTC) continue;
      playing += 1;
      const start = Date.parse(game.startTimeUTC);
      if (Number.isFinite(start) && (first === null || start < first)) first = start;
    }
    if (playing > 0) rows.push({ name: team.name, playing, change: lineups?.get(team.id)?.get(day.date) ?? null });
  }
  return first === null || rows.length === 0 ? null : { firstPuck: first, teams: rows };
}
