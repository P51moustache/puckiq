/**
 * How complete a roster is during setup. New users who continued with 1–4 players never came back
 * (Oct 2026: 0 of 7, against 5 of 12 with a full team), so setup says plainly when a roster can't
 * fill a lineup yet instead of a bare "Continue with 2".
 */

import { STANDARD_SLOTS } from '../fantasy/lineup';

/** About how many players a fantasy hockey team rosters, bench included (the sample team has 16). */
export const TYPICAL_ROSTER_SIZE = 16;

/** Fewer players than a standard lineup's starting slots can't fill one, so the calls can't be real. */
export const FULL_LINEUP_SIZE = Object.values(STANDARD_SLOTS).reduce((total, count) => total + count, 0);

/** Some players, but not enough to fill a standard lineup. */
export function isPartialRoster(players: number): boolean {
  return players > 0 && players < FULL_LINEUP_SIZE;
}

/** The setup button: "Continue with 2 for now" while partial, "Continue with 18" once full. */
export function rosterContinueLabel(players: number): string {
  if (players === 0) return 'Add a player to continue';
  return isPartialRoster(players) ? `Continue with ${players} for now` : `Continue with ${players}`;
}
