/**
 * When this device should push its team to the room (`updateMembership`). Pure decisions; the
 * caller owns the timer and the network call.
 */

import type { FantasyPlayer, FantasyTeam } from '../../types/fantasy';
import type { RoomMember } from '../../types/league';
import { eligibleSlots } from '../fantasy/positions';
import { rosterAgeHours, STALE_ROSTER_HOURS } from './availability';
import { roomTeamName } from './moderation';
import { rosterForUpload } from './roster';

/**
 * Wait this long after the last roster edit before pushing. Edits come in bursts (adding players
 * from search, flipping IR on two players); one write per burst keeps the room current within
 * seconds without an RPC per tap.
 */
export const ROSTER_PUSH_DEBOUNCE_MS = 5_000;

/**
 * Re-push an unchanged roster after this long, so `roster_updated_at` means "confirmed lately",
 * not "last edited". Half of STALE_ROSTER_HOURS: a member who opens PuckIQ daily never reads as
 * stale to the rest of the room.
 */
export const ROSTER_REFRESH_HOURS = STALE_ROSTER_HOURS / 2;

/** Everything about a player the room uses: id, name, NHL team, slot eligibility, IR. */
function fingerprint(player: FantasyPlayer): string {
  return [player.playerId, player.playerName, player.teamAbbrev, eligibleSlots(player).join('/'), player.injuredReserve ? 'IR' : ''].join('|');
}

function sameRoster(a: FantasyPlayer[], b: FantasyPlayer[]): boolean {
  if (a.length !== b.length) return false;
  const theirs = new Set(b.map(fingerprint));
  return a.every((player) => theirs.has(fingerprint(player)));
}

/**
 * Whether the room's copy of my membership is behind this team: a different team name, a player
 * added or dropped, or a player's NHL team, eligibility or IR changed (order doesn't matter).
 * Pass `now` (on app focus) to also re-confirm a roster older than ROSTER_REFRESH_HOURS.
 * No member row means there's nothing to compare against yet — the snapshot hasn't loaded, or I'm
 * not in the room and `updateMembership` would fail — so no push.
 */
export function rosterNeedsPush(team: FantasyTeam, member: RoomMember | undefined, now?: Date): boolean {
  if (!member) return false;
  if (roomTeamName(team.name) !== member.teamName) return true;
  if (!sameRoster(rosterForUpload(team.players), member.roster)) return true;
  return !!now && rosterAgeHours(member, now) >= ROSTER_REFRESH_HOURS;
}
