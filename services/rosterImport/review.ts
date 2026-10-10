/**
 * The review step of a roster import: everything found starts ticked, players already on my
 * team are shown but not re-added, and same-name players wait for the user's pick. Pure.
 */

import type { FantasyPlayer } from '../../types/fantasy';
import type { RosterPlayer } from '../nhl/rosters';
import type { RosterMatch } from './matchRoster';

export interface ImportReview {
  match: RosterMatch;
  /** Matched players already on my roster (shown as "on your team", never re-added). */
  alreadyOnTeam: ReadonlySet<number>;
  checked: ReadonlySet<number>;
  /** Index into match.ambiguous -> the chosen player's id. */
  picks: Readonly<Record<number, number>>;
}

export function startReview(match: RosterMatch, rosterIds: ReadonlySet<number>): ImportReview {
  const alreadyOnTeam = new Set(match.matched.map((m) => m.player.playerId).filter((id) => rosterIds.has(id)));
  const checked = new Set(match.matched.map((m) => m.player.playerId).filter((id) => !alreadyOnTeam.has(id)));
  return { match, alreadyOnTeam, checked, picks: {} };
}

export function toggleChecked(review: ImportReview, playerId: number): ImportReview {
  if (review.alreadyOnTeam.has(playerId)) return review;
  const checked = new Set(review.checked);
  if (checked.has(playerId)) checked.delete(playerId);
  else checked.add(playerId);
  return { ...review, checked };
}

/** Choosing the same option again clears the pick. */
export function pickOption(review: ImportReview, entry: number, playerId: number): ImportReview {
  const picks = { ...review.picks };
  if (picks[entry] === playerId) delete picks[entry];
  else picks[entry] = playerId;
  return { ...review, picks };
}

export function playersToAdd(review: ImportReview): RosterPlayer[] {
  const chosen = new Map<number, RosterPlayer>();
  for (const { player } of review.match.matched) {
    if (review.checked.has(player.playerId)) chosen.set(player.playerId, player);
  }
  review.match.ambiguous.forEach((entry, index) => {
    const option = entry.options.find((player) => player.playerId === review.picks[index]);
    if (option && !review.alreadyOnTeam.has(option.playerId)) chosen.set(option.playerId, option);
  });
  return [...chosen.values()];
}

export function toFantasyPlayer(player: RosterPlayer): FantasyPlayer {
  return {
    playerId: player.playerId,
    playerName: `${player.firstName} ${player.lastName}`,
    teamAbbrev: player.team,
    position: player.position,
    rosterPosition: 'BN',
  };
}
