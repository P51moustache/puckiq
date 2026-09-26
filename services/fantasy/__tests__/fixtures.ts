import type { FantasyPlayer } from '../../../types/fantasy';
import type { NhlGame, WeekSchedule } from '../../nhl/schedule';
import { weekDates, weekdayAbbrev } from '../../nhl/dates';

export function player(id: number, name: string, team: string, position: string, extra: Partial<FantasyPlayer> = {}): FantasyPlayer {
  return { playerId: id, playerName: name, teamAbbrev: team, position, rosterPosition: 'BN', ...extra };
}

let gameId = 2026020000;
export function game(date: string, away: string, home: string, extra: Partial<NhlGame> = {}): NhlGame {
  gameId += 1;
  return {
    id: gameId,
    date,
    gameType: 2,
    startTimeUTC: `${date}T23:00:00Z`,
    state: 'FUT',
    scheduleState: 'OK',
    home,
    away,
    homeScore: null,
    awayScore: null,
    period: null,
    clock: null,
    inIntermission: false,
    ...extra,
  };
}

/** Filler games so a day is not an off-night. */
export function busyNight(date: string, count = 10): NhlGame[] {
  const teams = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH', 'III', 'JJJ', 'KKK', 'LLL', 'MMM', 'NNN', 'OOO', 'PPP', 'QQQ', 'RRR', 'SSS', 'TTT'];
  return Array.from({ length: count }, (_, index) => game(date, teams[(index * 2) % teams.length], teams[(index * 2 + 1) % teams.length]));
}

export function week(monday: string, gamesByDate: Record<string, NhlGame[]>): WeekSchedule {
  return {
    monday,
    days: weekDates(monday).map((date) => ({ date, dayAbbrev: weekdayAbbrev(date), games: gamesByDate[date] ?? [] })),
  };
}
