jest.mock('react-native', () => {
  const React = require('react');
  const passthrough = (name: string) => {
    const Mock = ({ children, ...props }: any) => React.createElement(name, props, children);
    Mock.displayName = name;
    return Mock;
  };
  class AnimatedValue {
    constructor(public value: number) {}
  }
  return {
    View: passthrough('View'),
    Text: passthrough('Text'),
    ScrollView: passthrough('ScrollView'),
    Modal: passthrough('Modal'),
    AppState: { currentState: 'active', addEventListener: () => ({ remove: jest.fn() }) },
    RefreshControl: (props: any) => React.createElement('RefreshControl', props),
    Pressable: ({ children, style, ...props }: any) =>
      React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    StyleSheet: { create: (s: any) => s, hairlineWidth: 0.5 },
    Platform: { OS: 'ios', select: (o: any) => o.ios },
    Linking: { openURL: jest.fn(() => Promise.resolve()) },
    useWindowDimensions: () => ({ width: mockWindowWidth, height: 900, scale: 3, fontScale: 1 }),
    Animated: {
      Value: AnimatedValue,
      View: passthrough('AnimatedView'),
      loop: () => ({ start: jest.fn(), stop: jest.fn() }),
      sequence: jest.fn(),
      timing: jest.fn(),
    },
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return { Ionicons: (props: any) => React.createElement('Ionicons', props) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../../coach/TeamSwitcher', () => () => null);
jest.mock('../../coach/PlayerAvatar', () => ({ PlayerAvatar: () => null, PlayerName: ({ name }: any) => { const React = require('react'); return React.createElement('Text', null, name); }, TeamChip: () => null }));
jest.mock('../../sheets/PlayerSearchSheet', () => () => null);
jest.mock('../../rosterImport/RosterImportSheet', () => {
  const React = require('react');
  return { RosterImportSheet: (props: any) => React.createElement('RosterImportSheet', props) };
});
jest.mock('../../share/ShareCards', () => {
  const React = require('react');
  return {
    ShareButton: (props: any) => React.createElement('ShareButton', props),
    ShareCardSheet: (props: any) => React.createElement('ShareCardSheet', props),
  };
});
jest.mock('../../sheets/PlayerSheet', () => ({ usePlayerSheet: () => ({ openPlayer: mockOpenPlayer }) }));
jest.mock('../../PaywallProvider', () => ({ usePaywall: () => ({ openPaywall: mockOpenPaywall }) }));

let mockWindowWidth = 390;
const mockOpenPlayer = jest.fn();
const mockOpenPaywall = jest.fn();
let mockIsPremium = false;
jest.mock('../../SubscriptionProvider', () => ({ useSubscription: () => ({ isPremium: mockIsPremium }) }));

let mockTeam: any = null;
const mockUpdateTeam = jest.fn();
jest.mock('../../TeamsProvider', () => ({ useTeams: () => ({ team: mockTeam, ready: true, updateTeam: mockUpdateTeam }) }));

let mockView: any = null;
let mockRecapView: any = null;
jest.mock('../../../hooks/useCoach', () => ({
  useNight: (_team: unknown, offset = 0) => (offset === -1 ? mockRecapView ?? mockView : mockView),
  useNhlToday: () => '2026-10-13',
}));
let mockGuidance: any = null;
jest.mock('../../../hooks/useTonightGuidance', () => ({ useTonightGuidance: () => mockGuidance }));
let mockGoalieOutlooks = new Map<number, any>();
const mockSetFollowing = jest.fn();
let mockFollowSupported = false;
jest.mock('../../../hooks/useNightLive', () => ({
  useNightPublisher: () => ({ supported: mockFollowSupported, following: false, setFollowing: mockSetFollowing }),
  useGoalHaptics: () => undefined,
}));

// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import React from 'react';
import TonightScreen from '../TonightScreen';
import { buildSkaterForm } from '../../../services/fantasy/form';
import { createTeam } from '../../../services/teams';
import { buildNightScore } from '../../../services/fantasy/nightScore';
import { DEFAULT_SCORING } from '../../../services/fantasy/scoring';

const players = [
  { playerId: 8478402, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' },
  { playerId: 8479318, playerName: 'Auston Matthews', teamAbbrev: 'TOR', position: 'C', rosterPosition: 'BN' },
  { playerId: 8480012, playerName: 'Cale Makar', teamAbbrev: 'COL', position: 'D', rosterPosition: 'BN' },
];

function game(id: number, opponent: string, state = 'FUT') {
  return { date: '2026-10-13', gameId: id, opponent, isHome: true, startTimeUTC: '2026-10-13T23:00:00Z', state, offNight: false };
}

function view(overrides: Partial<any> = {}) {
  const forms = new Map(players.map((p) => [p.playerId, { ...buildSkaterForm(p.playerId, {}), value: 3 }]));
  return {
    date: '2026-10-13',
    night: {
      data: {
        date: '2026-10-13',
        games: [],
        playerGames: { 8478402: game(1, 'TOR'), 8479318: game(1, 'EDM') },
        statuses: new Map([[8479318, { playerId: 8479318, signal: 'scratch', confidence: 'confirmed', note: null }]]),
        liveLines: new Map(),
        news: [],
        nextDate: null,
      },
      loading: false,
      error: null,
    },
    forms: { data: { forms, teamStrength: new Map() } },
    day: {
      date: '2026-10-13', dayAbbrev: 'TUE', leagueGames: 10, offNight: false, isPast: false, isToday: true,
      playing: [8478402], starters: [{ slot: 'C', playerId: 8478402 }], bench: [], empty: ['D'],
    },
    moves: [
      { id: 'scratch-8479318', kind: 'scratch', severity: 0, title: 'Bench Auston Matthews', detail: 'On the NHL scratch list vs EDM.', playerIds: [8479318] },
      { id: 'empty-D', kind: 'empty', severity: 2, title: '1 empty D slot tonight', detail: '…', playerIds: [], slot: 'D' },
      { id: 'off', kind: 'off', severity: 4, title: '1 with no game — keep them benched', detail: 'Cale Makar', playerIds: [8480012] },
    ],
    goalieOutlooks: mockGoalieOutlooks,
    liveGames: false,
    loading: false,
    refreshing: false,
    error: null,
    refresh: jest.fn(),
    ...overrides,
  };
}

const mounted: any[] = [];
function render() {
  let tree: any;
  act(() => { tree = create(<TonightScreen />); });
  mounted.push(tree);
  return tree;
}

afterEach(() => {
  // The countdown ticks on an interval; unmount so Jest can exit.
  while (mounted.length) act(() => mounted.pop().unmount());
});

const byTestId = (tree: any, id: string) => tree.root.findAll((n: any) => n.props.testID === id && typeof n.type === 'string');
const allText = (tree: any) => tree.root.findAll((n: any) => n.type === 'Text')
  .map((n: any) => [].concat(n.props.children).filter((c: unknown) => typeof c === 'string' || typeof c === 'number').join(''))
  .join(' | ');

describe('TonightScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWindowWidth = 390;
    mockIsPremium = false;
    mockTeam = { ...createTeam({ name: 'Beauties', players: players as any }) };
    mockView = view();
    mockRecapView = null;
    mockFollowSupported = false;
    mockGoalieOutlooks = new Map();
    mockGuidance = {
      firstNight: { visible: false, done: [], quietNight: false, onStep: jest.fn(), onDismiss: jest.fn() },
      reminderPrompt: { visible: false, accept: jest.fn(() => Promise.resolve(true)), dismiss: jest.fn() },
      nextUp: { item: null, onPress: jest.fn() },
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('asks for a roster when the team is empty', () => {
    mockTeam = createTeam({ name: 'Empty' });
    const tree = render();
    expect(byTestId(tree, 'tonight-empty')).toHaveLength(1);
    expect(byTestId(tree, 'tonight-add-players')).toHaveLength(1);
    const sheet = () => tree.root.findAll((n: any) => n.type === 'RosterImportSheet')[0];
    expect(sheet().props.visible).toBe(false);
    act(() => { byTestId(tree, 'tonight-import')[0].props.onPress(); });
    expect(sheet().props).toMatchObject({ visible: true, source: 'tonight' });
  });

  it('leads with how many of my players play and the problem count', () => {
    const tree = render();
    const text = allText(tree);
    expect(text).toContain('of your players play tonight');
    expect(byTestId(tree, 'tonight-problems')).toHaveLength(1);
    expect(text).toContain('SCRATCHED · NHL');
  });

  it('shares tonight as a card with who plays and against whom', () => {
    const tree = render();
    const sheet = () => tree.root.findAll((n: any) => n.type === 'ShareCardSheet')[0];
    expect(sheet().props.visible).toBe(false);
    act(() => { byTestId(tree, 'tonight-share')[0].props.onPress(); });
    expect(sheet().props.visible).toBe(true);
    const content = sheet().props.content;
    expect(content.caption).toBe('playing tonight');
    expect(content.count).toBeGreaterThan(0);
    expect(content.players).toHaveLength(content.count);
    expect(content.players[0].detail).toMatch(/^(vs|@) [A-Z]{3}$/);
  });

  it('shows the goal lamp on the coach’s clean-lineup move', () => {
    expect(byTestId(render(), 'move-clean-art')).toHaveLength(0);

    mockView = view({
      day: { ...view().day, empty: [] },
      moves: [{ id: 'clean', kind: 'clean', severity: 5, title: 'Lineup is clean', detail: '1 starters, no conflicts or scratches posted.', playerIds: [] }],
    });
    const tree = render();
    expect(byTestId(tree, 'move-clean-art')).toHaveLength(1);
    expect(allText(tree)).toContain('Lineup is clean');
  });

  it('asks a team from before 3.2 how its league scores, once, and applies the answer', () => {
    mockTeam = { ...createTeam({ name: 'Beauties', players: players as any }) };
    const tree = render();
    act(() => { byTestId(tree, 'format-prompt-categories')[0].props.onPress(); });
    const updater = mockUpdateTeam.mock.calls[0][0];
    expect(updater(mockTeam)).toMatchObject({ format: 'categories', categories: expect.arrayContaining(['hits']) });
    mockTeam = { ...createTeam({ name: 'Beauties', players: players as any, format: 'points' }) };
    expect(byTestId(render(), 'tonight-format-prompt')).toHaveLength(0);
  });

  it('opens the host app to make the moves, straight to the team page when there is one', () => {
    const { Linking } = require('react-native');
    mockTeam = { ...createTeam({ name: 'Beauties', players: players as any }), teamLink: 'https://hockey.fantasysports.yahoo.com/hockey/1/2' };
    const tree = render();
    const open = byTestId(tree, 'tonight-open-host')[0];
    expect(allText(tree)).toContain('Make these moves on your Yahoo team');
    act(() => { open.props.onPress(); });
    expect(Linking.openURL).toHaveBeenCalledWith('https://hockey.fantasysports.yahoo.com/hockey/1/2');
  });

  it('tells a goalie’s start outlook before puck drop, with the percent for Pro', () => {
    const gibson = { playerId: 8476434, playerName: 'John Gibson', teamAbbrev: 'DET', position: 'G', rosterPosition: 'BN' };
    mockTeam = { ...createTeam({ name: 'Beauties', players: [...players, gibson] as any }) };
    mockGoalieOutlooks = new Map([[8476434, {
      outlook: 'unlikely', chance: 0.14, backToBack: 'second',
      reason: 'Started last night — backups usually get the second half of a back-to-back',
    }]]);
    const base = view();
    mockView = { ...base, night: { ...base.night, data: { ...base.night.data, playerGames: { ...base.night.data.playerGames, 8476434: game(2, 'MTL') } } } };
    let tree = render();
    expect(byTestId(tree, 'goalie-outlook-8476434')).toHaveLength(1);
    expect(allText(tree)).toContain('B2B · BACKUP LIKELY');
    expect(byTestId(tree, 'goalie-outlook-8476434-chance')).toHaveLength(0);
    mockIsPremium = true;
    tree = render();
    expect(byTestId(tree, 'goalie-outlook-8476434-chance')).toHaveLength(1);
  });

  it('shows free users one move and locks the rest and the lineup', () => {
    const tree = render();
    expect(byTestId(tree, 'move-scratch')).toHaveLength(1);
    expect(byTestId(tree, 'move-empty')).toHaveLength(0);
    expect(byTestId(tree, 'tonight-more-moves')).toHaveLength(1);
    expect(byTestId(tree, 'tonight-lineup-locked')).toHaveLength(1);
    act(() => { byTestId(tree, 'tonight-lineup-locked')[0].props.onPress(); });
    expect(mockOpenPaywall).toHaveBeenCalledWith('tonight_lineup');
  });

  it('shows Pro every move and the slot-by-slot lineup', () => {
    mockIsPremium = true;
    const tree = render();
    expect(byTestId(tree, 'move-empty')).toHaveLength(1);
    expect(byTestId(tree, 'move-off')).toHaveLength(1);
    expect(byTestId(tree, 'tonight-more-moves')).toHaveLength(0);
    expect(byTestId(tree, 'tonight-lineup')).toHaveLength(1);
    expect(allText(tree)).toContain('EMPTY');
  });

  it('says when nobody plays and when the next games are', () => {
    mockView = view({
      night: { data: { ...view().night.data, playerGames: {}, statuses: new Map(), nextDate: '2026-10-15' }, loading: false, error: null },
      moves: [],
    });
    const text = allText(render());
    expect(text).toContain('No games for your roster tonight.');
    expect(text).toContain('Next games: Thu Oct 15');
  });

  it('splits into two columns on iPad and stacks on phones', () => {
    mockIsPremium = true;
    const columnsIn = (tree: any) => tree.root.findAll((n: any) => n.type === 'View' && n.props.style?.[0]?.flexDirection === 'row' && n.props.style?.[0]?.gap === 20);
    expect(columnsIn(render())).toHaveLength(0);
    mockWindowWidth = 1032;
    const wide = render();
    expect(columnsIn(wide)).toHaveLength(1);
    expect(byTestId(wide, 'tonight-headline')).toHaveLength(1);
    expect(byTestId(wide, 'tonight-lineup')).toHaveLength(1);
  });

  it('opens the player sheet from a player card', () => {
    const tree = render();
    act(() => { byTestId(tree, 'tonight-player-8478402')[0].props.onPress(); });
    expect(mockOpenPlayer).toHaveBeenCalledWith(8478402, 'roster', 'tonight');
  });

  /** A night with McDavid's game under way (or over) and a box-score line for him. */
  function nightWith(state: 'LIVE' | 'OFF', mcdavid: Record<string, number>) {
    const base = view();
    const liveGame = {
      id: 1, date: '2026-10-13', gameType: 2, startTimeUTC: '2026-10-13T23:00:00Z', state, scheduleState: 'OK',
      home: 'EDM', away: 'TOR', homeScore: 3, awayScore: 1, period: state === 'LIVE' ? 2 : 3, clock: state === 'LIVE' ? '10:15' : '00:00', inIntermission: false,
    };
    const line = {
      playerId: 8478402, isGoalie: false, goals: 0, assists: 0, points: 0, shots: 0, hits: 0, blocks: 0, plusMinus: 0,
      powerPlayGoals: 0, pim: 0, toi: '20:00', saves: 0, shotsAgainst: 0, goalsAgainst: 0, ...mcdavid,
    };
    const data = {
      ...base.night.data,
      games: [liveGame],
      playerGames: { 8478402: { ...game(1, 'TOR', state), state } },
      statuses: new Map(),
      liveLines: new Map([[8478402, line]]),
    };
    const score = buildNightScore({
      players: players as any, playerGames: data.playerGames, games: data.games as any, lines: data.liveLines as any,
      scoring: DEFAULT_SCORING, slots: mockTeam.slots, day: base.day as any,
    });
    return view({ night: { data, loading: false, error: null }, score, moves: [] });
  }

  it('turns the hero into a live scoreboard once games start', () => {
    mockIsPremium = true;
    mockFollowSupported = true;
    mockView = nightWith('LIVE', { goals: 2, assists: 1, shots: 4 }); // 6 + 2 + 2 = 10
    const tree = render();
    const text = allText(tree);
    expect(byTestId(tree, 'tonight-points')[0].props.children).toBe('10.0');
    expect(text).toContain('from your lineup');
    expect(text).toContain('LIVE · TUE OCT 13');
    expect(text).toContain('P2 10:15');
    expect(text).toContain('3-POINT NIGHT');
    expect(byTestId(tree, 'big-night-8478402')).toHaveLength(1);
    act(() => { byTestId(tree, 'tonight-follow')[0].props.onPress(); });
    expect(mockSetFollowing).toHaveBeenCalledWith(true);
  });

  it('shows a category league its tallies instead of points', () => {
    mockTeam = { ...createTeam({ name: 'Beauties', players: players as any, format: 'categories' }) };
    mockView = nightWith('LIVE', { goals: 2, assists: 1, shots: 4, hits: 3, plusMinus: 1 });
    const tree = render();
    expect(byTestId(tree, 'tonight-points')).toHaveLength(0);
    expect(byTestId(tree, 'tonight-tallies')).toHaveLength(1);
    const cell = (key: string) => byTestId(tree, `tonight-tallies-${key}`)[0];
    expect(cell('goals').props.accessibilityLabel).toBe('Goals: 2');
    expect(cell('plusMinus').props.accessibilityLabel).toBe('Plus/minus: +1');
    expect(cell('savePct').props.accessibilityLabel).toBe('Save percentage: —');
    expect(allText(tree)).toContain('2G · 1A · +1 +/- · 4 SOG · 3 HIT');
  });

  it('shares a category league’s night by its categories', () => {
    jest.useFakeTimers({ now: new Date('2026-10-14T13:00:00Z') });
    mockTeam = { ...createTeam({ name: 'Beauties', players: players as any, format: 'categories' }) };
    mockRecapView = { ...nightWith('OFF', { goals: 1, shots: 2, hits: 4 }), date: '2026-10-13' };
    const tree = render();
    expect(byTestId(tree, 'recap-points')).toHaveLength(0);
    expect(byTestId(tree, 'recap-tallies')).toHaveLength(1);
    act(() => { byTestId(tree, 'recap-share')[0].props.onPress(); });
    const recapSheet = tree.root.findAll((n: any) => n.type === 'ShareCardSheet').find((n: any) => n.props.visible);
    expect(recapSheet.props.content).toMatchObject({ kind: 'recap', count: '1', countSuffix: 'G', caption: '0 A · 0 +/- · 0 PPP · 2 SOG · 4 HIT' });
  });

  it('drops the coach moves once every game has started', () => {
    mockIsPremium = true;
    const live = nightWith('LIVE', { goals: 1 });
    mockView = { ...live, moves: view().moves };
    const tree = render();
    expect(byTestId(tree, 'move-scratch')).toHaveLength(0);
    expect(byTestId(tree, 'move-empty')).toHaveLength(0);
  });

  it('leads the morning with last night’s recap and grades the lineup for Pro', () => {
    jest.useFakeTimers({ now: new Date('2026-10-14T13:00:00Z') }); // 9 AM ET
    mockIsPremium = true;
    mockRecapView = { ...nightWith('OFF', { goals: 1, shots: 2 }), date: '2026-10-13' };
    const tree = render();
    expect(byTestId(tree, 'tonight-recap')).toHaveLength(1);
    expect(byTestId(tree, 'recap-points')[0].props.children).toBe('4.0');
    expect(byTestId(tree, 'recap-hindsight')).toHaveLength(1);
    expect(allText(tree)).toContain('LAST NIGHT · TUE OCT 13');
    act(() => { byTestId(tree, 'recap-share')[0].props.onPress(); });
    const sheets = tree.root.findAll((n: any) => n.type === 'ShareCardSheet');
    const recapSheet = sheets.find((n: any) => n.props.visible);
    expect(recapSheet.props.content).toMatchObject({ kind: 'recap', count: '4.0', countSuffix: 'PTS' });
  });

  it('shows free users the recap points with a Pro grade link, not the grade', () => {
    jest.useFakeTimers({ now: new Date('2026-10-14T13:00:00Z') });
    mockRecapView = { ...nightWith('OFF', { goals: 1, shots: 2 }), date: '2026-10-13' };
    const tree = render();
    expect(byTestId(tree, 'recap-hindsight')).toHaveLength(0);
    expect(allText(tree)).toContain('from your players');
    act(() => { byTestId(tree, 'recap-unlock')[0].props.onPress(); });
    expect(mockOpenPaywall).toHaveBeenCalledWith('recap');
  });

  it('hides the recap after noon Eastern', () => {
    jest.useFakeTimers({ now: new Date('2026-10-14T17:00:00Z') }); // 1 PM ET
    mockRecapView = { ...nightWith('OFF', { goals: 1 }), date: '2026-10-13' };
    expect(byTestId(render(), 'tonight-recap')).toHaveLength(0);
  });

  describe('guidance', () => {
    const press = (tree: any, id: string) => act(() => { byTestId(tree, id)[0].props.onPress(); });

    it('shows none of the guidance cards unless the guidance asks for them', () => {
      const tree = render();
      for (const id of ['tonight-first-night', 'tonight-reminder-prompt', 'tonight-next-up']) expect(byTestId(tree, id)).toHaveLength(0);
    });

    it('leads with the first-night guide, with progress and one tap per step', () => {
      mockGuidance.firstNight = { ...mockGuidance.firstNight, visible: true, done: ['players'] };
      const tree = render();
      expect(byTestId(tree, 'tonight-first-night')).toHaveLength(1);
      expect(allText(tree)).toContain('YOUR FIRST NIGHT · 1 OF 3');
      expect(allText(tree)).toContain('See who plays tonight');
      press(tree, 'first-night-pickup');
      expect(mockGuidance.firstNight.onStep).toHaveBeenCalledWith('pickup');
      press(tree, 'first-night-close');
      expect(mockGuidance.firstNight.onDismiss).toHaveBeenCalled();
    });

    it('points step one at the next night when tonight is quiet', () => {
      mockGuidance.firstNight = { ...mockGuidance.firstNight, visible: true, quietNight: true };
      expect(allText(render())).toContain('See who plays next');
    });

    it('offers the game-night reminder with both answers', () => {
      mockGuidance.reminderPrompt = { ...mockGuidance.reminderPrompt, visible: true };
      const tree = render();
      expect(allText(tree)).toContain('Want a heads-up tonight?');
      press(tree, 'reminder-prompt-later');
      expect(mockGuidance.reminderPrompt.dismiss).toHaveBeenCalled();
      press(tree, 'reminder-prompt-on');
      expect(mockGuidance.reminderPrompt.accept).toHaveBeenCalled();
    });

    it('closes the screen with one next step', () => {
      mockGuidance.nextUp = {
        item: { kind: 'fill_slot', title: 'Fill your empty D slot', detail: 'Find a pickup who plays tonight', action: { type: 'pickups', date: '2026-10-13', slot: 'D' } },
        onPress: jest.fn(),
      };
      const tree = render();
      expect(allText(tree)).toContain('UP NEXT');
      expect(allText(tree)).toContain('Fill your empty D slot');
      press(tree, 'tonight-next-up');
      expect(mockGuidance.nextUp.onPress).toHaveBeenCalled();
    });
  });
});
