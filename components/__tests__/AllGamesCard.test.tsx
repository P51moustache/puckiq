/**
 * Tests for AllGamesCard component
 * Verifies matchup display, game time formatting, H2H records, and insights.
 */

// Mock react-native
import React from 'react';

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
  getAccessibleTextColor: () => '#4488cc',
}));

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

  // NOTE: The redesigned card removed the old "factor dots" row (MTM / REST / H2H
  // abbreviation labels) and the momentum (awayMomentum/homeMomentum) props.
  // Rest advantage is now surfaced as a single "rest chip" rendered from the
  // `restAdvantage` prop via getRestChip(home, away):
  //   home === 0           -> "HOME B2B"
  //   away === 0           -> "AWAY B2B"
  //   (home - away) >= 25  -> "HOME REST +"
  //   (home - away) <= -25 -> "AWAY REST +"
  //   otherwise            -> no chip
  // H2H is shown separately in row 3 (covered by the "H2H record" suite above).
  describe('rest chip', () => {
    it('shows "HOME REST +" when home is well-rested vs away', () => {
      const tree = renderCard({ restAdvantage: { home: 75, away: 50 } }); // diff = 25
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('HOME REST +');
    });

    it('shows "AWAY REST +" when away is well-rested vs home', () => {
      const tree = renderCard({ restAdvantage: { home: 50, away: 75 } }); // diff = -25
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('AWAY REST +');
    });

    it('shows "HOME B2B" when home is on a back-to-back', () => {
      const tree = renderCard({ restAdvantage: { home: 0, away: 75 } });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('HOME B2B');
    });

    it('shows "AWAY B2B" when away is on a back-to-back', () => {
      const tree = renderCard({ restAdvantage: { home: 75, away: 0 } });
      const allText = collectText(tree).join(' ');
      expect(allText).toContain('AWAY B2B');
    });

    it('does NOT show a rest chip when rest is roughly even', () => {
      const tree = renderCard({ restAdvantage: { home: 55, away: 50 } }); // diff = 5
      const allText = collectText(tree).join(' ');
      expect(allText).not.toContain('REST');
      expect(allText).not.toContain('B2B');
    });

    it('does NOT show a rest chip when no restAdvantage data is provided', () => {
      const tree = renderCard();
      const allText = collectText(tree).join(' ');
      expect(allText).not.toContain('REST');
      expect(allText).not.toContain('B2B');
    });
  });
});
