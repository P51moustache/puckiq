/**
 * Tests for AllGamesCard component
 * Verifies matchup display, game time formatting, H2H records, and insights.
 */

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: any) => styles },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  FadeInUp: {
    duration: () => ({ delay: () => ({}) }),
    springify: () => ({ damping: () => ({ stiffness: () => ({ delay: () => ({}) }) }) }),
  },
  useSharedValue: (v: any) => ({ value: v }),
  useAnimatedStyle: (fn: () => any) => fn(),
  withSpring: (v: any) => v,
  withRepeat: (v: any) => v,
  withTiming: (v: any) => v,
}));

// Mock expo modules
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Polyline: 'Polyline',
  Circle: 'Circle',
  Path: 'Path',
}));
jest.mock('../FormSparkline', () => 'FormSparkline');

// Mock ConfidenceBadge
jest.mock('../ConfidenceBadge', () => ({
  ConfidenceBadge: (props: any) => ({ type: 'ConfidenceBadge', props }),
}));

// Mock teamColors
jest.mock('../../constants/teamColors', () => ({
  getTeamColors: () => ({ primary: '#003E7E', secondary: '#fff' }),
}));

import React from 'react';

// Mock hooks that require render context
jest.spyOn(React, 'useEffect').mockImplementation((fn) => { /* no-op in tests */ });
jest.spyOn(React, 'useState').mockImplementation(((init: any) => [init, jest.fn()]) as any);
jest.spyOn(React, 'useCallback').mockImplementation((fn: any) => fn);

// Access the inner component through React.memo wrapper
const AllGamesCardDefault = require('../AllGamesCard').default;
const AllGamesCardInner = AllGamesCardDefault.type || AllGamesCardDefault;

// Helper to build a minimal game object
function makeGame(overrides: Record<string, any> = {}) {
  return {
    id: 2024020001,
    awayTeam: { abbrev: 'TOR', score: 0 },
    homeTeam: { abbrev: 'MTL', score: 0 },
    gameState: 'FUT',
    startTimeUTC: '2026-02-03T00:00:00Z',
    ...overrides,
  };
}

const defaultPrediction = { homeWinProb: 55, awayWinProb: 45 };
const noop = () => {};

function renderCard(overrides: Record<string, any> = {}) {
  const props = {
    game: makeGame(overrides.game),
    prediction: overrides.prediction ?? defaultPrediction,
    h2hRecord: overrides.h2hRecord ?? null,
    insight: overrides.insight ?? null,
    index: overrides.index ?? 0,
    onPress: overrides.onPress ?? noop,
    awayMomentum: overrides.awayMomentum ?? null,
    homeMomentum: overrides.homeMomentum ?? null,
    restAdvantage: overrides.restAdvantage ?? null,
  };
  return AllGamesCardInner(props);
}

// Recursively find elements that match a predicate
function findAll(tree: any, predicate: (node: any) => boolean): any[] {
  const results: any[] = [];
  if (!tree) return results;
  if (predicate(tree)) results.push(tree);
  const children = tree?.props?.children;
  if (Array.isArray(children)) {
    children.forEach((child: any) => results.push(...findAll(child, predicate)));
  } else if (children && typeof children === 'object') {
    results.push(...findAll(children, predicate));
  }
  return results;
}

// Find all text content in the tree
function collectText(tree: any): string[] {
  const texts: string[] = [];
  if (!tree) return texts;
  if (typeof tree === 'string' || typeof tree === 'number') {
    texts.push(String(tree));
    return texts;
  }
  const children = tree?.props?.children;
  if (Array.isArray(children)) {
    children.forEach((child: any) => texts.push(...collectText(child)));
  } else if (children != null) {
    texts.push(...collectText(children));
  }
  return texts;
}

// Find elements with a specific testID
function findByTestID(tree: any, testID: string): any | null {
  const results = findAll(tree, (node) => node?.props?.testID === testID);
  return results[0] ?? null;
}

describe('AllGamesCard', () => {
  describe('matchup text', () => {
    it('renders "TOR @ MTL" for a TOR at MTL game', () => {
      const tree = renderCard();
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('TOR');
      expect(allText).toContain('@');
      expect(allText).toContain('MTL');
    });

    it('renders correct away/home abbreviations', () => {
      const tree = renderCard({
        game: { awayTeam: { abbrev: 'BOS' }, homeTeam: { abbrev: 'NYR' } },
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('BOS');
      expect(allText).toContain('NYR');
    });
  });

  describe('game time for future games', () => {
    it('shows a formatted time string for a future game', () => {
      const tree = renderCard({
        game: { gameState: 'FUT', startTimeUTC: '2026-02-03T00:00:00Z' },
      });
      const allText = collectText(tree).join(' ');
      // The time is locale-dependent but should contain a colon and a number
      expect(allText).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('LIVE indicator', () => {
    it('shows LIVE for a game in LIVE state', () => {
      const tree = renderCard({
        game: {
          gameState: 'LIVE',
          period: 2,
          clock: { timeRemaining: '12:34' },
          awayTeam: { abbrev: 'TOR', score: 2 },
          homeTeam: { abbrev: 'MTL', score: 1 },
        },
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('LIVE');
    });

    it('shows LIVE for a game in CRIT state', () => {
      const tree = renderCard({
        game: {
          gameState: 'CRIT',
          period: 3,
          clock: { timeRemaining: '01:00' },
          awayTeam: { abbrev: 'TOR', score: 3 },
          homeTeam: { abbrev: 'MTL', score: 3 },
        },
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('LIVE');
    });

    it('includes period and score in live game text', () => {
      const tree = renderCard({
        game: {
          gameState: 'LIVE',
          period: 2,
          clock: { timeRemaining: '12:34' },
          awayTeam: { abbrev: 'TOR', score: 2 },
          homeTeam: { abbrev: 'MTL', score: 1 },
        },
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('2-1');
      expect(allText).toContain('P2');
    });

    it('shows OT for period > 3', () => {
      const tree = renderCard({
        game: {
          gameState: 'LIVE',
          period: 4,
          clock: { timeRemaining: '03:00' },
          awayTeam: { abbrev: 'TOR', score: 2 },
          homeTeam: { abbrev: 'MTL', score: 2 },
        },
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('OT');
    });
  });

  describe('FINAL for completed games', () => {
    it('shows FINAL for a completed game', () => {
      const tree = renderCard({
        game: {
          gameState: 'FINAL',
          awayTeam: { abbrev: 'TOR', score: 4 },
          homeTeam: { abbrev: 'MTL', score: 2 },
        },
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('FINAL');
      expect(allText).toContain('4-2');
    });

    it('shows FINAL for an OFF-state game', () => {
      const tree = renderCard({
        game: {
          gameState: 'OFF',
          awayTeam: { abbrev: 'TOR', score: 3 },
          homeTeam: { abbrev: 'MTL', score: 1 },
        },
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('FINAL');
      expect(allText).toContain('3-1');
    });
  });

  describe('H2H record', () => {
    it('displays H2H record when teamA leads', () => {
      const tree = renderCard({
        h2hRecord: {
          teamA: 'TOR',
          teamB: 'MTL',
          teamAWins: 3,
          teamBWins: 1,
          otLosses: 0,
          games: [],
        },
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('TOR leads 3-1');
    });

    it('displays H2H record when teamB leads', () => {
      const tree = renderCard({
        h2hRecord: {
          teamA: 'TOR',
          teamB: 'MTL',
          teamAWins: 1,
          teamBWins: 3,
          otLosses: 0,
          games: [],
        },
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('MTL leads 3-1');
    });

    it('displays "Series tied" when even', () => {
      const tree = renderCard({
        h2hRecord: {
          teamA: 'TOR',
          teamB: 'MTL',
          teamAWins: 2,
          teamBWins: 2,
          otLosses: 0,
          games: [],
        },
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('Series tied 2-2');
    });

    it('displays "First meeting" when 0-0', () => {
      const tree = renderCard({
        h2hRecord: {
          teamA: 'TOR',
          teamB: 'MTL',
          teamAWins: 0,
          teamBWins: 0,
          otLosses: 0,
          games: [],
        },
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('First meeting');
    });

    it('does not render H2H row when h2hRecord is null', () => {
      const tree = renderCard({ h2hRecord: null, insight: null });
      const allText = collectText(tree).join(' ');
      expect(allText).not.toContain('leads');
      expect(allText).not.toContain('First meeting');
      expect(allText).not.toContain('Series tied');
    });
  });

  describe('insight text', () => {
    it('displays insight text when provided', () => {
      const tree = renderCard({ insight: 'TOR on a 5-game win streak' });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('TOR on a 5-game win streak');
    });

    it('does not display insight when null', () => {
      const tree = renderCard({ insight: null });
      const allText = collectText(tree).join(' ');
      expect(allText).not.toContain('win streak');
    });
  });

  describe('testID', () => {
    it('has testID with the game id', () => {
      const tree = renderCard({ game: { id: 2024020999 } });
      const card = findByTestID(tree, 'all-games-card-2024020999');
      expect(card).not.toBeNull();
    });

    it('uses default game id in testID', () => {
      const tree = renderCard();
      const card = findByTestID(tree, 'all-games-card-2024020001');
      expect(card).not.toBeNull();
    });
  });

  describe('formatGameTime TBD case', () => {
    it('shows TBD when game has no startTimeUTC and is not live/final', () => {
      const tree = renderCard({
        game: {
          gameState: 'FUT',
          startTimeUTC: undefined,
        },
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('TBD');
    });
  });

  describe('ConfidenceBadge', () => {
    // The ConfidenceBadge mock returns a plain object { type: 'ConfidenceBadge', props }.
    // In the React tree these appear as elements whose type is the mock function.
    // We find them by checking if the node has a confidence prop.
    function findBadges(tree: any): any[] {
      return findAll(tree, (n) => n?.props?.confidence !== undefined && n?.props?.size !== undefined);
    }

    it('renders a ConfidenceBadge with md size', () => {
      const tree = renderCard();
      const badges = findBadges(tree);
      expect(badges.length).toBeGreaterThanOrEqual(1);
      expect(badges[0].props.size).toBe('md');
    });

    it('computes confidence from homeWinProb deviation', () => {
      // confidence = Math.round(Math.abs(homeWinProb - 50) * 2)
      // homeWinProb = 55 => |55-50|*2 = 10
      const tree = renderCard({ prediction: { homeWinProb: 55, awayWinProb: 45 } });
      const badges = findBadges(tree);
      expect(badges[0].props.confidence).toBe(10);
    });

    it('computes high confidence for strong favorite', () => {
      // homeWinProb = 85 => |85-50|*2 = 70
      const tree = renderCard({ prediction: { homeWinProb: 85, awayWinProb: 15 } });
      const badges = findBadges(tree);
      expect(badges[0].props.confidence).toBe(70);
    });

    it('computes zero confidence for 50-50 game', () => {
      const tree = renderCard({ prediction: { homeWinProb: 50, awayWinProb: 50 } });
      const badges = findBadges(tree);
      expect(badges[0].props.confidence).toBe(0);
    });
  });

  describe('factor dots (MTM, REST, H2H)', () => {
    const homeMomentumHigh = { score: 8, trend: '↑' as const, history: [2, 1, 3, 2, 1], label: 'Strong' };
    const awayMomentumLow = { score: 2, trend: '↘' as const, history: [-1, 0, 1, -2, 0], label: 'Weak' };
    const awayMomentumHigh = { score: 9, trend: '↑' as const, history: [3, 2, 1, 2, 3], label: 'Hot' };
    const homeMomentumLow = { score: 1, trend: '↓' as const, history: [-2, -1, 0, -1, -2], label: 'Cold' };
    const evenMomentumHome = { score: 5, trend: '→' as const, history: [1, 0, -1, 1, 0], label: 'Even' };
    const evenMomentumAway = { score: 5, trend: '→' as const, history: [0, 1, -1, 0, 1], label: 'Even' };

    const restHomeAdvantage = { home: 72, away: 48 }; // diff > 10, home favored
    const restAwayAdvantage = { home: 40, away: 70 }; // diff < -10, away favored
    const restEven = { home: 55, away: 50 }; // diff <= 10, even

    const h2hHomeLeads = { teamA: 'TOR', teamB: 'MTL', teamAWins: 1, teamBWins: 3, games: [{}, {}, {}, {}] };
    const h2hAwayLeads = { teamA: 'TOR', teamB: 'MTL', teamAWins: 3, teamBWins: 1, games: [{}, {}, {}, {}] };

    it('does NOT render factor row when fewer than 2 factors available', () => {
      // Only momentum, no rest or h2h
      const tree = renderCard({
        homeMomentum: homeMomentumHigh,
        awayMomentum: awayMomentumLow,
      });
      const allText = collectText(tree).join(' ');
      expect(allText).not.toContain('MTM');
    });

    it('renders factor row when 2+ factors available (MTM + REST)', () => {
      const tree = renderCard({
        homeMomentum: homeMomentumHigh,
        awayMomentum: awayMomentumLow,
        restAdvantage: restHomeAdvantage,
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('MTM');
      expect(allText).toContain('REST');
    });

    it('renders all three factor labels when all data present', () => {
      const tree = renderCard({
        homeMomentum: homeMomentumHigh,
        awayMomentum: awayMomentumLow,
        restAdvantage: restHomeAdvantage,
        h2hRecord: h2hHomeLeads,
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('MTM');
      expect(allText).toContain('REST');
      expect(allText).toContain('H2H');
    });

    it('renders factor row with MTM + H2H (no rest)', () => {
      const tree = renderCard({
        homeMomentum: homeMomentumHigh,
        awayMomentum: awayMomentumLow,
        h2hRecord: h2hAwayLeads,
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('MTM');
      expect(allText).toContain('H2H');
      expect(allText).not.toContain('REST');
    });

    it('renders factor row with REST + H2H (no momentum)', () => {
      const tree = renderCard({
        restAdvantage: restAwayAdvantage,
        h2hRecord: h2hHomeLeads,
      });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('REST');
      expect(allText).toContain('H2H');
      expect(allText).not.toContain('MTM');
    });

    it('does NOT render factor row when only 1 factor (rest only)', () => {
      const tree = renderCard({
        restAdvantage: restHomeAdvantage,
      });
      const allText = collectText(tree).join(' ');
      expect(allText).not.toContain('REST');
      expect(allText).not.toContain('MTM');
    });

    it('does NOT render factor row when only h2h with no games', () => {
      const tree = renderCard({
        homeMomentum: homeMomentumHigh,
        awayMomentum: awayMomentumLow,
        h2hRecord: { teamA: 'TOR', teamB: 'MTL', teamAWins: 0, teamBWins: 0, games: [] },
      });
      const allText = collectText(tree).join(' ');
      // h2h returns null when total games = 0, so only 1 factor (MTM)
      expect(allText).not.toContain('H2H');
    });

    it('does NOT render factor row when no factor data provided', () => {
      const tree = renderCard();
      const allText = collectText(tree).join(' ');
      expect(allText).not.toContain('MTM');
      expect(allText).not.toContain('REST');
      expect(allText).not.toContain('H2H');
    });
  });
});
