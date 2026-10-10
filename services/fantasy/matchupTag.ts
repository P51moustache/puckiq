/**
 * Matchup tags: how tonight's opponent treats a player's fantasy night. Skaters care how many
 * goals the opponent allows (`matchupRank`, 1 = allows the most); goalies care how many it scores
 * (`offenseRank`, 1 = scores the most). See TeamStrength in services/nhl/teams.ts.
 */

import type { TeamStrength } from '../nhl/teams';
import type { PlayerForm } from './form';

/** The top quarter of a 32-team league earns a tag, and so does the bottom quarter. */
export const MATCHUP_TOP_RANK = 8;
export const MATCHUP_BOTTOM_RANK = 25;

export interface MatchupTag {
  label: string;
  tone: 'good' | 'bad';
}

export type OpponentRanks = Pick<TeamStrength, 'offenseRank' | 'matchupRank'>;

/** Skaters care how many goals the opponent allows; goalies care how many it scores. */
export function matchupTagFor(form: Pick<PlayerForm, 'isGoalie'> | undefined, opponent: OpponentRanks | undefined): MatchupTag | null {
  if (!opponent) return null;
  if (form?.isGoalie) {
    if (opponent.offenseRank <= MATCHUP_TOP_RANK) return { label: 'TOUGH O', tone: 'bad' };
    return opponent.offenseRank >= MATCHUP_BOTTOM_RANK ? { label: 'WEAK O', tone: 'good' } : null;
  }
  if (opponent.matchupRank <= MATCHUP_TOP_RANK) return { label: 'SOFT D', tone: 'good' };
  return opponent.matchupRank >= MATCHUP_BOTTOM_RANK ? { label: 'TOUGH D', tone: 'bad' } : null;
}
