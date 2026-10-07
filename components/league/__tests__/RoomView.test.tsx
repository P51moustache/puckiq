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
jest.mock('../../coach/format', () => ({ ...jest.requireActual('../../coach/format'), useNow: () => new Date('2026-10-14T12:00:00.000Z') }));

import React from 'react';
import type { RoomSnapshot } from '../../../types/league';
import { inviteMessage } from '../../../services/league';
import LeagueScreen from '../../screens/LeagueScreen';
import { withDuesPaid, withOpponentPick } from '../leagueState';
import { mockWindow, nativeSpies, pressAlertButton } from './support/reactNative';
import { boardFor, leagueValue, resetScreen, screen } from './support/screen';
import { allText, byTestId, oneByTestId, press, pressAsync, render, settle, textOf, unmountAll } from './support/tree';
import { BEN, hughes, makar, ME, reaction, roomSnapshot, SAM } from './support/fixtures';

function ready(snapshot: RoomSnapshot = roomSnapshot()) {
  screen.league = leagueValue({ status: 'ready', snapshot });
}

/** The fixture room with another owner, so I'm a plain member. */
function asMember(snapshot: RoomSnapshot = roomSnapshot()): RoomSnapshot {
  return { ...snapshot, room: { ...snapshot.room, ownerId: BEN } };
}

function mount() {
  return render(<LeagueScreen />).root;
}

describe('LeagueScreen in a room', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetScreen();
    mockWindow.width = 390;
    ready();
  });

  afterEach(unmountAll);

  it('heads the room with its name, code, invite and how much of the league is synced', () => {
    const root = mount();
    expect(textOf(oneByTestId(root, 'room-name'))).toBe('BEER LEAGUE');
    expect(allText(oneByTestId(root, 'room-code'))).toContain('ABC234');
    expect(allText(oneByTestId(root, 'room-coverage'))).toContain('2 OF 10 TEAMS SYNCED · 1 WAITING ON A ROSTER');
    press(oneByTestId(root, 'room-invite'));
    expect(nativeSpies.share).toHaveBeenCalledWith({ message: inviteMessage('Beer League', 'ABC234') });
  });

  it('stands the room up as a timing tower: positions, who plays tonight, games that count left', () => {
    const board = oneByTestId(mount(), 'room-board');
    expect(allText(board)).toContain('GAME NIGHT · WED OCT 14');
    expect(allText(board)).toContain('TONIGHT');
    for (const userId of [ME, BEN, SAM]) expect(byTestId(board, `board-row-${userId}`)).toHaveLength(1);
    expect(allText(oneByTestId(board, `board-row-${ME}`))).toContain('YOU');
    expect(allText(oneByTestId(board, `board-row-${SAM}`))).toContain('no roster yet');
    expect(textOf(oneByTestId(board, `board-left-${ME}`))).toBe('3');
    expect(allText(oneByTestId(board, 'board-clock-countdown'))).toMatch(/^First puck drop \| \d\d[DH] : \d\d[HM]$/);
  });

  it('marks a stale roster with how old it is', () => {
    // Roster ages read the real clock (they compare with server timestamps).
    const threeDaysAgo = new Date(Date.now() - 76 * 60 * 60 * 1000).toISOString();
    const base = roomSnapshot();
    ready({ ...base, members: base.members.map((m) => (m.userId === BEN ? { ...m, rosterUpdatedAt: threeDaysAgo } : m)) });
    expect(allText(oneByTestId(mount(), `board-row-${BEN}`))).toContain('updated 3 d ago');
  });

  it('turns into live points and gaps once box scores are in', () => {
    screen.board = boardFor([
      { userId: BEN, teamName: 'Ben’s Bombers', isMe: false, playingToday: 2, startersToday: 2, gamesThatCountLeft: 4, livePoints: 12.5 },
      { userId: ME, teamName: 'Zach Attack', isMe: true, playingToday: 2, startersToday: 2, gamesThatCountLeft: 3, livePoints: 9.3 },
      { userId: SAM, teamName: 'Sam’s Snipers', isMe: false, playingToday: 0, startersToday: 0, gamesThatCountLeft: 0, livePoints: 0 },
    ]);
    const board = oneByTestId(mount(), 'room-board');
    expect(allText(board)).toContain('PTS');
    expect(allText(oneByTestId(board, `board-row-${BEN}`))).toContain('LEAD');
    expect(allText(oneByTestId(board, `board-row-${ME}`))).toContain('−3.2');
    expect(oneByTestId(board, `board-points-${ME}`).props.accessibilityLabel).toBe('9.3');
  });

  it('sends a preset reaction from a league-mate’s row and shows recent counts', async () => {
    ready({ ...roomSnapshot(), reactions: [reaction(1, BEN, '🚨'), reaction(2, BEN, '🚨')] });
    const root = mount();
    expect(allText(oneByTestId(root, `board-row-${BEN}`))).toContain('🚨2');
    expect(oneByTestId(root, `board-row-${ME}`).props.disabled).toBe(true);
    press(oneByTestId(root, `board-row-${BEN}`));
    expect(byTestId(root, 'reaction-strip')).toHaveLength(1);
    await pressAsync(oneByTestId(root, 'react-🔥'));
    expect(screen.league.react).toHaveBeenCalledWith(BEN, '🔥');
    expect(byTestId(root, 'reaction-strip')).toHaveLength(0);
  });

  it('picks this week’s opponent, says when they picked me, and clears my own pick', async () => {
    const root = mount();
    expect(textOf(oneByTestId(root, 'room-opponent-name'))).toBe('NO OPPONENT YET');
    await pressAsync(oneByTestId(root, `opponent-${BEN}`));
    expect(screen.league.setOpponent).toHaveBeenCalledWith(BEN);
    unmountAll();

    const base = roomSnapshot();
    ready({ ...base, members: base.members.map((m) => (m.userId === BEN ? { ...m, opponentUserId: ME } : m)) });
    const picked = mount();
    expect(textOf(oneByTestId(picked, 'room-opponent-name'))).toBe('VS BEN’S BOMBERS');
    expect(allText(picked)).toContain('Ben’s Bombers picked you');
    unmountAll();

    ready(withOpponentPick(roomSnapshot(), BEN));
    await pressAsync(oneByTestId(mount(), `opponent-${BEN}`));
    expect(screen.league.setOpponent).toHaveBeenLastCalledWith(null);
  });

  it('recaps last week with awards and shares it as a room card', () => {
    const root = mount();
    const recap = oneByTestId(root, 'room-recap');
    expect(allText(recap)).toContain('MONDAY RECAP · WEEK OF OCT 5');
    expect(allText(recap)).toContain('MOST GAMES THAT COUNT');
    const sheet = () => root.findAll((node: any) => node.type === 'ShareCardSheet')[0];
    expect(sheet().props.visible).toBe(false);
    press(oneByTestId(root, 'room-recap-share'));
    expect(sheet().props.visible).toBe(true);
    expect(sheet().props.content).toMatchObject({ kind: 'room', teamName: 'Beer League', countSuffix: 'GAMES' });
  });

  it('locks trade ideas for free members behind the paywall', () => {
    const root = mount();
    press(oneByTestId(root, 'trade-ideas-locked'));
    expect(screen.openPaywall).toHaveBeenCalledWith('trade_finder');
    expect(screen.track).toHaveBeenCalledWith('trade_finder_open', { pro: false });
    expect(byTestId(root, 'trade-find')).toHaveLength(0);
  });

  it('finds trade ideas for Pro on request and opens the players', () => {
    screen.isPremium = true;
    const root = mount();
    expect(byTestId(root, 'trade-ideas')).toHaveLength(0);
    press(oneByTestId(root, 'trade-find'));
    expect(screen.track).toHaveBeenCalledWith('trade_finder_open', { pro: true });
    const ideas = oneByTestId(root, 'trade-ideas');
    expect(allText(ideas)).toContain('WITH BEN’S BOMBERS');
    expect(textOf(oneByTestId(ideas, 'trade-idea-gains'))).toBe('+2.4 you · +1.6 them');
    press(oneByTestId(ideas, `trade-give-${makar.playerId}`));
    expect(screen.openPlayer).toHaveBeenCalledWith(makar.playerId, 'roster');
    press(oneByTestId(ideas, `trade-get-${hughes.playerId}`));
    expect(screen.openPlayer).toHaveBeenCalledWith(hughes.playerId, 'browse');
    expect(screen.track).toHaveBeenCalledWith('trade_idea_view', { rank: 1, side: 'get' });
  });

  it('lets the owner set up dues, checked before saving, with the money disclaimer', async () => {
    const root = mount();
    expect(allText(oneByTestId(root, 'room-dues-empty'))).toContain('PuckIQ never holds money');
    press(oneByTestId(root, 'room-dues-setup'));
    await settle(() => oneByTestId(root, 'dues-amount').props.onChangeText('$50'));
    press(oneByTestId(root, 'dues-add-payout'));
    await settle(() => oneByTestId(root, 'dues-payout-1').props.onChangeText('600'));
    await pressAsync(oneByTestId(root, 'dues-save'));
    expect(textOf(oneByTestId(root, 'dues-error'))).toBe('The payouts add up to more than the pot.');
    await settle(() => oneByTestId(root, 'dues-payout-1').props.onChangeText('400'));
    await pressAsync(oneByTestId(root, 'dues-save'));
    expect(screen.league.saveDues).toHaveBeenCalledWith({ amount: 50, currency: 'USD', deadline: null, payouts: [{ place: 1, amount: 400 }], potLink: null });
  });

  it('shows dues to members read-only and lets the owner tick teams off', async () => {
    const snapshot = roomSnapshot();
    const withDues = withDuesPaid({ ...snapshot, room: { ...snapshot.room, dues: { ...snapshot.room.dues, amount: 50 } } }, ME, true, new Date());
    ready(withDues);
    const owner = mount();
    expect(textOf(oneByTestId(owner, 'room-dues-paid'))).toContain('1/3');
    await pressAsync(oneByTestId(owner, `dues-${BEN}`));
    expect(screen.league.setDuesPaid).toHaveBeenCalledWith(BEN, true);
    unmountAll();

    ready(asMember(withDues));
    const member = mount();
    expect(byTestId(member, 'room-dues-edit')).toHaveLength(0);
    expect(oneByTestId(member, `dues-${BEN}`).props.disabled).toBe(true);
    expect(allText(member)).toContain('Tracking only — PuckIQ never holds money.');
  });

  it('hides the dues card from members when the room has none', () => {
    ready(asMember());
    const root = mount();
    expect(byTestId(root, 'room-dues-empty')).toHaveLength(0);
    expect(byTestId(root, 'room-dues')).toHaveLength(0);
  });

  it('gives the owner rename, new code and remove; everyone leave and report', async () => {
    const root = mount();
    press(oneByTestId(root, 'room-menu-open'));
    for (const id of ['room-menu-rename', 'room-menu-new-code', 'room-menu-remove', 'room-menu-leave', 'room-menu-report']) {
      expect(byTestId(root, id)).toHaveLength(1);
    }
    press(oneByTestId(root, 'room-menu-leave'));
    expect(nativeSpies.alert.mock.calls[0][1]).toBe('Ownership passes to the longest-standing team. You can rejoin with the code.');
    await settle(() => pressAlertButton('Leave'));
    expect(screen.league.leave).toHaveBeenCalled();
    unmountAll();

    ready(asMember());
    const member = mount();
    press(oneByTestId(member, 'room-menu-open'));
    expect(byTestId(member, 'room-menu-rename')).toHaveLength(0);
    press(oneByTestId(member, 'room-menu-report'));
    expect(nativeSpies.openURL.mock.calls[0][0]).toMatch(/^mailto:/);
  });

  it('lets the owner remove a team after confirming', async () => {
    const root = mount();
    press(oneByTestId(root, 'room-menu-open'));
    press(oneByTestId(root, 'room-menu-remove'));
    press(oneByTestId(root, `room-remove-${BEN}`));
    expect(nativeSpies.alert.mock.calls[0][0]).toBe('Remove Ben’s Bombers?');
    await settle(() => pressAlertButton('Remove'));
    expect(screen.league.removeMember).toHaveBeenCalledWith(BEN);
  });

  it('renames the room through the name filter', async () => {
    const root = mount();
    press(oneByTestId(root, 'room-menu-open'));
    press(oneByTestId(root, 'room-menu-rename'));
    await settle(() => oneByTestId(root, 'room-rename-input').props.onChangeText('🔥🔥'));
    expect(textOf(oneByTestId(root, 'room-rename-problem'))).toBe('Add a name with at least one letter or number.');
    expect(oneByTestId(root, 'room-rename-save').props.disabled).toBe(true);
    await settle(() => oneByTestId(root, 'room-rename-input').props.onChangeText('  Pond   Hockey '));
    await pressAsync(oneByTestId(root, 'room-rename-save'));
    expect(screen.league.rename).toHaveBeenCalledWith('Pond Hockey');
  });

  it('splits into two columns on iPad', () => {
    const columns = (root: any) => root.findAll((node: any) => node.type === 'View' && node.props.style?.[0]?.flexDirection === 'row' && node.props.style?.[0]?.gap === 20);
    expect(columns(mount())).toHaveLength(0);
    unmountAll();
    mockWindow.width = 1032;
    expect(columns(mount())).toHaveLength(1);
  });
});
