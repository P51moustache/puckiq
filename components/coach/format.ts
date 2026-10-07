/**
 * Small display helpers shared by the coach screens.
 */

import { useEffect, useState } from 'react';
import type { GameLine } from '../../services/nhl/gamecenter';
import type { PlayerGameDay } from '../../services/fantasy/weekPlan';
import { formatPuckDrop, shortDate, weekdayAbbrev } from '../../services/nhl/dates';
import { formatValue } from '../../services/fantasy/scoring';
import { gameClockText, linePoints, lineText } from '../../services/fantasy/nightScore';
import type { ScoringWeights } from '../../types/fantasy';
import { appNow } from '../../services/nhl/dates';

/** Re-render on an interval so countdowns stay honest. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => appNow());
  useEffect(() => {
    const timer = setInterval(() => setNow(appNow()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function matchupText(game: Pick<PlayerGameDay, 'isHome' | 'opponent'>): string {
  return `${game.isHome ? 'vs' : '@'} ${game.opponent}`;
}

/** Box-score value so far. One source of truth: services/fantasy/nightScore.linePoints. */
export function liveLineValue(line: GameLine, scoring: ScoringWeights, won = false): number {
  return linePoints(line, scoring, { final: won, won });
}

export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Tonight';
  return `${weekdayAbbrev(date).slice(0, 1)}${weekdayAbbrev(date).slice(1).toLowerCase()} ${shortDate(date)}`;
}

export { formatPuckDrop, formatValue };

/** Kept for existing imports; the formatters live in services/fantasy/nightScore. */
export const liveLineText = lineText;
export const gameClock = gameClockText;
