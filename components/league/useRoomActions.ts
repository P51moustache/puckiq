/**
 * The League Room's commands: create, join, leave, and everything a member or owner can change.
 * Each returns null on success or the LeagueError to show. Taps that change what the room shows
 * (opponent, reactions, dues ticks) apply optimistically and the next read confirms them.
 */

import { useCallback, useMemo } from 'react';
import type { FantasyTeam } from '../../types/fantasy';
import type { RoomDues, RoomReaction, RoomSnapshot } from '../../types/league';
import { LeagueError, type LeagueApi } from '../../services/league';
import { track } from '../../services/analytics/track';
import { withDuesPaid, withOpponentPick, withoutMember, withReaction, withRoom } from './leagueState';

/** null on success, otherwise the failure with its user-facing message. */
export type LeagueResult = LeagueError | null;

export interface JoinOptions {
  source: 'link' | 'code';
  /** The local team that joins (it becomes the active team); the active team when omitted. */
  teamId?: string;
}

export interface RoomActions {
  create: () => Promise<LeagueResult>;
  join: (code: string, options: JoinOptions) => Promise<LeagueResult>;
  leave: () => Promise<LeagueResult>;
  setOpponent: (userId: string | null) => Promise<LeagueResult>;
  react: (toUserId: string, emoji: RoomReaction) => Promise<LeagueResult>;
  setDuesPaid: (userId: string, paid: boolean) => Promise<LeagueResult>;
  saveDues: (dues: RoomDues) => Promise<LeagueResult>;
  rename: (name: string) => Promise<LeagueResult>;
  rotateCode: () => Promise<LeagueResult>;
  removeMember: (userId: string) => Promise<LeagueResult>;
}

export interface RoomContext {
  team: FantasyTeam | null;
  teams: FantasyTeam[];
  userId: string | null;
  roomId: string | null;
  snapshot: RoomSnapshot | null;
}

/** What the commands need from the provider. Every function must be stable across renders. */
export interface RoomActionDeps {
  api: LeagueApi;
  /** The active team, account, room and snapshot at call time. */
  current: () => RoomContext;
  /** Runs a command and turns any failure into a LeagueResult (with its side effects). */
  perform: (action: () => Promise<void>) => Promise<LeagueResult>;
  /** An optimistic change to the open room. */
  edit: (change: (open: RoomSnapshot) => RoomSnapshot) => void;
  reload: () => Promise<void>;
  /** Points a team at a room it just created or joined. */
  adopt: (teamId: string, roomId: string, userId: string) => Promise<void>;
  /** Unlinks a team from the room it left. */
  release: (teamId: string, roomId: string) => void;
  setActiveTeam: (teamId: string) => void;
}

export function useRoomActions({ api, current, perform, edit, reload, adopt, release, setActiveTeam }: RoomActionDeps): RoomActions {
  /** An optimistic edit, the call, and a re-read only when the call fails (the next poll confirms a success). */
  const optimistic = useCallback(
    async (change: (open: RoomSnapshot) => RoomSnapshot, call: () => Promise<void>) => {
      edit(change);
      try {
        await call();
      } catch (raw) {
        void reload();
        throw raw;
      }
    },
    [edit, reload],
  );

  /** Owner edits go through update_room, which always takes both the name and the dues. */
  const saveRoom = useCallback(
    async (name: string, dues: RoomDues) => {
      const { roomId } = current();
      if (!roomId) return;
      const room = await api.updateRoom(roomId, name, dues);
      edit((open) => withRoom(open, room));
    },
    [api, current, edit],
  );

  const create = useCallback(
    () =>
      perform(async () => {
        const { team, userId } = current();
        if (!userId) throw new LeagueError('not_signed_in');
        if (!team) throw new LeagueError('invalid_input');
        const room = await api.createRoom(team);
        await adopt(team.id, room.id, userId);
        track('room_create', { platform: team.platform, league_size: team.leagueSize });
      }),
    [api, current, perform, adopt],
  );

  const join = useCallback(
    (code: string, { source, teamId }: JoinOptions) =>
      perform(async () => {
        const { team: active, teams, userId } = current();
        const target = (teamId ? teams.find((row) => row.id === teamId) : undefined) ?? active;
        if (!userId) throw new LeagueError('not_signed_in');
        if (!target) throw new LeagueError('invalid_input');
        const room = await api.joinRoom(code, target);
        await adopt(target.id, room.id, userId);
        if (target.id !== active?.id) setActiveTeam(target.id);
        track('room_join', { source });
      }),
    [api, current, perform, adopt, setActiveTeam],
  );

  const leave = useCallback(
    () =>
      perform(async () => {
        const { team, roomId } = current();
        if (!team || !roomId) return;
        await api.leaveRoom(roomId);
        release(team.id, roomId);
        track('room_leave', {});
      }),
    [api, current, perform, release],
  );

  const setOpponent = useCallback(
    (opponentUserId: string | null) =>
      perform(async () => {
        const { team, roomId } = current();
        if (!team || !roomId) return;
        edit((open) => withOpponentPick(open, opponentUserId));
        try {
          await api.updateMembership(roomId, team, opponentUserId);
        } finally {
          void reload();
        }
      }),
    [api, current, perform, edit, reload],
  );

  const react = useCallback(
    (toUserId: string, emoji: RoomReaction) =>
      perform(async () => {
        const { roomId } = current();
        if (!roomId) return;
        await optimistic((open) => withReaction(open, toUserId, emoji, new Date()), () => api.react(roomId, toUserId, emoji));
        track('room_reaction', { emoji });
      }),
    [api, current, perform, optimistic],
  );

  const setDuesPaid = useCallback(
    (memberId: string, paid: boolean) =>
      perform(async () => {
        const { roomId } = current();
        if (!roomId) return;
        await optimistic((open) => withDuesPaid(open, memberId, paid, new Date()), () => api.setDuesPaid(roomId, memberId, paid));
      }),
    [api, current, perform, optimistic],
  );

  const saveDues = useCallback(
    (dues: RoomDues) =>
      perform(async () => {
        const { snapshot } = current();
        if (!snapshot) return;
        await saveRoom(snapshot.room.name, dues);
        track('room_dues_edit', { has_amount: dues.amount !== null, payouts: dues.payouts.length, pot_link: dues.potLink !== null });
      }),
    [current, perform, saveRoom],
  );

  const rename = useCallback(
    (name: string) =>
      perform(async () => {
        const { snapshot } = current();
        if (!snapshot) return;
        await saveRoom(name, snapshot.room.dues);
      }),
    [current, perform, saveRoom],
  );

  const rotateCode = useCallback(
    () =>
      perform(async () => {
        const { roomId } = current();
        if (!roomId) return;
        const room = await api.rotateRoomCode(roomId);
        edit((open) => withRoom(open, room));
      }),
    [api, current, perform, edit],
  );

  const removeMember = useCallback(
    (memberId: string) =>
      perform(async () => {
        const { roomId } = current();
        if (!roomId) return;
        await api.removeMember(roomId, memberId);
        edit((open) => withoutMember(open, memberId));
        void reload();
      }),
    [api, current, perform, edit, reload],
  );

  return useMemo(
    () => ({ create, join, leave, setOpponent, react, setDuesPaid, saveDues, rename, rotateCode, removeMember }),
    [create, join, leave, setOpponent, react, setDuesPaid, saveDues, rename, rotateCode, removeMember],
  );
}
