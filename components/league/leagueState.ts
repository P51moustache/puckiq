/**
 * The League Room's state, derived and edited purely: which state the screen is in, the
 * opponent the room implies for the team, and the optimistic snapshot edits a tap shows at once
 * (the next fetch confirms or corrects them).
 */

import type { FantasyTeam } from '../../types/fantasy';
import type { Room, RoomReaction, RoomSnapshot } from '../../types/league';
import { roomOpponent } from '../../services/league';
import { applyRoomOpponent } from '../../services/teams';

/**
 * - `unavailable`: no backend in this build, or League Rooms aren't deployed on it yet.
 * - `signed_out`: rooms need an account (Sign in with Apple).
 * - `no_room`: signed in; the active team isn't in a room.
 * - `loading` / `ready` / `error`: the active team's room snapshot.
 */
export type LeagueStatus = 'unavailable' | 'signed_out' | 'no_room' | 'loading' | 'ready' | 'error';

export interface StatusInput {
  /** The build has a backend and its League Room schema answers. */
  available: boolean;
  /** Auth and teams have finished loading. */
  ready: boolean;
  userId: string | null;
  /** The active team's room. */
  roomId: string | null;
  /** The snapshot for exactly this account and room, when one has loaded. */
  snapshot: RoomSnapshot | null;
  /** The latest load failed. */
  failed: boolean;
}

export function deriveLeagueStatus({ available, ready, userId, roomId, snapshot, failed }: StatusInput): LeagueStatus {
  if (!available) return 'unavailable';
  if (!ready) return 'loading';
  if (!userId) return 'signed_out';
  if (!roomId) return 'no_room';
  if (snapshot) return 'ready';
  return failed ? 'error' : 'loading';
}

/**
 * The team with the room's opponent applied (the same object when nothing changes). When the room
 * no longer pairs this team, a room-sourced opponent is cleared; a typed-in one is never touched.
 */
export function teamWithRoomOpponent(team: FantasyTeam, snapshot: RoomSnapshot): FantasyTeam {
  const opponent = roomOpponent(snapshot);
  if (opponent) return applyRoomOpponent(team, opponent.teamName, opponent.players);
  const holdsRoomOpponent = team.opponentSource === 'room' && (team.opponent.length > 0 || team.opponentName !== '');
  return holdsRoomOpponent ? applyRoomOpponent(team, '', []) : team;
}

/** My pick for this week's opponent (null clears it). */
export function withOpponentPick(snapshot: RoomSnapshot, opponentUserId: string | null): RoomSnapshot {
  return {
    ...snapshot,
    members: snapshot.members.map((member) => (member.userId === snapshot.me ? { ...member, opponentUserId } : member)),
  };
}

export function withDuesPaid(snapshot: RoomSnapshot, userId: string, paid: boolean, now: Date): RoomSnapshot {
  const updatedAt = now.toISOString();
  const known = snapshot.dues.some((status) => status.userId === userId);
  const dues = known
    ? snapshot.dues.map((status) => (status.userId === userId ? { ...status, paid, updatedAt } : status))
    : [...snapshot.dues, { roomId: snapshot.room.id, userId, paid, updatedAt }];
  return { ...snapshot, dues };
}

/** The room without a member: their row, dues, reactions, and anyone's pick pointing at them. */
export function withoutMember(snapshot: RoomSnapshot, userId: string): RoomSnapshot {
  return {
    ...snapshot,
    members: snapshot.members
      .filter((member) => member.userId !== userId)
      .map((member) => (member.opponentUserId === userId ? { ...member, opponentUserId: null } : member)),
    dues: snapshot.dues.filter((status) => status.userId !== userId),
    reactions: snapshot.reactions.filter((row) => row.fromUserId !== userId && row.toUserId !== userId),
  };
}

/** A room row the server returned (renamed, new code, new dues). Ignored if it's another room. */
export function withRoom(snapshot: RoomSnapshot, room: Room): RoomSnapshot {
  return room.id === snapshot.room.id ? { ...snapshot, room } : snapshot;
}

/** My reaction, shown before the server confirms it. Pending rows get negative ids (server ids are positive). */
export function withReaction(snapshot: RoomSnapshot, toUserId: string, emoji: RoomReaction, now: Date): RoomSnapshot {
  const id = Math.min(0, ...snapshot.reactions.map((row) => row.id)) - 1;
  const row = { id, roomId: snapshot.room.id, fromUserId: snapshot.me, toUserId, emoji, createdAt: now.toISOString() };
  return { ...snapshot, reactions: [row, ...snapshot.reactions] };
}
