/**
 * Tests for components/EdgeSpotlight.tsx
 * Covers: renders mix of player/edge items, caps at 5, see all link, empty data
 *
 * Strategy: Since the component uses FlatList (which is hard to test via JSX tree walking),
 * we access the FlatList's `data`, `renderItem`, and `ListFooterComponent` props directly.
 */

import React from 'react';

// Mock react-native
jest.mock('react-native', () => ({
  View: ({ children, ...props }: any) =>
    React.createElement('View', props, children),
  Text: 'Text',
  FlatList: 'FlatList',
  Pressable: ({ children, ...props }: any) =>
    React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children),
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: ({ children, ...props }: any) =>
      React.createElement('AnimatedView', props, children),
    createAnimatedComponent: (c: any) => c,
  },
  FadeInRight: { duration: () => ({ delay: () => ({}) }) },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../constants/theme', () => ({
  theme: {
    card: '#141c2e',
    text: '#ffffff',
    subtext: '#94a3b8',
    subtle: '#1a2332',
    accent: '#60a5fa',
    fonts: { mono: 'monospace', system: 'System' },
    glass: { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', borderBright: 'rgba(255,255,255,0.25)', blur: 60 },
    elevation: { low: {}, medium: {}, high: {}, glow: {} },
    semantic: { positive: '#10b981', negative: '#ef4444', neutral: '#fbbf24', info: '#60a5fa' },
    animation: { spring: { damping: 15, stiffness: 150 }, entryDuration: 400, staggerDelay: 80, flashDuration: 600 },
  },
}));

jest.mock('expo-image', () => ({
  Image: 'ExpoImage',
}));

jest.mock('../../constants/teamColors', () => ({
  getTeamColors: (abbrev: string) => ({
    primary: '#005DAA',
    secondary: '#FFFFFF',
  }),
  getAccessibleTextColor: () => '#4488cc',
}));

import EdgeSpotlight from '../EdgeSpotlight';

// Helpers to navigate the element tree
function collectText(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (node.props?.children) return collectText(node.props.children);
  return [];
}

function findByTestID(node: any, testID: string): any {
  if (!node) return null;
  if (node.props?.testID === testID) return node;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTestID(child, testID);
      if (found) return found;
    }
  }
  if (node.props?.children) return findByTestID(node.props.children, testID);
  return null;
}

/** Find the FlatList element in the tree to access data/renderItem/ListFooterComponent */
function findFlatList(node: any): any {
  if (!node) return null;
  if (node.type === 'FlatList') return node;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFlatList(child);
      if (found) return found;
    }
  }
  if (node.props?.children) return findFlatList(node.props.children);
  return null;
}

// Mock data factories
function makeSkater(firstName: string, lastName: string, goals: number, assists: number, gamesPlayed: number) {
  return {
    playerId: Math.floor(Math.random() * 99999),
    firstName,
    lastName,
    positionCode: 'C',
    gamesPlayed,
    goals,
    assists,
    points: goals + assists,
    plusMinus: 5,
    shots: 100,
    shootingPctg: goals > 0 ? goals / 100 : 0,
  };
}

const mockGames = [
  { homeTeam: { abbrev: 'TOR' }, awayTeam: { abbrev: 'MTL' } },
  { homeTeam: { abbrev: 'BOS' }, awayTeam: { abbrev: 'NYR' } },
];

const mockPlayerStatsMap = new Map([
  ['TOR', {
    skaters: [
      makeSkater('Auston', 'Matthews', 30, 25, 50),
      makeSkater('Mitch', 'Marner', 15, 40, 50),
      makeSkater('John', 'Tavares', 20, 20, 50),
    ],
    goalies: [],
  }],
  ['MTL', {
    skaters: [
      makeSkater('Nick', 'Suzuki', 18, 30, 50),
      makeSkater('Cole', 'Caufield', 25, 15, 50),
    ],
    goalies: [],
  }],
  ['BOS', {
    skaters: [
      makeSkater('David', 'Pastrnak', 28, 32, 50),
    ],
    goalies: [],
  }],
]);

const mockSkaterLanding = {
  hardestShot: {
    player: {
      id: 8482671,
      firstName: { default: 'Jake' },
      lastName: { default: 'Kleven' },
      team: { abbrev: 'EDM' },
    },
    shotSpeed: { imperial: { speed: 103.0 }, metric: { speed: 165.8 } },
  },
  maxSkatingSpeed: {
    player: {
      id: 8478402,
      firstName: { default: 'Connor' },
      lastName: { default: 'McDavid' },
      team: { abbrev: 'EDM' },
    },
    skatingSpeed: { imperial: { speed: 24.57 } },
  },
  totalDistanceSkated: {
    player: {
      id: 8478402,
      firstName: { default: 'Connor' },
      lastName: { default: 'McDavid' },
      team: { abbrev: 'EDM' },
    },
    distanceSkated: { imperial: { distance: 230.39 } },
  },
};

const mockTeamLanding = {
  shotAttemptsOver90: {
    team: { id: 1, abbrev: 'NJD' },
    value: 150,
    rank: 1,
  },
  burstsOver22: {
    team: { id: 2, abbrev: 'EDM' },
    value: 120,
    rank: 2,
  },
  distancePer60: {
    team: { id: 3, abbrev: 'COL' },
    value: 200,
    rank: 3,
  },
};

describe('EdgeSpotlight', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  describe('renders mix of player and edge stat items', () => {
    it('FlatList data contains player items from playerStatsMap', () => {
      const element = EdgeSpotlight({
        playerStatsMap: mockPlayerStatsMap,
        games: mockGames,
        skaterLanding: null,
        teamLanding: null,
      });
      const fl = findFlatList(element);
      expect(fl).not.toBeNull();
      const data = fl.props.data;
      const playerItems = data.filter((d: any) => d.key.startsWith('player-'));
      expect(playerItems.length).toBeGreaterThan(0);
      // Each player item should have pts value
      for (const item of playerItems) {
        expect(item.value).toContain('pts');
      }
    });

    it('FlatList data contains edge items from skaterLanding', () => {
      const element = EdgeSpotlight({
        playerStatsMap: new Map(),
        games: mockGames,
        skaterLanding: mockSkaterLanding,
        teamLanding: null,
      });
      const fl = findFlatList(element);
      const data = fl.props.data;
      const edgeItems = data.filter((d: any) => d.key.startsWith('edge-'));
      expect(edgeItems.length).toBeGreaterThan(0);

      const shotItem = data.find((d: any) => d.key === 'edge-shot-speed');
      expect(shotItem).toBeDefined();
      expect(shotItem.category).toBe('SHOT SPEED');
      expect(shotItem.label).toBe('Kleven');
      expect(shotItem.value).toContain('mph');
    });

    it('FlatList data contains teamLanding items', () => {
      const element = EdgeSpotlight({
        playerStatsMap: new Map(),
        games: mockGames,
        skaterLanding: null,
        teamLanding: mockTeamLanding,
      });
      const fl = findFlatList(element);
      const data = fl.props.data;
      const shotsItem = data.find((d: any) => d.key === 'edge-shots-90');
      expect(shotsItem).toBeDefined();
      expect(shotsItem.category).toBe('SHOTS >90mph');
      expect(shotsItem.value).toBe('150');
    });

    it('interleaves player and edge items in data', () => {
      const element = EdgeSpotlight({
        playerStatsMap: mockPlayerStatsMap,
        games: mockGames,
        skaterLanding: mockSkaterLanding,
        teamLanding: mockTeamLanding,
      });
      const fl = findFlatList(element);
      const data = fl.props.data;
      const playerItems = data.filter((d: any) => d.key.startsWith('player-'));
      const edgeItems = data.filter((d: any) => d.key.startsWith('edge-'));
      expect(playerItems.length).toBeGreaterThan(0);
      expect(edgeItems.length).toBeGreaterThan(0);
      // First item should be a player (interleave starts with players)
      expect(data[0].key).toMatch(/^player-/);
      // Second should be edge
      if (data.length >= 2) {
        expect(data[1].key).toMatch(/^edge-/);
      }
    });
  });

  describe('caps at 5 items', () => {
    it('FlatList data has at most 5 items', () => {
      const element = EdgeSpotlight({
        playerStatsMap: mockPlayerStatsMap,
        games: mockGames,
        skaterLanding: mockSkaterLanding,
        teamLanding: mockTeamLanding,
      });
      const fl = findFlatList(element);
      expect(fl.props.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('shows "See all" link', () => {
    it('FlatList has a ListFooterComponent', () => {
      const element = EdgeSpotlight({
        playerStatsMap: mockPlayerStatsMap,
        games: mockGames,
        skaterLanding: null,
        teamLanding: null,
      });
      const fl = findFlatList(element);
      expect(fl.props.ListFooterComponent).toBeDefined();
    });

    it('footer renders "See All" and "Edge Stats" text', () => {
      const element = EdgeSpotlight({
        playerStatsMap: mockPlayerStatsMap,
        games: mockGames,
        skaterLanding: null,
        teamLanding: null,
      });
      const fl = findFlatList(element);
      const footer = fl.props.ListFooterComponent();
      const text = collectText(footer).join(' ');
      expect(text).toContain('See All');
      expect(text).toContain('Edge Stats');
    });

    it('footer has testID "spotlight-see-all"', () => {
      const element = EdgeSpotlight({
        playerStatsMap: mockPlayerStatsMap,
        games: mockGames,
        skaterLanding: null,
        teamLanding: null,
      });
      const fl = findFlatList(element);
      const footer = fl.props.ListFooterComponent();
      const seeAll = findByTestID(footer, 'spotlight-see-all');
      expect(seeAll).not.toBeNull();
    });

    it('footer navigates to /stats on press', () => {
      const element = EdgeSpotlight({
        playerStatsMap: mockPlayerStatsMap,
        games: mockGames,
        skaterLanding: null,
        teamLanding: null,
      });
      const fl = findFlatList(element);
      const footer = fl.props.ListFooterComponent();
      const seeAll = findByTestID(footer, 'spotlight-see-all');
      seeAll.props.onPress();
      expect(mockPush).toHaveBeenCalledWith('/stats');
    });
  });

  describe('handles empty data', () => {
    it('returns null when no items can be built', () => {
      const element = EdgeSpotlight({
        playerStatsMap: new Map(),
        games: [],
        skaterLanding: null,
        teamLanding: null,
      });
      expect(element).toBeNull();
    });

    it('returns null when playerStatsMap has no matching teams', () => {
      const nonMatchingMap = new Map([
        ['SEA', { skaters: [makeSkater('Test', 'Player', 10, 10, 50)], goalies: [] }],
      ]);
      const element = EdgeSpotlight({
        playerStatsMap: nonMatchingMap,
        games: mockGames,
        skaterLanding: null,
        teamLanding: null,
      });
      expect(element).toBeNull();
    });

    it('handles empty skaters array gracefully', () => {
      const emptyMap = new Map([
        ['TOR', { skaters: [], goalies: [] }],
      ]);
      const element = EdgeSpotlight({
        playerStatsMap: emptyMap,
        games: mockGames,
        skaterLanding: null,
        teamLanding: null,
      });
      expect(element).toBeNull();
    });
  });

  describe('header and container', () => {
    it('has testID "edge-spotlight" on container', () => {
      const element = EdgeSpotlight({
        playerStatsMap: mockPlayerStatsMap,
        games: mockGames,
        skaterLanding: null,
        teamLanding: null,
      });
      const container = findByTestID(element, 'edge-spotlight');
      expect(container).not.toBeNull();
    });

    it('shows "EDGE SPOTLIGHT" header text', () => {
      const element = EdgeSpotlight({
        playerStatsMap: mockPlayerStatsMap,
        games: mockGames,
        skaterLanding: null,
        teamLanding: null,
      });
      const text = collectText(element);
      expect(text).toContain('Edge Spotlight');
    });
  });

  describe('renderItem produces cards with expected content', () => {
    it('each rendered card has testID with spotlight-card prefix', () => {
      const element = EdgeSpotlight({
        playerStatsMap: new Map(),
        games: mockGames,
        skaterLanding: mockSkaterLanding,
        teamLanding: null,
      });
      const fl = findFlatList(element);
      for (let i = 0; i < fl.props.data.length; i++) {
        const card = fl.props.renderItem({ item: fl.props.data[i], index: i });
        const testIDNode = findByTestID(card, `spotlight-card-${fl.props.data[i].key}`);
        expect(testIDNode).not.toBeNull();
      }
    });

    it('each rendered card contains category, value, label, and team text', () => {
      const element = EdgeSpotlight({
        playerStatsMap: new Map(),
        games: mockGames,
        skaterLanding: mockSkaterLanding,
        teamLanding: null,
      });
      const fl = findFlatList(element);
      for (let i = 0; i < fl.props.data.length; i++) {
        const item = fl.props.data[i];
        const card = fl.props.renderItem({ item, index: i });
        const text = collectText(card);
        expect(text).toContain(item.category);
        expect(text).toContain(item.value);
        expect(text).toContain(item.label);
        expect(text).toContain(item.teamAbbrev);
      }
    });
  });

  describe('keyExtractor', () => {
    it('FlatList keyExtractor returns item key', () => {
      const element = EdgeSpotlight({
        playerStatsMap: mockPlayerStatsMap,
        games: mockGames,
        skaterLanding: null,
        teamLanding: null,
      });
      const fl = findFlatList(element);
      const key = fl.props.keyExtractor({ key: 'player-TOR-A.Matthews' });
      expect(key).toBe('player-TOR-A.Matthews');
    });
  });
});
