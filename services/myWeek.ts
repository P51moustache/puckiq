/**
 * Free week of MY games from the official NHL schedule.
 * Not a Yahoo “set lineup for the week” paywall. Calendar date only — never /now.
 */

import type { FantasyPlayer, MyWeek, MyWeekDay } from '../types/fantasy';
import { getNhlCalendarDate } from './nhlDate';
import { findGameForTeam, NHL_WEB_API } from './tonightRoster';

interface ScheduleTeam {
  abbrev?: string;
}

interface ScheduleGame {
  id?: number;
  startTimeUTC?: string;
  homeTeam?: ScheduleTeam;
  awayTeam?: ScheduleTeam;
}

interface ScheduleDay {
  date?: string;
  dayAbbrev?: string;
  games?: ScheduleGame[];
}

export interface NhlWeekSchedule {
  gameWeek?: ScheduleDay[];
}

function dayAbbrevFromDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

export function emptyMyWeek(date: string = getNhlCalendarDate()): MyWeek {
  return { startDate: date, days: [] };
}

export function mapScheduleToMyWeek(
  payload: NhlWeekSchedule,
  players: FantasyPlayer[],
): MyWeek {
  const gameWeek = Array.isArray(payload.gameWeek) ? payload.gameWeek : [];
  const days: MyWeekDay[] = gameWeek.map((day) => {
    const date = day.date ?? '';
    const games = Array.isArray(day.games) ? day.games : [];
    const mine = players.flatMap((player) => {
      const game = findGameForTeam(games, player.teamAbbrev);
      if (!game) return [];
      const team = player.teamAbbrev.toUpperCase();
      const home = (game.homeTeam?.abbrev ?? '').toUpperCase();
      const away = (game.awayTeam?.abbrev ?? '').toUpperCase();
      const isHome = home === team;
      const opponentAbbrev = (isHome ? away : home) || '';
      return [{
        playerId: player.playerId,
        playerName: player.playerName,
        teamAbbrev: player.teamAbbrev,
        opponentAbbrev,
        isHome,
      }];
    });
    return {
      date,
      dayAbbrev: (day.dayAbbrev ?? dayAbbrevFromDate(date)).toUpperCase(),
      playerCount: mine.length,
      games: mine,
    };
  });

  return {
    startDate: days[0]?.date || getNhlCalendarDate(),
    days,
  };
}

export async function fetchMyWeek(
  players: FantasyPlayer[],
  date: string = getNhlCalendarDate(),
): Promise<MyWeek> {
  if (players.length === 0) return emptyMyWeek(date);
  try {
    const res = await fetch(`${NHL_WEB_API}/v1/schedule/${date}`);
    if (!res.ok) return emptyMyWeek(date);
    const payload = await res.json() as NhlWeekSchedule;
    return mapScheduleToMyWeek(payload, players);
  } catch {
    return emptyMyWeek(date);
  }
}
