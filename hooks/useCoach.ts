/**
 * Screen-level data hooks: the week (both sides of a matchup), a night (tonight, tomorrow, last
 * night's recap) and pickups. They build on the shared data hooks in useTeamData.ts.
 */

import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import type { FantasyTeam } from '../types/fantasy';
import { buildCoachMoves, type CoachMove } from '../services/fantasy/coach';
import { outlookChances, plannerGoalieInputs, type GoalieOutlook } from '../services/fantasy/goalieOutlook';
import {
  loadNight,
  loadPickupPool,
  startSharesOf,
  valuesOf,
  type FormsResult,
  type NightData,
} from '../services/fantasy/loaders';
import { compareWeeks, type MatchupSummary } from '../services/fantasy/matchup';
import { buildNightScore, type NightScore } from '../services/fantasy/nightScore';
import { likelyRosteredIds, rankPickups, type PickupRow } from '../services/fantasy/pickups';
import { buildWeekPlan, goalieValueOnNight, type DayPlan, type PlanInput, type WeekPlan } from '../services/fantasy/weekPlan';
import { buildPlannedDay } from '../services/fantasy/lineupPlan';
import { lineupCoverageError } from '../services/fantasy/dataQuality';
import { currentStatuses, namedLineupChecks, type NamedCheck } from '../services/fantasy/lineupChecks';
import { unavailableCheck } from '../services/data/sourceCheck';
import { addDays, mondayOf, appNow, shortDate } from '../services/nhl/dates';
import { isGameFinal, isGameStarted, type WeekSchedule } from '../services/nhl/schedule';
import { useGoalieOutlook } from './useGoalieOutlook';
import { useResource, type Resource } from './useResource';
import { rosterKey, useNhlToday, useTeamForms, useWeekGoalieNights, useWeekSchedule } from './useTeamData';

// Screens and tests import the shared hooks from here too.
export { useNhlToday, useTeamForms, useWeekHasGamesLeft, useWeekSchedule } from './useTeamData';

/** What both sides' plans were built with: values, start shares and each goalie's chance night by night. */
export type WeekPlanInputs = Pick<PlanInput, 'values' | 'startShares' | 'startChanceOn' | 'backToBackOn'>;

export interface WeekData {
  monday: string;
  schedule: Resource<WeekSchedule>;
  forms: Resource<FormsResult>;
  /** Null until forms load. Pickups re-solve nights with the same inputs. */
  planInputs: WeekPlanInputs | null;
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
  const goalieNights = useWeekGoalieNights(team, monday, today);
  const coverageError = team && forms.data && schedule.data
    ? lineupCoverageError(team.players, forms.data.forms, schedule.data) : null;

  // Shared by both sides: values, start shares, and each goalie's start chance night by night.
  const planInputs = useMemo((): WeekPlanInputs | null => {
    if (!forms.data) return null;
    const startShares = startSharesOf(forms.data.forms);
    return { values: valuesOf(forms.data.forms), startShares, ...plannerGoalieInputs(goalieNights.data, startShares) };
  }, [forms.data, goalieNights.data]);

  const plan = useMemo(() => {
    if (!team || !schedule.data || !planInputs || coverageError) return null;
    return buildWeekPlan({ schedule: schedule.data, players: team.players, slots: team.slots, today, ...planInputs });
  }, [team, schedule.data, planInputs, today, coverageError]);

  const opponentPlan = useMemo(() => {
    if (!team || team.opponent.length === 0 || !schedule.data || !planInputs) return null;
    if (forms.data && lineupCoverageError(team.opponent, forms.data.forms, schedule.data)) return null;
    return buildWeekPlan({ schedule: schedule.data, players: team.opponent, slots: team.slots, today, ...planInputs });
  }, [team, schedule.data, planInputs, today, forms.data]);

  const matchup = useMemo(() => (plan && opponentPlan ? compareWeeks(plan, opponentPlan) : null), [plan, opponentPlan]);

  return {
    monday,
    schedule,
    planInputs,
    forms,
    plan,
    opponentPlan,
    matchup,
    loading: schedule.loading || forms.loading,
    refreshing: schedule.refreshing || forms.refreshing,
    error: schedule.error ?? forms.error ?? coverageError,
    refresh: async () => {
      await Promise.all([schedule.refresh(), forms.refresh(), goalieNights.refresh()]);
    },
  };
}

export interface NightView {
  date: string;
  checks: NamedCheck[];
  night: Resource<NightData>;
  forms: Resource<FormsResult>;
  day: DayPlan | null;
  bestDay: DayPlan | null;
  lineupValues: ReadonlyMap<number, number>;
  moves: CoachMove[];
  /** Goalies' estimated starts on this night (empty until loaded). The lineup prefers the likely starter. */
  goalieOutlooks: ReadonlyMap<number, GoalieOutlook>;
  liveGames: boolean;
  /** Box-score points for the night (null until the night and lineup inputs load). */
  score: NightScore | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Tonight (dayOffset 0), tomorrow (1), or last night (-1, the morning recap): games, statuses,
 * the lineup, coach moves (tonight and tomorrow only) and the night's score.
 */
export function useNight(team: FantasyTeam | null, dayOffset = 0, enabled = true): NightView {
  const today = useNhlToday();
  const date = addDays(today, dayOffset);
  const monday = mondayOf(date);
  // Same key as the Week tab, so both tabs share one forms load.
  const forms = useTeamForms(team, today, true);
  const schedule = useWeekSchedule(monday);
  const key = team && enabled ? `night|${date}|${rosterKey(team, false)}` : null;
  // Box scores load for tonight (live) and last night (the recap); tomorrow has none yet.
  const loadedNight = useResource(key, (force) => loadNight(team!.players, date, { force, live: dayOffset <= 0, news: dayOffset >= 0 }));
  // Tonight's countdown and foreground updates re-render this hook even without a new fetch.
  const evidenceNow = Date.now();
  const nightData = useMemo(() => loadedNight.data ? {
    ...loadedNight.data, statuses: currentStatuses(loadedNight.data.statuses, evidenceNow),
  } : null, [loadedNight.data, evidenceNow]);
  const night = { ...loadedNight, data: nightData };
  const goalieOutlooks = useGoalieOutlook(enabled ? team : null, date);
  const checks = useMemo(() => night.data ? namedLineupChecks(
    night.data.checks ?? { schedule: unavailableCheck('schedule'), scratches: [], news: unavailableCheck('news') },
    schedule.data?.check ?? unavailableCheck('planning schedule'),
  ) : [], [night.data, schedule.data]);
  const scratched = useMemo(() => new Set(
    [...(night.data?.statuses.values() ?? [])]
      .filter((status) => status.signal === 'scratch' && status.confidence === 'confirmed')
      .map((status) => status.playerId),
  ), [night.data]);
  const coverageError = team && forms.data && schedule.data
    ? lineupCoverageError(team.players, forms.data.forms, schedule.data, date, scratched) : null;

  const liveGames = useMemo(
    () => !!night.data && Object.values(night.data.playerGames).some((game) => game && isGameStarted(game) && !isGameFinal(game)),
    [night.data],
  );

  // Keep scores and scratches current while any of MY games is live or about to start.
  const { refresh: refreshNight } = loadedNight;
  useEffect(() => {
    if (dayOffset !== 0) return;
    const soon = !!loadedNight.data && Object.values(loadedNight.data.playerGames).some((game) => {
      if (!game?.startTimeUTC || isGameFinal(game)) return false;
      const start = Date.parse(game.startTimeUTC);
      return Number.isFinite(start) && start - appNow().getTime() < 90 * 60 * 1000;
    });
    if (!liveGames && !soon) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refreshNight();
    }, 60_000);
    return () => clearInterval(timer);
  }, [dayOffset, liveGames, loadedNight.data, refreshNight]);

  const bestDay = useMemo(() => {
    if (!team || !schedule.data || !forms.data || coverageError) return null;
    const available = team.players.filter((player) => !scratched.has(player.playerId));
    const plan = buildWeekPlan({
      schedule: schedule.data,
      players: available,
      slots: team.slots,
      values: valuesOf(forms.data.forms),
      startShares: startSharesOf(forms.data.forms),
      // A goalie likely to sit (say, the second night of a back-to-back he started) loses his seat.
      startChanceOn: outlookChances(goalieOutlooks, date),
      today: date,
    });
    return plan.days.find((entry) => entry.date === date) ?? null;
  }, [team, schedule.data, forms.data, scratched, date, goalieOutlooks, coverageError]);

  const lineupValues = useMemo(() => {
    const values = forms.data ? valuesOf(forms.data.forms) : new Map<number, number>();
    for (const [id, outlook] of goalieOutlooks) {
      const form = forms.data?.forms.get(id);
      if (form?.isGoalie) values.set(id, goalieValueOnNight(form.value, form.startShare, outlook.chance));
    }
    return values;
  }, [forms.data, goalieOutlooks]);
  const day = useMemo(() => team && bestDay && team.lineupChoices?.[date]
    ? buildPlannedDay(team, bestDay, lineupValues) : bestDay, [team, bestDay, date, lineupValues]);

  const moves = useMemo(() => {
    if (dayOffset < 0 || !team || !bestDay || !night.data || !forms.data) return [];
    return buildCoachMoves({
      day: bestDay,
      players: team.players.filter((player) => !player.injuredReserve),
      games: night.data.playerGames,
      statuses: night.data.statuses,
      forms: forms.data.forms,
      goalieOutlooks,
      when: dayOffset === 0 ? 'tonight' : dayOffset === 1 ? 'tomorrow' : `on ${shortDate(date)}`,
    });
  }, [team, bestDay, night.data, forms.data, dayOffset, goalieOutlooks, date]);

  const score = useMemo(() => {
    if (!team || !night.data) return null;
    const scratched = new Set(
      [...night.data.statuses.values()]
        .filter((status) => status.signal === 'scratch' && status.confidence === 'confirmed')
        .map((status) => status.playerId),
    );
    return buildNightScore({
      players: team.players,
      playerGames: night.data.playerGames,
      games: night.data.games,
      lines: night.data.liveLines,
      scoring: team.scoring,
      slots: team.slots,
      day,
      scratched,
    });
  }, [team, night.data, day]);

  return {
    date,
    checks,
    night,
    forms,
    day,
    bestDay,
    lineupValues,
    moves,
    goalieOutlooks,
    liveGames,
    score,
    loading: night.loading || forms.loading || schedule.loading,
    refreshing: night.refreshing,
    error: night.error ?? forms.error ?? schedule.error ?? coverageError,
    refresh: async () => {
      await Promise.all([night.refresh(), forms.refresh(), schedule.refresh()]);
    },
  };
}

const NO_IDS = new Set<number>();

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
  /** Players a League Room knows are rostered in this league — always hidden. */
  roomTaken: Set<number> = NO_IDS,
): PickupsView {
  const today = useNhlToday();
  const week = useWeekData(team, weekOffset);
  const exclude = useMemo(
    () => new Set([...(team?.players ?? []).map((p) => p.playerId), ...(team?.hiddenPickupIds ?? []), ...roomTaken]),
    [team, roomTaken],
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
      startShares: week.planInputs?.startShares,
      startChanceOn: week.planInputs?.startChanceOn,
      candidates: pool.data.candidates.filter((candidate) => !exclude.has(candidate.playerId) && !owned.has(candidate.playerId)),
      today,
      onlyDate,
    });
  }, [team, pool.data, week.plan, week.planInputs, week.schedule.data, week.forms.data, exclude, owned, today, onlyDate]);

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
