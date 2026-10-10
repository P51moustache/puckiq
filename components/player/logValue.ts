/** Fantasy value of one game-log row under the league's scoring (the chart and the log's VAL column). */

import type { ScoringWeights } from '../../types/fantasy';
import { goaliePoints, skaterPoints } from '../../services/fantasy/scoring';
import type { GameLogRow } from '../../services/nhl/player';

export function logRowValue(row: GameLogRow, goalie: boolean, scoring: ScoringWeights): number {
  if (goalie) {
    return goaliePoints(
      { wins: row.decision === 'W' ? 1 : 0, saves: row.saves, goalsAgainst: row.goalsAgainst, shutouts: row.shutout ? 1 : 0 },
      scoring,
    );
  }
  return skaterPoints({ goals: row.goals, assists: row.assists, ppp: row.ppp, shots: row.shots, plusMinus: row.plusMinus }, scoring);
}
