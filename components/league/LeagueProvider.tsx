/**
 * League Room state for the active team, shared by every screen: the room it's in, that room's
 * latest snapshot, and the room's commands (`useRoomActions`). Loads when the team or account
 * changes, re-reads the room on every return to the foreground, and polls each minute while a
 * League screen watches (`useRoomFocus`). `useRoomSync` keeps the room and the team in step.
 *
 * Mount inside AuthProvider and TeamsProvider.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { RoomSnapshot } from '../../types/league';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  createRoom,
  fetchRoomSnapshot,
  isLeagueUnavailable,
  joinRoom,
  leaveRoom,
  react as sendReaction,
  removeMember,
  rotateRoomCode,
  setDuesPaid,
  takenPlayerIds,
  toLeagueError,
  updateMembership,
  updateRoom,
  type LeagueApi,
  type LeagueError,
} from '../../services/league';
import { setTeamRoom } from '../../services/teams';
import { useAuthContext } from '../auth/AuthProvider';
import { useTeams } from '../TeamsProvider';
import { deriveLeagueStatus, type LeagueStatus } from './leagueState';
import { useRoomActions, type LeagueResult, type RoomActions, type RoomContext } from './useRoomActions';
import { useRoomSync } from './useRoomSync';

export type { JoinOptions, LeagueResult } from './useRoomActions';
export type { LeagueStatus } from './leagueState';

/** How often an open League screen re-reads the room. Rosters and reactions move at human speed. */
export const ROOM_POLL_MS = 60 * 1000;
/** A League screen coming into focus (or a just-created room) isn't re-read if it was read this recently. */
export const FOCUS_REFRESH_MIN_MS = 15 * 1000;
/** After the backend says League Rooms aren't deployed, coming-soon holds this long before a return to the app lets the member try again. */
export const UNAVAILABLE_RECHECK_MS = 30 * 60 * 1000;

export interface LeagueContextValue extends RoomActions {
  status: LeagueStatus;
  /** The active team's room, only while `status` is ready (kept on screen while a refresh fails). */
  snapshot: RoomSnapshot | null;
  /** The latest load failure for this room. */
  error: LeagueError | null;
  /** A one-off message, e.g. after the room closed or the owner removed this team. */
  notice: string | null;
  dismissNotice: () => void;
  refreshing: boolean;
  refresh: () => Promise<void>;
  /** Players on league-mates' rosters; empty unless a room is ready. */
  takenIds: Set<number>;
  /** Keeps the room polling while the caller is on screen; returns the stop function. */
  watch: () => () => void;
}

/** The app's League Room calls (services/league, bound to the shared Supabase client). */
const APP_LEAGUE_API: LeagueApi = {
  createRoom,
  joinRoom,
  leaveRoom,
  fetchRoomSnapshot,
  updateMembership,
  updateRoom,
  setDuesPaid,
  removeMember,
  rotateRoomCode,
  react: sendReaction,
};

const EMPTY_IDS: Set<number> = new Set();
const LeagueContext = createContext<LeagueContextValue | undefined>(undefined);

interface Loaded {
  /** `${userId}|${roomId}`: a snapshot only ever shows for the account and room it was read for. */
  key: string;
  snapshot: RoomSnapshot;
}

function roomKey(userId: string | null, roomId: string | null): string | null {
  return userId && roomId ? `${userId}|${roomId}` : null;
}

function sameIds(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/** The same Set for as long as its contents hold, so Pickups doesn't re-rank on every poll. */
function useStableIds(next: Set<number>): Set<number> {
  const previous = useRef(next);
  if (previous.current !== next && !sameIds(previous.current, next)) previous.current = next;
  return previous.current;
}

export function LeagueProvider({
  children,
  api = APP_LEAGUE_API,
  configured = isSupabaseConfigured,
}: {
  children: React.ReactNode;
  /** Injected in tests; the app uses services/league. */
  api?: LeagueApi;
  /** Whether this build has a backend (Supabase keys). */
  configured?: boolean;
}) {
  const { user, initializing } = useAuthContext();
  const { ready: teamsReady, team, teams, updateTeam, setActiveTeam } = useTeams();
  const userId = user?.id ?? null;
  const roomId = team?.roomId ?? null;
  // No backend in this build: nothing to read, poll or sync.
  const key = configured ? roomKey(userId, roomId) : null;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: LeagueError } | null>(null);
  const [unavailableSince, setUnavailableSince] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [watchers, setWatchers] = useState(0);

  const snapshot = loaded?.key === key ? loaded.snapshot : null;
  const error = failure?.key === key ? failure.error : null;
  const status = deriveLeagueStatus({
    available: !!configured && unavailableSince === null,
    ready: teamsReady && !initializing,
    userId,
    roomId,
    snapshot,
    failed: error !== null,
  });
  const readySnapshot = status === 'ready' ? snapshot : null;

  // The latest render's values, for callbacks that stay stable across renders.
  const latest = useRef<RoomContext & { key: string | null }>({ key, userId, roomId, team, teams, snapshot: readySnapshot });
  latest.current = { key, userId, roomId, team, teams, snapshot: readySnapshot };
  const current = useCallback((): RoomContext => latest.current, []);
  const requestId = useRef(0);
  /** The room key last read and when, so a read that just happened isn't repeated. */
  const lastRead = useRef<{ key: string; at: number } | null>(null);
  const readRecently = useCallback((readKey: string | null) => {
    const last = lastRead.current;
    return !!readKey && !!last && last.key === readKey && Date.now() - last.at < FOCUS_REFRESH_MIN_MS;
  }, []);

  const release = useCallback(
    (teamId: string, lostRoom: string) => {
      updateTeam((row) => (row.roomId === lostRoom ? setTeamRoom(row, null) : row), teamId);
      setLoaded(null);
    },
    [updateTeam],
  );

  /** Every failure passes through here: "not deployed" turns on coming-soon, "not a member" unlinks the team. */
  const absorb = useCallback(
    (raw: unknown): LeagueError => {
      const failed = toLeagueError(raw);
      if (isLeagueUnavailable(failed) || failed.code === 'not_configured') setUnavailableSince(Date.now());
      const { team: active, roomId: room } = latest.current;
      if (failed.code === 'not_member' && active && room) {
        release(active.id, room);
        setNotice(failed.message);
      }
      return failed;
    },
    [release],
  );

  const load = useCallback(async (): Promise<void> => {
    const { key: loadKey, userId: me, roomId: room } = latest.current;
    if (!loadKey || !me || !room) return;
    const id = ++requestId.current;
    try {
      const next = await api.fetchRoomSnapshot(room, me);
      if (id !== requestId.current) return;
      lastRead.current = { key: loadKey, at: Date.now() };
      setLoaded({ key: loadKey, snapshot: next });
      setFailure(null);
      setUnavailableSince(null);
    } catch (raw) {
      if (id !== requestId.current) return;
      const failed = absorb(raw);
      if (failed.code !== 'not_member') setFailure({ key: loadKey, error: failed });
    }
  }, [api, absorb]);

  /** An optimistic change to the open room. A read already in flight predates it, so its answer is dropped. */
  const edit = useCallback((change: (open: RoomSnapshot) => RoomSnapshot) => {
    requestId.current += 1;
    setLoaded((previous) => (previous && previous.key === latest.current.key ? { ...previous, snapshot: change(previous.snapshot) } : previous));
  }, []);

  const perform = useCallback(
    async (action: () => Promise<void>): Promise<LeagueResult> => {
      try {
        await action();
        return null;
      } catch (raw) {
        return absorb(raw);
      }
    },
    [absorb],
  );

  /** Points a team at its new room, with the room already read when possible (no loading flash). */
  const adopt = useCallback(
    async (teamId: string, nextRoomId: string, me: string) => {
      try {
        const next = await api.fetchRoomSnapshot(nextRoomId, me);
        const adoptedKey = `${me}|${nextRoomId}`;
        lastRead.current = { key: adoptedKey, at: Date.now() };
        setLoaded({ key: adoptedKey, snapshot: next });
      } catch {
        // The load effect reads the room as soon as the team points at it.
      }
      setNotice(null);
      updateTeam((row) => setTeamRoom(row, nextRoomId), teamId);
    },
    [api, updateTeam],
  );

  const actions = useRoomActions({ api, current, perform, edit, reload: load, adopt, release, setActiveTeam });

  // Read the room on a new room or account (unless create / join just did), and again whenever the app returns to the foreground.
  useEffect(() => {
    if (!key) return;
    if (!readRecently(key)) void load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => subscription.remove();
  }, [key, load, readRecently]);

  // Poll while a League screen is watching.
  useEffect(() => {
    if (!key || watchers === 0) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void load();
    }, ROOM_POLL_MS);
    return () => clearInterval(timer);
  }, [key, watchers, load]);

  // Coming-soon holds for a while; after that, a return to the app lets the member try again.
  useEffect(() => {
    if (unavailableSince === null) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - unavailableSince >= UNAVAILABLE_RECHECK_MS) setUnavailableSince(null);
    });
    return () => subscription.remove();
  }, [unavailableSince]);

  useRoomSync({ api, team, snapshot: readySnapshot, updateTeam, onPushed: load, onError: absorb });

  const watch = useCallback(() => {
    setWatchers((count) => count + 1);
    if (!readRecently(latest.current.key)) void load();
    return () => setWatchers((count) => Math.max(0, count - 1));
  }, [load, readRecently]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const dismissNotice = useCallback(() => setNotice(null), []);
  const takenIds = useStableIds(useMemo(() => (readySnapshot ? takenPlayerIds(readySnapshot) : EMPTY_IDS), [readySnapshot]));

  const value = useMemo<LeagueContextValue>(
    () => ({ ...actions, status, snapshot: readySnapshot, error, notice, dismissNotice, refreshing, refresh, takenIds, watch }),
    [actions, status, readySnapshot, error, notice, dismissNotice, refreshing, refresh, takenIds, watch],
  );

  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague(): LeagueContextValue {
  const value = useContext(LeagueContext);
  if (!value) throw new Error('useLeague must be used within a LeagueProvider');
  return value;
}

/**
 * Players other members of the active team's room have rostered, for Pickups. Empty without a
 * ready room — including while League Rooms are unavailable — and outside a LeagueProvider.
 */
export function useRoomTakenIds(): Set<number> {
  return useContext(LeagueContext)?.takenIds ?? EMPTY_IDS;
}
