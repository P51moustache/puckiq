/**
 * Screen-level data hooks. Each composes cached loaders; tabs that need the same
 * data (forms, this week's schedule) share one network call through the NHL client.
 */

import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { FantasyTeam } from '../types/fantasy';
import { buildCoachMoves, type CoachMove } from '../services/fantasy/coach';
import {
  loadNight,
  loadPickupPool,
  loadPlayerForms,
  loadWeekSchedule,
  startSharesOf,
  valuesOf,
  type FormsResult,
  type NightData,
} from '../services/fantasy/loaders';
import { compareWeeks, type MatchupSummary } from '../services/fantasy/matchup';
import { likelyRosteredIds, rankPickups, type PickupRow } from '../services/fantasy/pickups';
import { buildWeekPlan, type DayPlan, type WeekPlan } from '../services/fantasy/weekPlan';
import { addDays, mondayOf, todayNhl, appNow } from '../services/nhl/dates';
import { isGameFinal, isGameStarted, type WeekSchedule } from '../services/nhl/schedule';
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

function rosterKey(team: FantasyTeam | null, includeOpponent: boolean): string {
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

/** Does this week still have regular-season NHL games from `today` on? Null while loading. */
export function useWeekHasGamesLeft(today: string): boolean | null {
  const schedule = useWeekSchedule(mondayOf(today));
  if (!schedule.data) return null;
  return schedule.data.days.some((day) => day.date >= today && day.games.some((game) => game.gameType === 2 && game.scheduleState === 'OK'));
}

export interface WeekData {
  monday: string;
  schedule: Resource<WeekSchedule>;
  forms: Resource<FormsResult>;
  plan: WeekPlan | null;
  opponentPlan: WeekPlan | null;
  matchup: MatchupSummary | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWeekData(team: FantasyTeam | null, weekOffset = 0): WeekData {
  const today = useNhlToday();
  const monday = addDays(mondayOf(today), weekOffset * 7);
  const schedule = useWeekSchedule(monday);
  const forms = useTeamForms(team, today, true);

  const plan = useMemo(() => {
    if (!team || !schedule.data || !forms.data) return null;
    return buildWeekPlan({
      schedule: schedule.data,
      players: team.players,
      slots: team.slots,
      values: valuesOf(forms.data.forms),
      startShares: startSharesOf(forms.data.forms),
      today,
    });
  }, [team, schedule.data, forms.data, today]);

  const opponentPlan = useMemo(() => {
    if (!team || team.opponent.length === 0 || !schedule.data || !forms.data) return null;
    return buildWeekPlan({
      schedule: schedule.data,
      players: team.opponent,
      slots: team.slots,
      values: valuesOf(forms.data.forms),
      startShares: startSharesOf(forms.data.forms),
      today,
    });
  }, [team, schedule.data, forms.data, today]);

  const matchup = useMemo(() => (plan && opponentPlan ? compareWeeks(plan, opponentPlan) : null), [plan, opponentPlan]);

  return {
    monday,
    schedule,
    forms,
    plan,
    opponentPlan,
    matchup,
    loading: schedule.loading || forms.loading,
    refreshing: schedule.refreshing || forms.refreshing,
    error: schedule.error ?? forms.error,
    refresh: async () => {
      await Promise.all([schedule.refresh(), forms.refresh()]);
    },
  };
}

export interface NightView {
  date: string;
  night: Resource<NightData>;
  forms: Resource<FormsResult>;
  day: DayPlan | null;
  moves: CoachMove[];
  liveGames: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Tonight (dayOffset 0) or tomorrow (1): games, statuses, the lineup, coach moves. */
export function useNight(team: FantasyTeam | null, dayOffset = 0): NightView {
  const today = useNhlToday();
  const date = addDays(today, dayOffset);
  const monday = mondayOf(date);
  // Same key as the Week tab, so both tabs share one forms load.
  const forms = useTeamForms(team, today, true);
  const schedule = useWeekSchedule(monday);
  const key = team ? `night|${date}|${rosterKey(team, false)}` : null;
  const night = useResource(key, (force) => loadNight(team!.players, date, { force, live: dayOffset === 0 }));

  const liveGames = useMemo(
    () => !!night.data && Object.values(night.data.playerGames).some((game) => game && isGameStarted(game) && !isGameFinal(game)),
    [night.data],
  );

  // Keep scores and scratches current while any of MY games is live or about to start.
  const { refresh: refreshNight } = night;
  useEffect(() => {
    if (dayOffset !== 0) return;
    const soon = !!night.data && Object.values(night.data.playerGames).some((game) => {
      if (!game?.startTimeUTC || isGameFinal(game)) return false;
      const start = Date.parse(game.startTimeUTC);
      return Number.isFinite(start) && start - appNow().getTime() < 90 * 60 * 1000;
    });
    if (!liveGames && !soon) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refreshNight();
    }, 60_000);
    return () => clearInterval(timer);
  }, [dayOffset, liveGames, night.data, refreshNight]);

  const day = useMemo(() => {
    if (!team || !schedule.data || !forms.data) return null;
    const scratched = new Set(
      [...(night.data?.statuses.values() ?? [])]
        .filter((status) => status.signal === 'scratch' && status.confidence === 'confirmed')
        .map((status) => status.playerId),
    );
    const available = team.players.filter((player) => !scratched.has(player.playerId));
    const plan = buildWeekPlan({ schedule: schedule.data, players: available, slots: team.slots, values: valuesOf(forms.data.forms), today: date });
    return plan.days.find((entry) => entry.date === date) ?? null;
  }, [team, schedule.data, forms.data, night.data, date]);

  const moves = useMemo(() => {
    if (!team || !day || !night.data || !forms.data) return [];
    return buildCoachMoves({
      day,
      players: team.players.filter((player) => !player.injuredReserve),
      games: night.data.playerGames,
      statuses: night.data.statuses,
      forms: forms.data.forms,
      when: dayOffset === 0 ? 'tonight' : 'tomorrow',
    });
  }, [team, day, night.data, forms.data, dayOffset]);

  return {
    date,
    night,
    forms,
    day,
    moves,
    liveGames,
    loading: night.loading || forms.loading || schedule.loading,
    refreshing: night.refreshing,
    error: night.error ?? forms.error ?? schedule.error,
    refresh: async () => {
      await Promise.all([night.refresh(), forms.refresh(), schedule.refresh()]);
    },
  };
}

export interface PickupsView {
  rows: PickupRow[];
  hasCurrentSeason: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  plan: WeekPlan | null;
}

export function usePickups(
  team: FantasyTeam | null,
  enabled: boolean,
  onlyDate?: string,
  hideOwned = true,
  weekOffset = 0,
): PickupsView {
  const today = useNhlToday();
  const week = useWeekData(team, weekOffset);
  const exclude = useMemo(
    () => new Set([...(team?.players ?? []).map((p) => p.playerId), ...(team?.hiddenPickupIds ?? [])]),
    [team],
  );
  const key = team && enabled ? `pool|${today}|${JSON.stringify(team.scoring)}` : null;
  const pool = useResource(key, (force) => loadPickupPool(today, team!.scoring, new Set<number>(), { force }));

  const owned = useMemo(
    () => (hideOwned && team && pool.data ? likelyRosteredIds(pool.data.candidates, team.leagueSize, team.slots) : new Set<number>()),
    [hideOwned, team, pool.data],
  );

  const rows = useMemo(() => {
    if (!team || !pool.data || !week.plan || !week.schedule.data || !week.forms.data) return [];
    return rankPickups({
      schedule: week.schedule.data,
      plan: week.plan,
      roster: team.players,
      slots: team.slots,
      values: valuesOf(week.forms.data.forms),
      candidates: pool.data.candidates.filter((candidate) => !exclude.has(candidate.playerId) && !owned.has(candidate.playerId)),
      today,
      onlyDate,
    });
  }, [team, pool.data, week.plan, week.schedule.data, week.forms.data, exclude, owned, today, onlyDate]);

  return {
    rows,
    hasCurrentSeason: pool.data?.hasCurrentSeason ?? false,
    loading: pool.loading || week.loading,
    refreshing: pool.refreshing || week.refreshing,
    error: pool.error ?? week.error,
    refresh: async () => {
      await Promise.all([pool.refresh(), week.refresh()]);
    },
    plan: week.plan,
  };
}
