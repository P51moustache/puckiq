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
    RefreshControl: (props: any) => React.createElement('RefreshControl', props),
    Pressable: ({ children, style, ...props }: any) =>
      React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    StyleSheet: { create: (s: any) => s, hairlineWidth: 0.5 },
    Platform: { OS: 'ios', select: (o: any) => o.ios },
    Linking: { openURL: jest.fn() },
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
jest.mock('../../TeamsProvider', () => ({ useTeams: () => ({ team: mockTeam, ready: true }) }));

let mockView: any = null;
jest.mock('../../../hooks/useCoach', () => ({
  useNight: () => mockView,
  useNhlToday: () => '2026-10-13',
}));

// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import React from 'react';
import TonightScreen from '../TonightScreen';
import { buildSkaterForm } from '../../../services/fantasy/form';
import { createTeam } from '../../../services/teams';

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
  });

  it('asks for a roster when the team is empty', () => {
    mockTeam = createTeam({ name: 'Empty' });
    const tree = render();
    expect(byTestId(tree, 'tonight-empty')).toHaveLength(1);
    expect(byTestId(tree, 'tonight-add-players')).toHaveLength(1);
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
    expect(mockOpenPlayer).toHaveBeenCalledWith(8478402, 'roster');
  });
});
