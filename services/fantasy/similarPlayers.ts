/**
 * "Similar players" on the player card: a few players at his position group (F / D / G) with
 * the nearest fantasy value who are probably available. Not the ranked pickup list: no lineup
 * math, just his neighbours by value, so it is free for everyone.
 *
 * "Probably available" means none of: him, my roster, my opponent's roster, players I marked
 * taken, players a League Room knows are rostered, and the players a league this size almost
 * always rosters (likelyRosteredIds, the same cut Pickups uses).
 */

import type { FantasyTeam } from '../../types/fantasy';
import { likelyRosteredIds, type PickupCandidate } from './pickups';
import { normalizePosition } from './positions';

/** Enough to compare, short enough to stay one glance. */
export const SIMILAR_LIMIT = 3;

export type PositionGroup = 'F' | 'D' | 'G';

/** C / LW / RW are forwards; D and G stand alone. Null for an unknown position. */
export function positionGroup(position: string): PositionGroup | null {
  const pos = normalizePosition(position);
  if (pos === 'D' || pos === 'G') return pos;
  return pos ? 'F' : null;
}

export interface SimilarInput {
  /** The player on the card: id, NHL position and form value (value per team game). */
  player: { playerId: number; position: string; value: number };
  /** The pickup pool (loadPickupPool), the same one the Pickups tab ranks. */
  candidates: PickupCandidate[];
  team: Pick<FantasyTeam, 'players' | 'opponent' | 'hiddenPickupIds' | 'leagueSize' | 'slots'>;
  /** Players a League Room knows are rostered in this league. */
  takenIds?: ReadonlySet<number>;
  limit?: number;
}

/** Nearest value first; ties go to the higher value, then the lower id (stable order). */
export function similarPlayers({ player, candidates, team, takenIds, limit = SIMILAR_LIMIT }: SimilarInput): PickupCandidate[] {
  const group = positionGroup(player.position);
  if (!group || limit <= 0) return [];
  const unavailable = new Set<number>([
    player.playerId,
    ...team.players.map((rostered) => rostered.playerId),
    ...team.opponent.map((rostered) => rostered.playerId),
    ...team.hiddenPickupIds,
    ...(takenIds ?? []),
    ...likelyRosteredIds(candidates, team.leagueSize, team.slots),
  ]);
  const distance = (candidate: PickupCandidate) => Math.abs(candidate.form.value - player.value);
  return candidates
    .filter((candidate) => !unavailable.has(candidate.playerId) && positionGroup(candidate.position) === group)
    .sort((a, b) => distance(a) - distance(b) || b.form.value - a.form.value || a.playerId - b.playerId)
    .slice(0, limit);
}
