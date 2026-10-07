/**
 * What the room knows about the league's player pool: who's taken, how much of the league has
 * joined, and whose roster may be out of date.
 */

import type { RoomMember, RoomSnapshot } from '../../types/league';
import { byTeamName, otherMembers } from './members';

/**
 * A roster unconfirmed for two days is probably missing a move. The app re-confirms its roster
 * daily (ROSTER_REFRESH_HOURS in sync.ts), so only members who stopped opening PuckIQ go stale.
 */
export const STALE_ROSTER_HOURS = 48;

const HOUR_MS = 60 * 60 * 1000;

export interface RoomCoverage {
  /** Members in the room. */
  joined: number;
  /** Members whose roster is in the room (at least one player). */
  synced: number;
  leagueSize: number;
}

/** Every player on another member's roster — IR included, since he's still rostered. For Pickups. */
export function takenPlayerIds(snapshot: RoomSnapshot): Set<number> {
  const taken = new Set<number>();
  for (const member of otherMembers(snapshot)) {
    for (const player of member.roster) taken.add(player.playerId);
  }
  return taken;
}

export function roomCoverage(snapshot: RoomSnapshot): RoomCoverage {
  return {
    joined: snapshot.members.length,
    synced: snapshot.members.filter((member) => member.roster.length > 0).length,
    leagueSize: snapshot.room.leagueSize,
  };
}

/** Hours since this member's roster was last pushed; Infinity when the timestamp is unreadable. */
export function rosterAgeHours(member: Pick<RoomMember, 'rosterUpdatedAt'>, now: Date): number {
  const updated = Date.parse(member.rosterUpdatedAt);
  return Number.isFinite(updated) ? Math.max(0, (now.getTime() - updated) / HOUR_MS) : Number.POSITIVE_INFINITY;
}

/** Other members whose roster is older than `maxAgeHours`, oldest first. */
export function staleMembers(snapshot: RoomSnapshot, now: Date, maxAgeHours: number = STALE_ROSTER_HOURS): RoomMember[] {
  return otherMembers(snapshot)
    .map((member) => ({ member, age: rosterAgeHours(member, now) }))
    .filter(({ age }) => age > maxAgeHours)
    .sort((a, b) => (a.age === b.age ? byTeamName(a.member, b.member) : a.age > b.age ? -1 : 1))
    .map(({ member }) => member);
}
