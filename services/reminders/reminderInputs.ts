/**
 * Inputs for game-night reminders: the nights to remind about, and each team's nightly lineup
 * changes (services/reminders/lineupChanges.ts). Forms load through the same cached NHL client as
 * the screens, for the same players, so a launch shares the screens' stats requests instead of
 * doubling them. A team whose forms fail has no lineup data: its reminders fall back to a count.
 */

import type { FantasyPlayer, FantasyTeam, ScoringWeights } from '../../types/fantasy';
import { goalieRefs, plannerGoalieInputs } from '../fantasy/goalieOutlook';
import { loadPlayerForms, startSharesOf, valuesOf, type FormsResult } from '../fantasy/loaders';
import { isNhlLinked } from '../fantasy/positions';
import { buildWeekPlan } from '../fantasy/weekPlan';
import { addDays, mondayOf } from '../nhl/dates';
import { loadWeekGoalieNights, type GoalieNights, type GoalieRef } from '../nhl/goalieStarts';
import { fetchWeekSchedule, type WeekSchedule } from '../nhl/schedule';
import { lineupChangesByDate, type LineupChange } from './lineupChanges';
import type { ReminderLineups } from './planner';

const WEEK_DAYS = 7;

export interface ReminderInputs {
  /** This week's and next week's schedules (whichever loaded): the nights to remind about. */
  schedules: WeekSchedule[];
  lineups: ReminderLineups;
}

/** Where schedules and forms come from (the NHL client by default; tests pass their own). */
export interface ReminderSources {
  fetchWeek: (monday: string) => Promise<WeekSchedule>;
  loadForms: (players: FantasyPlayer[], scoring: ScoringWeights, today: string) => Promise<FormsResult>;
  /** Goalies' back-to-back nights for a week, as the Week tab plans with. Without it, flat start shares. */
  loadGoalieNights?: (goalies: GoalieRef[], monday: string, today: string) => Promise<GoalieNights>;
}

const NHL_SOURCES: ReminderSources = {
  fetchWeek: (monday) => fetchWeekSchedule(monday),
  loadForms: (players, scoring, today) => loadPlayerForms(players, scoring, today),
  loadGoalieNights: (goalies, monday, today) => loadWeekGoalieNights(goalies, monday, today),
};

/**
 * Everything the planner needs on `today`. Last week's schedule only seeds the lineup each night
 * carries forward, so this week's first nights have one to compare with. Teams load one at a time,
 * in the order given: put the team on screen first, since its requests are the screens' own.
 */
export async function loadReminderInputs(
  teams: FantasyTeam[],
  today: string,
  sources: ReminderSources = NHL_SOURCES,
): Promise<ReminderInputs> {
  const monday = mondayOf(today);
  const [lastWeek, thisWeek, nextWeek] = await Promise.all(
    [-WEEK_DAYS, 0, WEEK_DAYS].map((offset) => sources.fetchWeek(addDays(monday, offset)).catch(() => null)),
  );
  const schedules = [thisWeek, nextWeek].filter(isSchedule);
  const walked = [lastWeek, ...schedules].filter(isSchedule);
  const lineups = new Map<string, Map<string, LineupChange | null>>();
  for (const team of teams) {
    // One team at a time: the NHL stats API rate-limits bursts, and the screens wait in the same queue.
    const changes = await teamLineups(team, walked, today, sources);
    if (changes) lineups.set(team.id, changes);
  }
  return { schedules, lineups };
}

async function teamLineups(
  team: FantasyTeam,
  schedules: WeekSchedule[],
  today: string,
  sources: ReminderSources,
): Promise<Map<string, LineupChange | null> | null> {
  try {
    // The screens load forms for the roster plus the opponent (hooks/useCoach.ts). The same players hit their cache.
    const { forms } = await sources.loadForms([...team.players, ...team.opponent], team.scoring, today);
    if (!canRank(team, forms)) return null;
    const values = valuesOf(forms);
    const startShares = startSharesOf(forms);
    const goalies = goalieRefs(team.players);
    const plans = await Promise.all(schedules.map(async (schedule) => {
      // A goalie likely to sit the second half of a back-to-back loses his seat, as on the Week tab.
      const nights = goalies.length > 0 && sources.loadGoalieNights
        ? await sources.loadGoalieNights(goalies, schedule.monday, today).catch(() => null)
        : null;
      return buildWeekPlan({ schedule, players: team.players, slots: team.slots, values, startShares, ...plannerGoalieInputs(nights, startShares), today });
    }));
    return lineupChangesByDate({ plans, players: team.players, slots: team.slots, values });
  } catch (error) {
    console.warn('[REMINDERS] No lineup data for a team:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Stats for at least one of the team's active NHL players. None at all means the requests failed. */
function canRank(team: FantasyTeam, forms: FormsResult['forms']): boolean {
  return team.players.some((player) => isNhlLinked(player)
    && !player.injuredReserve
    && (forms.get(player.playerId)?.basis ?? 'none') !== 'none');
}

function isSchedule(schedule: WeekSchedule | null): schedule is WeekSchedule {
  return schedule !== null;
}
