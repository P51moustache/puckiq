/**
 * League Room calls: thin async wrappers over the backend's RPCs (every write) and RLS-filtered
 * selects (every read). Every failure surfaces as a LeagueError carrying user-facing copy.
 *
 * Cheap local checks (names, codes, dues, emoji, self-targeting) run first, so obvious mistakes
 * fail without a round trip and with the same code the server would use.
 */

import type { FantasyTeam } from '../../types/fantasy';
import { ROOM_REACTIONS, type Room, type RoomDues, type RoomReaction, type RoomSnapshot } from '../../types/league';
import { defaultLeagueDeps, type BackendResult, type LeagueApiDeps, type SelectQuery } from './backend';
import { codeFromLink } from './codes';
import { validateDues } from './dues';
import { LeagueError, toLeagueError } from './errors';
import {
  DUES_STATUS_COLUMNS,
  firstRow,
  fromRoomDues,
  MEMBER_COLUMNS,
  REACTION_COLUMNS,
  ROOM_COLUMNS,
  rowsOf,
  toRoom,
  toRoomDuesStatus,
  toRoomMember,
  toRoomReaction,
} from './mappers';
import { cleanRoomText, roomTeamName } from './moderation';
import { rosterForUpload } from './roster';

/** Room name when the creator doesn't type one; the owner can rename it any time. */
export const DEFAULT_ROOM_NAME = 'Our League';

/**
 * Reactions loaded per snapshot, newest first. Senders are capped at 30 an hour and rows are
 * purged after 7 days, so this covers a real room's recent history without an unbounded payload.
 */
export const REACTIONS_FETCH_LIMIT = 200;

export interface CreateRoomOptions {
  /** Defaults to DEFAULT_ROOM_NAME. Must pass `cleanRoomText`. */
  roomName?: string;
}

export interface LeagueApi {
  /** New room from this team's league settings; I become owner and first member. */
  createRoom(team: FantasyTeam, options?: CreateRoomOptions): Promise<Room>;
  /** `code` may be a bare code, an invite link or a deep link. Re-joining updates my name and roster. */
  joinRoom(code: string, team: FantasyTeam): Promise<Room>;
  leaveRoom(roomId: string): Promise<void>;
  /** Room, members, dues and reactions in parallel. `not_member` once I'm out or the room is gone. */
  fetchRoomSnapshot(roomId: string, me: string): Promise<RoomSnapshot>;
  /**
   * Replaces my whole membership row: team name, roster and opponent. When only the roster
   * changed, pass my current pick (`myMember(snapshot)?.opponentUserId ?? null`) or it's cleared.
   */
  updateMembership(roomId: string, team: FantasyTeam, opponentUserId: string | null): Promise<void>;
  /** Owner only. */
  updateRoom(roomId: string, name: string, dues: RoomDues): Promise<Room>;
  /** Owner only. */
  setDuesPaid(roomId: string, userId: string, paid: boolean): Promise<void>;
  /** Owner only, never yourself (leave instead). */
  removeMember(roomId: string, userId: string): Promise<void>;
  /** Owner only. Old invite links stop working. */
  rotateRoomCode(roomId: string): Promise<Room>;
  react(roomId: string, toUserId: string, emoji: RoomReaction): Promise<void>;
}

function compact<T>(items: (T | null)[]): T[] {
  return items.filter((item): item is T => item !== null);
}

function requireRoomName(name: string): string {
  const result = cleanRoomText(name);
  if (!result.ok) throw new LeagueError('invalid_name');
  return result.value;
}

function membershipArgs(team: FantasyTeam): { p_team_name: string; p_roster: unknown } {
  return { p_team_name: roomTeamName(team.name), p_roster: rosterForUpload(team.players) };
}

export function createLeagueApi({ backend, configured }: LeagueApiDeps): LeagueApi {
  async function settle(request: () => PromiseLike<BackendResult>): Promise<unknown> {
    let result: BackendResult;
    try {
      result = await request();
    } catch (error) {
      throw toLeagueError(error);
    }
    if (result.error) throw toLeagueError(result.error, result.status);
    return result.data;
  }

  async function requireUser(): Promise<string> {
    if (!configured) throw new LeagueError('not_configured');
    let userId: string | null;
    try {
      userId = await backend.currentUserId();
    } catch (error) {
      throw toLeagueError(error);
    }
    if (!userId) throw new LeagueError('not_signed_in');
    return userId;
  }

  const call = (name: string, args: Record<string, unknown>) => settle(() => backend.rpc(name, args));
  const select = (query: SelectQuery) => settle(() => backend.select(query));

  async function callForRoom(name: string, args: Record<string, unknown>): Promise<Room> {
    const room = toRoom(firstRow(await call(name, args)));
    // The server answered, but not with a room: treat it like a failed round trip.
    if (!room) throw new LeagueError('network');
    return room;
  }

  return {
    async createRoom(team, options = {}) {
      await requireUser();
      const name = requireRoomName(options.roomName ?? DEFAULT_ROOM_NAME);
      return callForRoom('create_room', {
        p_name: name,
        p_platform: team.platform,
        p_league_size: team.leagueSize,
        p_slots: team.slots,
        p_scoring: team.scoring,
        ...membershipArgs(team),
      });
    },

    async joinRoom(code, team) {
      await requireUser();
      const parsed = codeFromLink(code);
      if (!parsed) throw new LeagueError('invalid_code');
      return callForRoom('join_room', { p_code: parsed, ...membershipArgs(team) });
    },

    async leaveRoom(roomId) {
      await requireUser();
      await call('leave_room', { p_room: roomId });
    },

    async fetchRoomSnapshot(roomId, me) {
      if (!configured) throw new LeagueError('not_configured');
      if (!me) throw new LeagueError('not_signed_in');
      const byRoom = { column: 'room_id', value: roomId };
      const [roomData, memberData, duesData, reactionData] = await Promise.all([
        select({ table: 'rooms', columns: ROOM_COLUMNS, match: { column: 'id', value: roomId }, limit: 1 }),
        select({ table: 'room_members', columns: MEMBER_COLUMNS, match: byRoom }),
        select({ table: 'room_dues_status', columns: DUES_STATUS_COLUMNS, match: byRoom }),
        select({
          table: 'room_reactions',
          columns: REACTION_COLUMNS,
          match: byRoom,
          order: { column: 'created_at', ascending: false },
          limit: REACTIONS_FETCH_LIMIT,
        }),
      ]);
      // RLS hides a room I'm not in, so "deleted" and "removed" look the same: both mean unlink.
      const room = toRoom(firstRow(roomData));
      const members = compact(rowsOf(memberData).map(toRoomMember)).sort(
        (a, b) => (Date.parse(a.joinedAt) || 0) - (Date.parse(b.joinedAt) || 0) || (a.userId < b.userId ? -1 : 1),
      );
      if (!room || !members.some((member) => member.userId === me)) throw new LeagueError('not_member');
      return {
        room,
        members,
        dues: compact(rowsOf(duesData).map(toRoomDuesStatus)),
        reactions: compact(rowsOf(reactionData).map(toRoomReaction)),
        me,
      };
    },

    async updateMembership(roomId, team, opponentUserId) {
      const me = await requireUser();
      if (opponentUserId === me) throw new LeagueError('invalid_opponent');
      await call('update_membership', { p_room: roomId, ...membershipArgs(team), p_opponent: opponentUserId });
    },

    async updateRoom(roomId, name, dues) {
      await requireUser();
      const cleanName = requireRoomName(name);
      const checked = validateDues(dues);
      if (!checked.ok) throw new LeagueError('invalid_dues');
      return callForRoom('update_room', { p_room: roomId, p_name: cleanName, p_dues: fromRoomDues(checked.dues) });
    },

    async setDuesPaid(roomId, userId, paid) {
      await requireUser();
      await call('set_dues_paid', { p_room: roomId, p_user: userId, p_paid: paid });
    },

    async removeMember(roomId, userId) {
      const me = await requireUser();
      if (userId === me) throw new LeagueError('cannot_remove_self');
      await call('remove_member', { p_room: roomId, p_user: userId });
    },

    async rotateRoomCode(roomId) {
      await requireUser();
      return callForRoom('rotate_room_code', { p_room: roomId });
    },

    async react(roomId, toUserId, emoji) {
      await requireUser();
      if (!(ROOM_REACTIONS as readonly string[]).includes(emoji)) throw new LeagueError('invalid_input');
      await call('react', { p_room: roomId, p_to_user: toUserId, p_emoji: emoji });
    },
  };
}

// The app's instance, bound to the shared Supabase client on first use (composition root).
let appApi: LeagueApi | null = null;
function api(): LeagueApi {
  appApi ??= createLeagueApi(defaultLeagueDeps());
  return appApi;
}

export const createRoom: LeagueApi['createRoom'] = (team, options) => api().createRoom(team, options);
export const joinRoom: LeagueApi['joinRoom'] = (code, team) => api().joinRoom(code, team);
export const leaveRoom: LeagueApi['leaveRoom'] = (roomId) => api().leaveRoom(roomId);
export const fetchRoomSnapshot: LeagueApi['fetchRoomSnapshot'] = (roomId, me) => api().fetchRoomSnapshot(roomId, me);
export const updateMembership: LeagueApi['updateMembership'] = (roomId, team, opponentUserId) =>
  api().updateMembership(roomId, team, opponentUserId);
export const updateRoom: LeagueApi['updateRoom'] = (roomId, name, dues) => api().updateRoom(roomId, name, dues);
export const setDuesPaid: LeagueApi['setDuesPaid'] = (roomId, userId, paid) => api().setDuesPaid(roomId, userId, paid);
export const removeMember: LeagueApi['removeMember'] = (roomId, userId) => api().removeMember(roomId, userId);
export const rotateRoomCode: LeagueApi['rotateRoomCode'] = (roomId) => api().rotateRoomCode(roomId);
export const react: LeagueApi['react'] = (roomId, toUserId, emoji) => api().react(roomId, toUserId, emoji);
