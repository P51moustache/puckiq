jest.mock('react-native', () => require('./support/reactNative').reactNativeMock());
jest.mock('expo-apple-authentication', () => require('./support/reactNative').appleAuthMock());
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return { Ionicons: (props: object) => React.createElement('Ionicons', props) };
});
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../TeamsProvider', () => ({ useTeams: () => ({ teams: mockTeams, team: mockTeams[0] ?? null, ready: true }) }));
jest.mock('../../auth/AuthProvider', () => ({ useAuthContext: () => mockAuth }));
jest.mock('../LeagueProvider', () => ({ useLeague: () => mockLeague }));

import React from 'react';
import type { FantasyTeam } from '../../../types/fantasy';
import type { RoomSnapshot } from '../../../types/league';
import { LeagueError } from '../../../services/league';
import { SAMPLE_PLAYERS } from '../../../constants/sampleTeam';
import JoinRoomScreen, { defaultJoinTeam } from '../JoinRoomScreen';
import { allText, byTestId, oneByTestId, press, pressAsync, render, textOf, unmountAll } from './support/tree';
import { makeTeam, makar, mcdavid, ME, roomSnapshot } from './support/fixtures';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
let mockTeams: FantasyTeam[] = [];
let mockAuth = { user: { id: ME } as { id: string } | null, appleSignInReady: true, signInWithApple: jest.fn(async () => true) };
let mockLeague: { status: string; snapshot: RoomSnapshot | null; join: jest.Mock };

const free = makeTeam({ id: 'team-free', name: 'Second Line', players: [mcdavid, makar] });
const roomed = makeTeam({ id: 'team-roomed', name: 'Zach Attack', roomId: 'other-room', players: [mcdavid] });

function mount(code = 'abc234') {
  return render(<JoinRoomScreen code={code} />).root;
}

describe('JoinRoomScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTeams = [free];
    mockAuth = { user: { id: ME }, appleSignInReady: true, signInWithApple: jest.fn(async () => true) };
    mockLeague = { status: 'no_room', snapshot: null, join: jest.fn(async () => null) };
  });

  afterEach(unmountAll);

  it('shows the code big, joins with the team and opens the League tab', async () => {
    const root = mount();
    expect(allText(oneByTestId(root, 'join-code'))).toBe('A | B | C | 2 | 3 | 4');
    expect(allText(oneByTestId(root, 'join-team'))).toContain('Second Line');
    expect(byTestId(root, 'join-team-team-free')).toHaveLength(0); // one team: no switcher
    await pressAsync(oneByTestId(root, 'join-submit'));
    expect(mockLeague.join).toHaveBeenCalledWith('ABC234', { source: 'link', teamId: 'team-free' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/league');
  });

  it('picks a team that isn’t in a room yet, and blocks one that is', () => {
    mockTeams = [roomed, free];
    const root = mount();
    expect(allText(oneByTestId(root, 'join-team-team-roomed'))).toBe('Zach Attack · in a room');
    expect(allText(oneByTestId(root, 'join-team'))).toContain('Second Line');
    press(oneByTestId(root, 'join-team-team-roomed'));
    expect(textOf(oneByTestId(root, 'join-blocked'))).toContain('already in a League Room');
    expect(oneByTestId(root, 'join-submit').props.disabled).toBe(true);
  });

  it('keeps a sample roster out', () => {
    mockTeams = [makeTeam({ id: 'sample', players: SAMPLE_PLAYERS })];
    const root = mount();
    expect(textOf(oneByTestId(root, 'join-blocked'))).toContain('sample roster');
    expect(oneByTestId(root, 'join-submit').props.disabled).toBe(true);
  });

  it('asks a signed-out member to sign in first', () => {
    mockAuth = { ...mockAuth, user: null };
    const root = mount();
    expect(byTestId(root, 'room-signin-apple')).toHaveLength(1);
    expect(byTestId(root, 'join-submit')).toHaveLength(0);
  });

  it('explains a broken link and points to the League tab', () => {
    const root = mount('not-a-code');
    expect(byTestId(root, 'join-code')).toHaveLength(0);
    press(oneByTestId(root, 'join-open-league'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/league');
  });

  it('knows when I’m already in that room', () => {
    mockLeague = { ...mockLeague, status: 'ready', snapshot: roomSnapshot() };
    const root = mount('ABC234');
    expect(allText(oneByTestId(root, 'join-already'))).toContain('You’re already in Beer League');
  });

  it('stays calm while League Rooms are switched off', () => {
    mockLeague = { ...mockLeague, status: 'unavailable' };
    const root = mount();
    expect(allText(oneByTestId(root, 'join-coming-soon'))).toContain('League Rooms are almost here');
    expect(oneByTestId(root, 'join-submit').props.disabled).toBe(true);
  });

  it('shows why a join failed and stays put', async () => {
    mockLeague = { ...mockLeague, join: jest.fn(async () => new LeagueError('room_not_found')) };
    const root = mount();
    await pressAsync(oneByTestId(root, 'join-submit'));
    expect(textOf(oneByTestId(root, 'join-error'))).toBe('No room matches that code. Ask your commissioner for a fresh invite.');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('defaultJoinTeam', () => {
  it('prefers the active team, then the first team without a room', () => {
    expect(defaultJoinTeam([free, roomed], free)).toBe(free);
    expect(defaultJoinTeam([roomed, free], roomed)).toBe(free);
    expect(defaultJoinTeam([roomed], roomed)).toBe(roomed);
    expect(defaultJoinTeam([], null)).toBeNull();
  });
});
