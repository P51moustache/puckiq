/**
 * Home is not a briefing newspaper:
 * "3 of YOUR guys play tonight. 1 problem. 1 move."
 */

import type { TonightPlayerStatus } from '../types/fantasy';
import { buildCoachSuggestions, type CoachSuggestion } from './coachSuggestions';

export function isTonightProblem(row: TonightPlayerStatus): boolean {
  if (row.injurySignal === 'scratch' || row.injurySignal === 'out') return true;
  if (row.position === 'G' && row.opponentAbbrev && row.recommendation === 'FLEX') return true;
  return false;
}

export function countPlayingTonight(statuses: TonightPlayerStatus[]): number {
  return statuses.filter((row) => !!row.opponentAbbrev).length;
}

export interface TonightHeadline {
  playing: number;
  problems: number;
  moves: number;
  primaryMove: CoachSuggestion | null;
  text: string;
}

export function buildTonightHeadline(statuses: TonightPlayerStatus[]): TonightHeadline {
  const playing = countPlayingTonight(statuses);
  const problems = statuses.filter(isTonightProblem).length;
  const suggestions = buildCoachSuggestions(statuses);
  const primaryMove = suggestions[0] ?? null;
  const moves = suggestions.length;
  const problemWord = problems === 1 ? 'problem' : 'problems';
  const moveWord = moves === 1 ? 'move' : 'moves';
  return {
    playing,
    problems,
    moves,
    primaryMove,
    text: `${playing} of YOUR guys play tonight. ${problems} ${problemWord}. ${moves} ${moveWord}.`,
  };
}
