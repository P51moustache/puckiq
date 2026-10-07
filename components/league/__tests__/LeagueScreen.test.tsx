jest.mock('react-native', () => require('./support/reactNative').reactNativeMock());
jest.mock('expo-apple-authentication', () => require('./support/reactNative').appleAuthMock());
jest.mock('@expo/vector-icons', () => require('./support/screen').mocks.vectorIcons());
jest.mock('expo-router', () => require('./support/screen').mocks.expoRouter());
jest.mock('../../PageHeader', () => require('./support/screen').mocks.pageHeader());
jest.mock('../../coach/TeamSwitcher', () => require('./support/screen').mocks.nothing());
jest.mock('../../coach/SampleTeamNotice', () => require('./support/screen').mocks.defaultHost('SampleTeamNotice'));
jest.mock('../../sheets/HowItWorksSheet', () => require('./support/screen').mocks.howItWorks());
jest.mock('../../coach/PlayerAvatar', () => require('./support/screen').mocks.playerAvatar());
jest.mock('../../share/ShareCards', () => require('./support/screen').mocks.shareCards());
jest.mock('../../sheets/PlayerSheet', () => require('./support/screen').mocks.playerSheet());
jest.mock('../../PaywallProvider', () => require('./support/screen').mocks.paywall());
jest.mock('../../SubscriptionProvider', () => require('./support/screen').mocks.subscription());
jest.mock('../../TeamsProvider', () => require('./support/screen').mocks.teams());
jest.mock('../../auth/AuthProvider', () => require('./support/screen').mocks.auth());
jest.mock('../LeagueProvider', () => require('./support/screen').mocks.leagueProvider());
jest.mock('../useRoomBoard', () => require('./support/screen').mocks.roomBoard());
jest.mock('../useTradeIdeas', () => require('./support/screen').mocks.tradeIdeas());
jest.mock('../../../hooks/useCoach', () => require('./support/screen').mocks.coachHooks());
jest.mock('../../../services/analytics/track', () => require('./support/screen').mocks.track());

import React from 'react';
import { LeagueError } from '../../../services/league';
import { SAMPLE_PLAYERS } from '../../../constants/sampleTeam';
import LeagueScreen from '../../screens/LeagueScreen';
import { leagueValue, resetScreen, screen } from './support/screen';
import { allText, byTestId, oneByTestId, press, pressAsync, render, settle, textOf, unmountAll } from './support/tree';
import { makeTeam } from './support/fixtures';

function mount() {
  return render(<LeagueScreen />).root;
}

describe('LeagueScreen before a room', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetScreen();
  });

  afterEach(unmountAll);

  it('pitches the room with four benefits, then create and join for the active team', () => {
    const root = mount();
    expect(byTestId(root, 'league-no-room')).toHaveLength(1);
    const text = allText(root);
    expect(text).toContain('BRING YOUR LEAGUE.');
    expect(text).toContain('Every league-mate who joins makes everyone’s coach smarter.');
    for (const title of ['REAL AVAILABILITY', 'AUTOMATIC OPPONENT', 'GAME-NIGHT BOARD', 'MONDAY RECAP + DUES']) expect(text).toContain(title);
    expect(oneByTestId(root, 'room-create').props.accessibilityLabel).toBe('Create a room for Zach Attack');
    expect(root.findAll((node: any) => node.type === 'HowItWorksButton')[0].props.topic).toBe('league');
  });

  it('creates a room for the active team', async () => {
    const root = mount();
    await pressAsync(oneByTestId(root, 'room-create'));
    expect(screen.league.create).toHaveBeenCalledTimes(1);
  });

  it('validates the code live, takes a pasted invite link, and joins with it', async () => {
    const root = mount();
    const input = () => oneByTestId(root, 'room-code-input');
    await settle(() => input().props.onChangeText('abc-23'));
    expect(input().props.value).toBe('ABC23');
    expect(oneByTestId(root, 'room-join').props.disabled).toBe(true);
    await settle(() => input().props.onChangeText('ABC23O'));
    expect(input().props.value).toBe('ABC23');
    expect(allText(root)).toContain('Codes never use I, O, 0 or 1');
    await settle(() => input().props.onChangeText('https://p51moustache.github.io/puckiq/join.html?code=xyz789'));
    expect(input().props.value).toBe('XYZ789');
    expect(oneByTestId(root, 'room-join').props.disabled).toBe(false);
    await pressAsync(oneByTestId(root, 'room-join'));
    expect(screen.league.join).toHaveBeenCalledWith('XYZ789', { source: 'code' });
  });

  it('shows why a join failed, but never treats “not switched on yet” as an error', async () => {
    screen.league = leagueValue({ join: jest.fn(async () => new LeagueError('room_full')) });
    const root = mount();
    await settle(() => oneByTestId(root, 'room-code-input').props.onChangeText('ABC234'));
    await pressAsync(oneByTestId(root, 'room-join'));
    expect(textOf(oneByTestId(root, 'room-start-error'))).toBe('That room is full — every team in the league has joined.');

    screen.league.create = jest.fn(async () => new LeagueError('unavailable'));
    await pressAsync(oneByTestId(root, 'room-create'));
    expect(byTestId(root, 'room-start-error')).toHaveLength(0);
  });

  it('keeps a sample roster out of rooms', () => {
    screen.team = makeTeam({ players: SAMPLE_PLAYERS });
    const root = mount();
    expect(root.findAll((node: any) => node.type === 'SampleTeamNotice')).toHaveLength(1);
    expect(oneByTestId(root, 'room-create').props.disabled).toBe(true);
    expect(textOf(oneByTestId(root, 'room-start-note'))).toContain('Swap the sample roster');
  });

  it('says when the room closed or removed the team, and lets the notice go', () => {
    screen.league = leagueValue({ notice: 'You’re not in this room anymore.' });
    const root = mount();
    expect(allText(oneByTestId(root, 'league-notice'))).toContain('not in this room anymore');
    press(root.findAll((node: any) => node.type === 'Pressable' && node.props.accessibilityLabel === 'Dismiss')[0]);
    expect(screen.league.dismissNotice).toHaveBeenCalled();
  });

  it('asks a signed-out member to sign in with Apple first', () => {
    screen.auth = { ...screen.auth, user: null };
    screen.league = leagueValue({ status: 'signed_out' });
    const root = mount();
    expect(allText(root)).toContain('League-mates need to see your team');
    expect(byTestId(root, 'room-create')).toHaveLength(0);
    press(oneByTestId(root, 'room-signin-apple'));
    expect(screen.auth.signInWithApple).toHaveBeenCalled();
  });

  it('says rooms aren’t available yet when Sign in with Apple isn’t', () => {
    screen.auth = { ...screen.auth, user: null, appleSignInReady: false };
    screen.league = leagueValue({ status: 'signed_out' });
    const root = mount();
    expect(byTestId(root, 'room-signin-apple')).toHaveLength(0);
    expect(allText(root)).toContain('League Rooms aren’t available yet');
  });

  it('stays calm while League Rooms are switched off: pitch, “almost here”, create and join disabled', () => {
    screen.league = leagueValue({ status: 'unavailable' });
    const root = mount();
    expect(byTestId(root, 'league-unavailable')).toHaveLength(1);
    expect(allText(root)).toContain('BRING YOUR LEAGUE.');
    expect(allText(oneByTestId(root, 'room-coming-soon'))).toBe('League Rooms are almost here | SOON');
    expect(oneByTestId(root, 'room-create').props.disabled).toBe(true);
    expect(oneByTestId(root, 'room-code-input').props.editable).toBe(false);
    expect(byTestId(root, 'room-start-error')).toHaveLength(0);
  });

  it('shows skeleton rows while the room loads, and a retryable error when it can’t be read', () => {
    screen.league = leagueValue({ status: 'loading' });
    expect(byTestId(mount(), 'league-loading')).toHaveLength(1);
    unmountAll();
    screen.league = leagueValue({ status: 'error', error: new LeagueError('network') });
    const root = mount();
    expect(allText(root)).toContain('Couldn’t open your room');
    press(oneByTestId(root, 'error-retry'));
    expect(screen.league.refresh).toHaveBeenCalled();
  });

  it('asks for a team first when there is none', () => {
    screen.team = null;
    const root = mount();
    press(oneByTestId(root, 'league-add-players'));
    expect(screen.router.push).toHaveBeenCalledWith('/myteam');
  });
});
