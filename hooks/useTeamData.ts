/**
 * The data hooks every screen shares: the NHL "today", a team's forms, a week's schedule, and
 * goalies' back-to-back nights. Each composes cached loaders, so tabs asking for the same data
 * share one network call through the NHL client. Screen-level hooks build on these (useCoach.ts).
 */

import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { FantasyTeam } from '../types/fantasy';
import { goalieRefs } from '../services/fantasy/goalieOutlook';
import { loadPlayerForms, loadWeekSchedule, type FormsResult } from '../services/fantasy/loaders';
import { mondayOf, todayNhl } from '../services/nhl/dates';
import { loadWeekGoalieNights, type GoalieNights, type GoalieRef } from '../services/nhl/goalieStarts';
import type { WeekSchedule } from '../services/nhl/schedule';
import { useResource, type Resource } from './useResource';

/** NHL "today" that rolls over at midnight Eastern without an app restart. */
export function useNhlToday(): string {
  const [today, setToday] = useState(() => todayNhl());
  useEffect(() => {
    const tick = () => setToday(todayNhl());
    const timer = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return today;
}

/** Resource-key part for a team's roster (and opponent) and scoring. */
export function rosterKey(team: FantasyTeam | null, includeOpponent: boolean): string {
  if (!team) return 'none';
  const ids = team.players.map((player) => `${player.playerId}:${player.teamAbbrev}:${player.position}:${player.injuredReserve ? 1 : 0}`);
  const opp = includeOpponent ? team.opponent.map((player) => `${player.playerId}:${player.teamAbbrev}`) : [];
  return `${team.id}|${ids.join(',')}|${opp.join(',')}|${JSON.stringify(team.scoring)}`;
}

export function useTeamForms(team: FantasyTeam | null, today: string, includeOpponent = false): Resource<FormsResult> {
  const key = team ? `forms|${today}|${rosterKey(team, includeOpponent)}` : null;
  return useResource(key, (force) => {
    const players = includeOpponent && team ? [...team.players, ...team.opponent] : team?.players ?? [];
    return loadPlayerForms(players, team!.scoring, today, { force });
  });
}

export function useWeekSchedule(monday: string): Resource<WeekSchedule> {
  return useResource(`week|${monday}`, (force) => loadWeekSchedule(monday, { force }));
}

/** Resource-key part for a set of goalies: who, and whose schedule. */
export function goaliesKey(goalies: GoalieRef[]): string {
  return goalies.map((goalie) => `${goalie.playerId}:${goalie.team}`).join(',');
}

/**
 * Back-to-backs and first-night starters for every goalie on both sides of a week. It fails
 * soft to nothing, and the plan uses flat start shares until (or unless) it loads.
 */
export function useWeekGoalieNights(team: FantasyTeam | null, monday: string, today: string): Resource<GoalieNights> {
  const goalies = useMemo(() => goalieRefs(team ? [...team.players, ...team.opponent] : []), [team]);
  const key = goalies.length > 0 ? `goalie-week|${monday}|${today}|${goaliesKey(goalies)}` : null;
  return useResource(key, (force) => loadWeekGoalieNights(goalies, monday, today, { force }));
}

/** Does this week still have regular-season NHL games from `today` on? Null while loading. */
export function useWeekHasGamesLeft(today: string): boolean | null {
  const schedule = useWeekSchedule(mondayOf(today));
  if (!schedule.data) return null;
  return schedule.data.days.some((day) => day.date >= today && day.games.some((game) => game.gameType === 2 && game.scheduleState === 'OK'));
}
