/**
 * The Week schedule as an F1 tyre-strategy chart: one strip per player across Mon–Sun.
 * Pure — which bar each day shows, how back-to-back bars join into one stint, which goalie
 * nights are back-to-backs, where the "now" line sits, and what a row says to VoiceOver.
 * The grid components only render it.
 */

import { isNhlLinked } from '../../services/fantasy/positions';
import type { DayPlan, PlayerWeek, WeekPlan } from '../../services/fantasy/weekPlan';
import type { BackToBackRole } from '../../services/nhl/goalieStarts';
import type { FantasyPlayer } from '../../types/fantasy';

/**
 * What one player's day shows.
 * - `count` (Pro): plays and starts in the solved lineup — solid team colour.
 * - `bench` (Pro): plays, but every slot he fits is taken — hatched amber outline.
 * - `game` (free): plays; no count/bench call without Pro — solid team colour.
 * - `none`: no game.
 */
export type BarKind = 'count' | 'bench' | 'game' | 'none';

export interface StintCell {
  date: string;
  kind: BarKind;
  /** Opponent abbreviation; null on a day without a game. */
  opponent: string | null;
  isHome: boolean;
  /** A bar of the same kind sits on the previous / next day: together they read as one stint. */
  joinsPrev: boolean;
  joinsNext: boolean;
  past: boolean;
  today: boolean;
  offNight: boolean;
  /** His team's back-to-back role this night, when the plan carries it (goalies). */
  backToBack: BackToBackRole | null;
}

/** Linked, active players: most games first, then by name. */
export function scheduleRows(players: FantasyPlayer[], plan: WeekPlan): FantasyPlayer[] {
  const gamesOf = (player: FantasyPlayer) => plan.players[player.playerId]?.games ?? 0;
  return players
    .filter((player) => isNhlLinked(player) && !player.injuredReserve)
    .sort((a, b) => gamesOf(b) - gamesOf(a) || a.playerName.localeCompare(b.playerName));
}

/** `detailed` = Pro: split games into the ones that count and the ones lost to the bench. */
export function barKind(day: DayPlan, playerId: number, hasGame: boolean, detailed: boolean): BarKind {
  if (!hasGame) return 'none';
  if (!detailed) return 'game';
  return day.bench.includes(playerId) ? 'bench' : 'count';
}

/** One player's strip, Monday first. */
export function stintCells(plan: WeekPlan, playerId: number, detailed: boolean): StintCell[] {
  const summary = plan.players[playerId];
  const cells = plan.days.map((day) => {
    const game = summary?.byDate[day.date] ?? null;
    return {
      date: day.date,
      kind: barKind(day, playerId, game !== null, detailed),
      opponent: game?.opponent ?? null,
      isHome: game?.isHome ?? false,
      past: day.isPast,
      today: day.isToday,
      offNight: day.offNight,
      backToBack: game?.backToBack ?? null,
    };
  });
  return cells.map((cell, index) => ({
    ...cell,
    joinsPrev: cell.kind !== 'none' && cells[index - 1]?.kind === cell.kind,
    joinsNext: cell.kind !== 'none' && cells[index + 1]?.kind === cell.kind,
  }));
}

/** Column index of today, or null when the week shown isn't the current one. */
export function nowColumn(plan: WeekPlan): number | null {
  const index = plan.days.findIndex((day) => day.isToday);
  return index >= 0 ? index : null;
}

/** "TOR" on phones; "vs TOR" / "@ TOR" where the bar is long enough (iPad). */
export function barLabel(cell: StintCell, long: boolean): string {
  if (!cell.opponent) return '';
  return long ? `${cell.isHome ? 'vs' : '@'} ${cell.opponent}` : cell.opponent;
}

export interface DayTotals {
  /** My players with a game. Null on a day with no NHL games (the grid shows a dash). */
  playing: number | null;
  /** Lineup slots nobody can fill. Null on a day with no NHL games. */
  empty: number | null;
}

export function dayTotals(day: DayPlan): DayTotals {
  if (day.leagueGames === 0) return { playing: null, empty: null };
  return { playing: day.playing.length, empty: day.empty.length };
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "Saturday", for VoiceOver. */
function weekdayName(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

/** The nights the plan marks as back-to-backs (goalies), in date order. */
export function backToBackDates(summary: PlayerWeek | undefined): string[] {
  if (!summary) return [];
  return Object.values(summary.byDate)
    .filter((game) => game.backToBack)
    .map((game) => game.date)
    .sort();
}

/**
 * What VoiceOver reads for a row: "Connor McDavid: 4 games, 3 count, 1 on the bench". A goalie's
 * row adds his back-to-back nights, the "B2B" marks under his bars.
 */
export function rowAccessibilityLabel(name: string, summary: PlayerWeek | undefined, detailed: boolean): string {
  const games = summary?.games ?? 0;
  if (!summary || games === 0) return `${name}: no games`;
  const parts = [plural(games, 'game', 'games')];
  if (detailed) {
    parts.push(plural(summary.starts, 'counts', 'count'));
    if (summary.benched > 0) parts.push(`${summary.benched} on the bench`);
  }
  const backToBacks = backToBackDates(summary);
  const note = backToBacks.length > 0
    ? `. Back-to-back ${backToBacks.map(weekdayName).join(', ')}: teams usually split goalie starts`
    : '';
  return `${name}: ${parts.join(', ')}${note}`;
}
