/**
 * Small display helpers shared by the coach screens.
 */

import { useEffect, useState } from 'react';
import type { GameLine } from '../../services/nhl/gamecenter';
import type { PlayerGameDay } from '../../services/fantasy/weekPlan';
import { formatPuckDrop, shortDate, weekdayAbbrev } from '../../services/nhl/dates';
import { formatValue, goaliePoints, skaterPoints } from '../../services/fantasy/scoring';
import type { ScoringWeights } from '../../types/fantasy';

/** Re-render on an interval so countdowns stay honest. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function matchupText(game: Pick<PlayerGameDay, 'isHome' | 'opponent'>): string {
  return `${game.isHome ? 'vs' : '@'} ${game.opponent}`;
}

export function liveLineText(line: GameLine): string {
  if (line.isGoalie) {
    return `${line.saves} SV · ${line.goalsAgainst} GA`;
  }
  const parts: string[] = [];
  if (line.goals) parts.push(`${line.goals}G`);
  if (line.assists) parts.push(`${line.assists}A`);
  if (parts.length === 0) parts.push('0 PTS');
  parts.push(`${line.shots} SOG`);
  if (line.hits) parts.push(`${line.hits} HIT`);
  if (line.blocks) parts.push(`${line.blocks} BLK`);
  return parts.join(' · ');
}

/** Box-score value so far. Box scores don't carry PPP assists — PP goals only. */
export function liveLineValue(line: GameLine, scoring: ScoringWeights, won = false): number {
  if (line.isGoalie) {
    return goaliePoints({ wins: won ? 1 : 0, saves: line.saves, goalsAgainst: line.goalsAgainst }, scoring);
  }
  return skaterPoints(
    {
      goals: line.goals,
      assists: line.assists,
      ppp: line.powerPlayGoals,
      shots: line.shots,
      hits: line.hits,
      blocks: line.blocks,
      plusMinus: line.plusMinus,
    },
    scoring,
  );
}

export function gameClock(game: { state: string; period?: number | null; clock?: string | null; inIntermission?: boolean }): string {
  if (['FINAL', 'OFF', 'OVER'].includes(game.state)) return 'Final';
  if (game.inIntermission) return `INT ${game.period ?? ''}`.trim();
  if (game.period) {
    const label = game.period > 3 ? 'OT' : `P${game.period}`;
    return game.clock ? `${label} ${game.clock}` : label;
  }
  return 'Live';
}

export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Tonight';
  return `${weekdayAbbrev(date).slice(0, 1)}${weekdayAbbrev(date).slice(1).toLowerCase()} ${shortDate(date)}`;
}

export { formatPuckDrop, formatValue };
