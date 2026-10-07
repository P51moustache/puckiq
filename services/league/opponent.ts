/**
 * This week's head-to-head opponent, from the room. Feeds `applyRoomOpponent` (services/teams.ts)
 * so the Week matchup fills itself in.
 */

import type { FantasyPlayer } from '../../types/fantasy';
import type { RoomMember, RoomSnapshot } from '../../types/league';
import { byTeamName, myMember, otherMembers } from './members';

export interface RoomOpponent {
  userId: string;
  teamName: string;
  players: FantasyPlayer[];
  /** `me`: I picked them. `them`: they picked me and I haven't picked anyone. */
  pickedBy: 'me' | 'them';
}

function toOpponent(member: RoomMember, pickedBy: RoomOpponent['pickedBy']): RoomOpponent {
  return { userId: member.userId, teamName: member.teamName, players: member.roster, pickedBy };
}

/**
 * My opponent. My own pick wins; a pick pointing at someone who has left counts as no pick.
 * Matchups are mutual, so without a pick of my own, the one member who picked me is my opponent
 * — only one member needs to set the pairing. Two or more picking me is ambiguous: null.
 */
export function roomOpponent(snapshot: RoomSnapshot): RoomOpponent | null {
  const mine = myMember(snapshot);
  if (!mine) return null;
  const others = otherMembers(snapshot);
  const picked = mine.opponentUserId ? others.find((member) => member.userId === mine.opponentUserId) : undefined;
  if (picked) return toOpponent(picked, 'me');
  const pickedMe = others.filter((member) => member.opponentUserId === snapshot.me);
  return pickedMe.length === 1 ? toOpponent(pickedMe[0], 'them') : null;
}

/** Who I can pick as this week's opponent: everyone else, by team name. */
export function opponentChoices(snapshot: RoomSnapshot): RoomMember[] {
  return otherMembers(snapshot).sort(byTeamName);
}
