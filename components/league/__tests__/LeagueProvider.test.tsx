jest.mock('react-native', () => require('./support/reactNative').reactNativeMock());
jest.mock('../../auth/AuthProvider', () => ({ useAuthContext: () => mockAuth }));
jest.mock('../../../services/analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('../../TeamsProvider', () => {
  // A stateful stand-in with the real provider's contract: stable callbacks, updates re-render.
  const React = require('react');
  const Context = React.createContext(null);
  function TeamsProvider({ initial, children }: { initial: { activeTeamId: string; teams: unknown[] }; children: unknown }) {
    const [state, setState] = React.useState(initial);
    mockTeamsState.current = state;
    const updateTeam = React.useCallback((update: (team: any) => any, teamId?: string) => {
      setState((prev: any) => {
        const id = teamId ?? prev.activeTeamId;
        return { ...prev, teams: prev.teams.map((team: any) => (team.id === id ? update(team) : team)) };
      });
    }, []);
    const setActiveTeam = React.useCallback((id: string) => setState((prev: any) => ({ ...prev, activeTeamId: id })), []);
    const value = React.useMemo(
      () => ({ ready: true, teams: state.teams, team: state.teams.find((team: any) => team.id === state.activeTeamId) ?? null, updateTeam, setActiveTeam }),
      [state, updateTeam, setActiveTeam],
    );
    return React.createElement(Context.Provider, { value }, children);
  }
  return { TeamsProvider, useTeams: () => React.useContext(Context) };
});

import React from 'react';
import type { FantasyTeam } from '../../../types/fantasy';
import type { RoomSnapshot } from '../../../types/league';
import { LeagueError, ROSTER_PUSH_DEBOUNCE_MS, type LeagueApi } from '../../../services/league';
import { TeamsProvider } from '../../TeamsProvider';
import { LeagueProvider, ROOM_POLL_MS, UNAVAILABLE_RECHECK_MS, useLeague, useRoomTakenIds, type LeagueContextValue } from '../LeagueProvider';
import { withOpponentPick } from '../leagueState';
import { appState } from './support/reactNative';
import { render, settle, unmountAll } from './support/tree';
import { BEN, hughes, makeTeam, mcdavid, makar, ME, NOW, oettinger, player, quinn, roomSnapshot, shesterkin } from './support/fixtures';

const mockTrack = jest.fn();
const mockTeamsState: { current: { activeTeamId: string; teams: FantasyTeam[] } | null } = { current: null };
let mockAuth: { user: { id: string } | null; initializing: boolean } = { user: { id: ME }, initializing: false };

let league: LeagueContextValue;
let taken: Set<number>;
function Probe() {
  league = useLeague();
  taken = useRoomTakenIds();
  return null;
}

const MY_PLAYERS = [mcdavid, makar, shesterkin];
const ROOM = roomSnapshot().room;

/** A typed jest.fn for one LeagueApi method. */
function fn<K extends keyof LeagueApi>(impl: LeagueApi[K]): jest.MockedFunction<LeagueApi[K]> {
  return jest.fn(impl as (...args: unknown[]) => unknown) as unknown as jest.MockedFunction<LeagueApi[K]>;
}

function fakeApi(snapshot: () => RoomSnapshot = () => roomSnapshot()): jest.Mocked<LeagueApi> {
  return {
    createRoom: fn<'createRoom'>(async () => ROOM),
    joinRoom: fn<'joinRoom'>(async () => ROOM),
    leaveRoom: fn<'leaveRoom'>(async () => undefined),
    fetchRoomSnapshot: fn<'fetchRoomSnapshot'>(async () => snapshot()),
    updateMembership: fn<'updateMembership'>(async () => undefined),
    updateRoom: fn<'updateRoom'>(async (_id, name, dues) => ({ ...ROOM, name, dues })),
    setDuesPaid: fn<'setDuesPaid'>(async () => undefined),
    removeMember: fn<'removeMember'>(async () => undefined),
    rotateRoomCode: fn<'rotateRoomCode'>(async () => ({ ...ROOM, code: 'XYZ789' })),
    react: fn<'react'>(async () => undefined),
  };
}

function mount(api: LeagueApi, teams: FantasyTeam[], options: { configured?: boolean; activeTeamId?: string } = {}) {
  return render(
    <TeamsProvider {...({ initial: { activeTeamId: options.activeTeamId ?? teams[0].id, teams } } as object)}>
      <LeagueProvider api={api} configured={options.configured ?? true}>
        <Probe />
      </LeagueProvider>
    </TeamsProvider>,
  );
}

const activeTeam = () => mockTeamsState.current!.teams.find((team) => team.id === mockTeamsState.current!.activeTeamId)!;

describe('LeagueProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    jest.setSystemTime(NOW);
    mockTrack.mockClear();
    mockAuth = { user: { id: ME }, initializing: false };
    appState.reset();
  });

  afterEach(() => {
    unmountAll();
    jest.useRealTimers();
  });

  it('is unavailable in a build without a backend, with nothing taken and nothing fetched', async () => {
    const api = fakeApi();
    mount(api, [makeTeam({ roomId: 'room-1', players: MY_PLAYERS })], { configured: false });
    await settle();
    expect(league.status).toBe('unavailable');
    expect(taken.size).toBe(0);
    expect(api.fetchRoomSnapshot).not.toHaveBeenCalled();
  });

  it('asks for sign-in, then offers a room for a team without one', () => {
    mockAuth = { user: null, initializing: false };
    const api = fakeApi();
    mount(api, [makeTeam({ players: MY_PLAYERS })]);
    expect(league.status).toBe('signed_out');
    unmountAll();
    mockAuth = { user: { id: ME }, initializing: false };
    mount(api, [makeTeam({ players: MY_PLAYERS })]);
    expect(league.status).toBe('no_room');
    expect(api.fetchRoomSnapshot).not.toHaveBeenCalled();
  });

  it('creates a room for the active team and opens it without a loading step', async () => {
    const api = fakeApi();
    mount(api, [makeTeam({ players: MY_PLAYERS })]);
    let result: unknown;
    await settle(async () => {
      result = await league.create();
    });
    expect(result).toBeNull();
    expect(api.createRoom).toHaveBeenCalledWith(expect.objectContaining({ id: 'team-1' }));
    expect(activeTeam().roomId).toBe('room-1');
    expect(league.status).toBe('ready');
    expect(league.snapshot?.room.name).toBe('Beer League');
    // Read once for the new room, not again when the team starts pointing at it.
    expect(api.fetchRoomSnapshot).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('room_create', { platform: 'yahoo', league_size: 12 });
  });

  it('joins with the team picked on the invite and makes it the active team', async () => {
    const api = fakeApi();
    const second = makeTeam({ id: 'team-2', name: 'Second Line', players: MY_PLAYERS });
    mount(api, [makeTeam({ roomId: 'other-room' }), second]);
    await settle(async () => {
      await league.join('ABC234', { source: 'link', teamId: 'team-2' });
    });
    expect(api.joinRoom).toHaveBeenCalledWith('ABC234', expect.objectContaining({ id: 'team-2' }));
    expect(mockTeamsState.current!.activeTeamId).toBe('team-2');
    expect(activeTeam().roomId).toBe('room-1');
    expect(mockTrack).toHaveBeenCalledWith('room_join', { source: 'link' });
  });

  it('marks league-mates’ players taken (never mine) and keeps the same set while rosters hold', async () => {
    mount(fakeApi(), [makeTeam({ roomId: 'room-1', players: MY_PLAYERS })]);
    await settle();
    expect(league.status).toBe('ready');
    expect([...taken].sort()).toEqual([hughes.playerId, oettinger.playerId, quinn.playerId].sort());
    const first = taken;
    await settle(() => league.refresh());
    expect(taken).toBe(first);
  });

  it('fills the team’s matchup with the opponent picked in the room', async () => {
    mount(fakeApi(() => withOpponentPick(roomSnapshot(), BEN)), [makeTeam({ roomId: 'room-1', players: MY_PLAYERS })]);
    await settle();
    expect(activeTeam().opponentSource).toBe('room');
    expect(activeTeam().opponentName).toBe('Ben’s Bombers');
    expect(activeTeam().opponent.map((p) => p.playerId)).toEqual([hughes.playerId, quinn.playerId, oettinger.playerId]);
  });

  it('pushes a changed roster once edits settle, keeping the current opponent pick', async () => {
    const api = fakeApi(() => withOpponentPick(roomSnapshot(), BEN));
    const added = player(8471000, 'New Guy', 'TOR', 'C');
    mount(api, [makeTeam({ roomId: 'room-1', players: [...MY_PLAYERS, added] })]);
    await settle();
    expect(api.updateMembership).not.toHaveBeenCalled();
    await settle(() => jest.advanceTimersByTime(ROSTER_PUSH_DEBOUNCE_MS));
    expect(api.updateMembership).toHaveBeenCalledTimes(1);
    expect(api.updateMembership).toHaveBeenCalledWith('room-1', expect.objectContaining({ players: [...MY_PLAYERS, added] }), BEN);
  });

  it('sends a waiting roster push right away when the app leaves the foreground', async () => {
    const api = fakeApi();
    mount(api, [makeTeam({ roomId: 'room-1', players: [...MY_PLAYERS, player(8471000, 'New Guy', 'TOR', 'C')] })]);
    await settle();
    await settle(() => appState.set('background'));
    expect(api.updateMembership).toHaveBeenCalledTimes(1);
  });

  it('never pushes a roster the room already has', async () => {
    const api = fakeApi();
    mount(api, [makeTeam({ roomId: 'room-1', players: MY_PLAYERS })]);
    await settle();
    await settle(() => jest.advanceTimersByTime(ROSTER_PUSH_DEBOUNCE_MS * 2));
    expect(api.updateMembership).not.toHaveBeenCalled();
  });

  it('unlinks the team with a notice when the room closed or removed it', async () => {
    const api = fakeApi();
    api.fetchRoomSnapshot.mockRejectedValue(new LeagueError('not_member'));
    mount(api, [makeTeam({ roomId: 'room-1', players: MY_PLAYERS })]);
    await settle();
    expect(activeTeam().roomId).toBeUndefined();
    expect(league.status).toBe('no_room');
    expect(league.notice).toMatch(/not in this room anymore/);
  });

  it('keeps the room on screen when a refresh fails, and shows the error without one', async () => {
    const api = fakeApi();
    mount(api, [makeTeam({ roomId: 'room-1', players: MY_PLAYERS })]);
    await settle();
    api.fetchRoomSnapshot.mockRejectedValueOnce(new LeagueError('network'));
    await settle(() => league.refresh());
    expect(league.status).toBe('ready');
    expect(league.error?.code).toBe('network');
    unmountAll();
    api.fetchRoomSnapshot.mockRejectedValueOnce(new LeagueError('network'));
    mount(api, [makeTeam({ roomId: 'room-1', players: MY_PLAYERS })]);
    await settle();
    expect(league.status).toBe('error');
  });

  it('turns coming-soon on when League Rooms aren’t deployed, then lets the member retry later', async () => {
    const api = fakeApi();
    api.createRoom.mockRejectedValue({ code: 'PGRST202', message: 'Could not find the function public.create_room' });
    mount(api, [makeTeam({ players: MY_PLAYERS })]);
    let result: LeagueError | null = null;
    await settle(async () => {
      result = await league.create();
    });
    expect(result!.code).toBe('unavailable');
    expect(league.status).toBe('unavailable');
    expect(taken.size).toBe(0);
    await settle(() => appState.set('active'));
    expect(league.status).toBe('unavailable');
    jest.setSystemTime(NOW.getTime() + UNAVAILABLE_RECHECK_MS);
    await settle(() => appState.set('active'));
    expect(league.status).toBe('no_room');
  });

  it('polls each minute only while a screen watches, and re-reads on return to the app', async () => {
    const api = fakeApi();
    mount(api, [makeTeam({ roomId: 'room-1', players: MY_PLAYERS })]);
    await settle();
    expect(api.fetchRoomSnapshot).toHaveBeenCalledTimes(1);
    await settle(() => jest.advanceTimersByTime(ROOM_POLL_MS * 2));
    expect(api.fetchRoomSnapshot).toHaveBeenCalledTimes(1);
    let stop = () => undefined as void;
    // Coming into focus after two quiet minutes re-reads the room straight away…
    await settle(() => {
      stop = league.watch();
    });
    expect(api.fetchRoomSnapshot).toHaveBeenCalledTimes(2);
    // …then every minute while watched.
    await settle(() => jest.advanceTimersByTime(ROOM_POLL_MS));
    expect(api.fetchRoomSnapshot).toHaveBeenCalledTimes(3);
    await settle(() => stop());
    await settle(() => jest.advanceTimersByTime(ROOM_POLL_MS * 3));
    expect(api.fetchRoomSnapshot).toHaveBeenCalledTimes(3);
    await settle(() => appState.set('active'));
    expect(api.fetchRoomSnapshot).toHaveBeenCalledTimes(4);
  });

  it('shows a reaction at once, and drops it again if the room refuses', async () => {
    const api = fakeApi();
    mount(api, [makeTeam({ roomId: 'room-1', players: MY_PLAYERS })]);
    await settle();
    await settle(() => league.react(BEN, '🔥'));
    expect(league.snapshot?.reactions[0]).toMatchObject({ fromUserId: ME, toUserId: BEN, emoji: '🔥' });
    expect(mockTrack).toHaveBeenCalledWith('room_reaction', { emoji: '🔥' });
    api.react.mockRejectedValueOnce({ message: 'rate_limited' });
    let result: LeagueError | null = null;
    await settle(async () => {
      result = await league.react(BEN, '🚨');
    });
    expect(result!.code).toBe('rate_limited');
    expect(league.snapshot?.reactions).toEqual([]);
  });

  it('leaves the room and clears a room-sourced opponent', async () => {
    const api = fakeApi(() => withOpponentPick(roomSnapshot(), BEN));
    mount(api, [makeTeam({ roomId: 'room-1', players: MY_PLAYERS })]);
    await settle();
    expect(activeTeam().opponentName).toBe('Ben’s Bombers');
    await settle(() => league.leave());
    expect(api.leaveRoom).toHaveBeenCalledWith('room-1');
    expect(activeTeam().roomId).toBeUndefined();
    expect(activeTeam().opponent).toEqual([]);
    expect(league.status).toBe('no_room');
    expect(mockTrack).toHaveBeenCalledWith('room_leave', {});
  });

  it('saves dues and new codes from the server’s answer', async () => {
    const api = fakeApi();
    mount(api, [makeTeam({ roomId: 'room-1', players: MY_PLAYERS })]);
    await settle();
    const dues = { amount: 50, currency: 'USD' as const, deadline: null, payouts: [{ place: 1, amount: 500 }], potLink: null };
    await settle(() => league.saveDues(dues));
    expect(api.updateRoom).toHaveBeenCalledWith('room-1', 'Beer League', dues);
    expect(league.snapshot?.room.dues).toEqual(dues);
    expect(mockTrack).toHaveBeenCalledWith('room_dues_edit', { has_amount: true, payouts: 1, pot_link: false });
    await settle(() => league.rotateCode());
    expect(league.snapshot?.room.code).toBe('XYZ789');
  });
});
