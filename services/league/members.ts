/**
 * Who's who in a room snapshot. Every League module asks the same questions — which row is
 * mine, who else is here, what order to list them in — so they're answered once, here.
 */

import type { RoomMember, RoomSnapshot } from '../../types/league';

/** My own membership row, if the snapshot has one. */
export function myMember(snapshot: RoomSnapshot): RoomMember | undefined {
  return snapshot.members.find((member) => member.userId === snapshot.me);
}

/** Everyone in the room except me. */
export function otherMembers(snapshot: RoomSnapshot): RoomMember[] {
  return snapshot.members.filter((member) => member.userId !== snapshot.me);
}

/** Alphabetical by team name (case-insensitive), then user id so equal names keep a stable order. */
export function byTeamName(a: Pick<RoomMember, 'teamName' | 'userId'>, b: Pick<RoomMember, 'teamName' | 'userId'>): number {
  return (
    a.teamName.localeCompare(b.teamName, undefined, { sensitivity: 'base' }) ||
    (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  );
}
