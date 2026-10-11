/** Chart-series definitions are a registry; each metric owns its value and formatting. */
import type { GameLogRow } from '../nhl/player';
import type { ScoringWeights } from '../../types/fantasy';
import { logRowValue } from './logValue';

export interface PerformanceMetric {
  id: string;
  label: string;
  value: (row: GameLogRow) => number | null;
}
export function performanceMetrics(
  goalie: boolean,
  scoring: ScoringWeights,
): PerformanceMetric[] {
  return [
    {
      id: 'value',
      label: 'Fantasy',
      value: (row) => logRowValue(row, goalie, scoring),
    },
    ...(goalie
      ? [
          {
            id: 'saves',
            label: 'Saves',
            value: (row: GameLogRow) => row.saves,
          },
          {
            id: 'savePct',
            label: 'SV%',
            value: (row: GameLogRow) =>
              row.shotsAgainst > 0 ? row.saves / row.shotsAgainst : null,
          },
          {
            id: 'goalsAgainst',
            label: 'GA',
            value: (row: GameLogRow) => row.goalsAgainst,
          },
        ]
      : [
          {
            id: 'points',
            label: 'Points',
            value: (row: GameLogRow) => row.points,
          },
          {
            id: 'goals',
            label: 'Goals',
            value: (row: GameLogRow) => row.goals,
          },
          {
            id: 'assists',
            label: 'Assists',
            value: (row: GameLogRow) => row.assists,
          },
          {
            id: 'shots',
            label: 'Shots',
            value: (row: GameLogRow) => row.shots,
          },
        ]),
  ];
}
