/**
 * The Week share card: how many games my roster has (left this week, or next week)
 * and who plays them, most games first. Pure, so the screen only renders it.
 */

import type { WeekPlan } from '../../services/fantasy/weekPlan';
import { weekRangeLabel } from '../../services/nhl/dates';
import type { FantasyPlayer } from '../../types/fantasy';
import type { ShareCardContent } from '../share/ShareCards';
import type { WeekChoice } from './types';

export interface WeekShareInput {
  plan: WeekPlan;
  /** Grid rows in display order (linked, active players). */
  rows: FantasyPlayer[];
  choice: WeekChoice;
  monday: string;
  teamName: string;
}

/** Null when the week has no games to share. */
export function weekShareContent({ plan, rows, choice, monday, teamName }: WeekShareInput): ShareCardContent | null {
  const thisWeek = choice === 'this';
  const count = thisWeek ? plan.remaining.games : plan.week.games;
  if (count <= 0) return null;
  const gamesOf = (player: FantasyPlayer) => {
    const summary = plan.players[player.playerId];
    return (thisWeek ? summary?.remainingGames : summary?.games) ?? 0;
  };
  return {
    kind: 'week',
    kicker: weekRangeLabel(monday).toUpperCase(),
    teamName,
    count,
    caption: thisWeek ? 'games left this week' : 'games next week',
    players: rows
      .map((player) => ({ player, games: gamesOf(player) }))
      .filter((row) => row.games > 0)
      .sort((a, b) => b.games - a.games)
      .map(({ player, games }) => ({
        playerId: player.playerId,
        name: player.playerName,
        team: player.teamAbbrev,
        position: player.position,
        detail: thisWeek ? `${games} left` : `${games} GP`,
      })),
  };
}
