/** Fantasy value of one game-log row under the league's scoring (the chart and the log's VAL column). */

import type { ScoringWeights } from '../../types/fantasy';
import { goaliePoints, skaterPoints } from './scoring';
import type { GameLogRow } from '../nhl/player';

/** The NHL game-log feed omits these categories; never imply its value is a full host total. */
export function gameLogValueNote(
  goalie: boolean,
  scoring: ScoringWeights,
): string | null {
  if (goalie || (!scoring.hits && !scoring.blocks)) return null;
  const missing = [
    scoring.hits ? 'hits' : null,
    scoring.blocks ? 'blocks' : null,
  ]
    .filter(Boolean)
    .join(' and ');
  return `Game-log fantasy value excludes ${missing}; this feed does not report them.`;
}

export function logRowValue(
  row: GameLogRow,
  goalie: boolean,
  scoring: ScoringWeights,
): number {
  if (goalie) {
    return goaliePoints(
      {
        wins: row.decision === 'W' ? 1 : 0,
        saves: row.saves,
        goalsAgainst: row.goalsAgainst,
        shutouts: row.shutout ? 1 : 0,
      },
      scoring,
    );
  }
  return skaterPoints(
    {
      goals: row.goals,
      assists: row.assists,
      ppp: row.ppp,
      shots: row.shots,
      plusMinus: row.plusMinus,
    },
    scoring,
  );
}
