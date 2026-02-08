/**
 * Tests for HeroLeaderCard component
 * Verifies rendering of the #1 ranked player card: team-color accent,
 * pace projection, trend badge, stat row, hit rate bar, and onPress.
 */

// Mock react-native (string components)
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Platform: { select: (opts: any) => opts.ios },
  StyleSheet: { create: (styles: any) => styles },
}));

// Mock expo-image
jest.mock('expo-image', () => ({ Image: 'Image' }));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

// Mock teamColors
jest.mock('../../constants/teamColors', () => ({
  getTeamColors: (abbrev: string) => ({
    primary: abbrev === 'TOR' ? '#00205B' : '#CE1126',
    secondary: '#FFFFFF',
  }),
}));

// Mock HitRateBar
jest.mock('../HitRateBar', () => 'HitRateBar');

import React from 'react';

// Override React hooks to work outside render cycle
const origMemo = React.memo;
(React as any).useCallback = (fn: any) => fn;
(React as any).useMemo = (fn: any) => fn();

import HeroLeaderCardMemo from '../HeroLeaderCard';
import type { TrendingPlayer, HitRateResult, LeaderTrend, StatCategory } from '../../services/playerTrends';

// Extract the inner component from React.memo wrapper
const HeroLeaderCard = (HeroLeaderCardMemo as any).type || HeroLeaderCardMemo;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<TrendingPlayer> = {}): TrendingPlayer {
  return {
    playerId: 34,
    playerName: 'Auston Matthews',
    firstName: 'Auston',
    lastName: 'Matthews',
    headshotUrl: 'https://example.com/matthews.png',
    teamAbbrev: 'TOR',
    position: 'C',
    trendLabel: 'HOT',
    hotColdScore: 8.5,
    pointStreak: 5,
    recentPpg: 1.8,
    seasonPpg: 1.2,
    recentGpg: 0.8,
    seasonGpg: 0.55,
    recentShootingPct: 18.5,
    seasonShootingPct: 15.2,
    avgGoals5g: 0.8,
    avgAssists5g: 1.0,
    avgPoints5g: 1.8,
    avgShots5g: 4.2,
    avgGoals10g: 0.7,
    avgPoints10g: 1.5,
    gamesPlayed: 50,
    seasonGoals: 30,
    seasonAssists: 25,
    seasonPoints: 55,
    recentShotsPerGame: 4.2,
    seasonShotsPerGame: 3.5,
    ...overrides,
  };
}

function makeLeaderTrend(overrides: Partial<LeaderTrend> = {}): LeaderTrend {
  return {
    playerId: 34,
    trendLabel: 'HOT',
    hotColdScore: 8.5,
    pointStreak: 5,
    recentPpg: 1.8,
    seasonPpg: 1.2,
    projectedGoals82: 49,
    projectedAssists82: 41,
    projectedPoints82: 90,
    goalsPerGame: 0.6,
    pointsPerGame: 1.1,
    ...overrides,
  };
}

function makeHitRate(overrides: Partial<HitRateResult> = {}): HitRateResult {
  return {
    hit: 8,
    total: 10,
    rate: 0.8,
    games: [
      { gameId: 1, value: 1, exceeded: true, gameDate: '2026-01-01' },
      { gameId: 2, value: 0, exceeded: false, gameDate: '2026-01-03' },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectTexts(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectTexts);
  if (node?.props?.children) return collectTexts(node.props.children);
  return [];
}

function findByType(node: any, type: string): any[] {
  const found: any[] = [];
  if (!node) return found;
  if (Array.isArray(node)) {
    node.forEach((child) => found.push(...findByType(child, type)));
    return found;
  }
  if (node?.type === type) found.push(node);
  if (node?.props?.children) found.push(...findByType(node.props.children, type));
  return found;
}

function findByTestId(node: any, testID: string): any {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = findByTestId(child, testID);
      if (result) return result;
    }
    return null;
  }
  if (node?.props?.testID === testID) return node;
  if (node?.props?.children) return findByTestId(node.props.children, testID);
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeroLeaderCard', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  describe('basic rendering', () => {
    it('renders with correct testID', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      expect(result).not.toBeNull();
      expect(result?.props?.testID).toBe('hero-card-34');
    });

    it('uses player ID in testID', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ playerId: 97 }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      expect(result?.props?.testID).toBe('hero-card-97');
    });

    it('renders player name', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('Auston Matthews');
    });

    it('renders position and team', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      const joined = texts.join('');
      expect(joined).toContain('C');
      expect(joined).toContain('TOR');
    });

    it('renders rank number 1', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('1');
    });

    it('renders trend label', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ trendLabel: 'WARM' }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('WARM');
    });
  });

  describe('stat category display', () => {
    it('shows L5 AVG for goals', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ avgGoals5g: 0.8 }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('L5 AVG');
      expect(texts).toContain('0.80');
    });

    it('shows L5 AVG for assists', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ avgAssists5g: 1.0, gamesPlayed: 50, seasonAssists: 25 }),
        statCategory: 'assists',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('1.00');
    });

    it('shows L5 AVG for points', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ avgPoints5g: 1.8, gamesPlayed: 50, seasonPoints: 55 }),
        statCategory: 'points',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('1.80');
    });

    it('shows L5 AVG for shots', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ avgShots5g: 4.2 }),
        statCategory: 'shots',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('4.20');
    });

    it('shows season average', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ gamesPlayed: 50, seasonGoals: 30 }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('SEASON');
      expect(texts).toContain('0.60');
    });

    it('handles zero games played for season avg', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ gamesPlayed: 0, seasonGoals: 0 }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('0.00');
    });
  });

  describe('pace projection', () => {
    it('shows pace text for goals when leaderTrend provided', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        leaderTrend: makeLeaderTrend({ projectedGoals82: 49 }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts.join('')).toContain('On pace for 49 goals');
    });

    it('shows pace text for assists', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        leaderTrend: makeLeaderTrend({ projectedAssists82: 41 }),
        statCategory: 'assists',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts.join('')).toContain('On pace for 41 assists');
    });

    it('shows pace text for points', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        leaderTrend: makeLeaderTrend({ projectedPoints82: 90 }),
        statCategory: 'points',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts.join('')).toContain('On pace for 90 points');
    });

    it('does not show pace for shots category', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        leaderTrend: makeLeaderTrend(),
        statCategory: 'shots',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts.join('')).not.toContain('On pace');
    });

    it('does not show pace when leaderTrend is undefined', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts.join('')).not.toContain('On pace');
    });

    it('does not show pace when projection is 0', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        leaderTrend: makeLeaderTrend({ projectedGoals82: 0 }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts.join('')).not.toContain('On pace');
    });
  });

  describe('point streak', () => {
    it('shows streak when pointStreak > 0', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ pointStreak: 5 }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('STREAK');
      // Rendered as {player.pointStreak}G => "5" and "G" as siblings
      expect(texts.join('')).toContain('5G');
    });

    it('does not show streak when pointStreak is 0', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ pointStreak: 0 }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).not.toContain('STREAK');
    });
  });

  describe('hit rate bar', () => {
    it('renders HitRateBar when hitRate provided with total > 0', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        hitRate: makeHitRate({ hit: 8, total: 10 }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const hitRateBars = findByType(result, 'HitRateBar');
      expect(hitRateBars.length).toBe(1);
      expect(hitRateBars[0].props.hit).toBe(8);
      expect(hitRateBars[0].props.total).toBe(10);
    });

    it('does not render HitRateBar when hitRate is undefined', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const hitRateBars = findByType(result, 'HitRateBar');
      expect(hitRateBars.length).toBe(0);
    });

    it('does not render HitRateBar when total is 0', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        hitRate: makeHitRate({ hit: 0, total: 0 }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const hitRateBars = findByType(result, 'HitRateBar');
      expect(hitRateBars.length).toBe(0);
    });
  });

  describe('matchup display', () => {
    it('shows matchup opponent when present', () => {
      const result = HeroLeaderCard({
        player: makePlayer({
          matchup: { opponent: 'MTL', gameTime: '7:00 PM', isHome: true, gameId: 123 },
        }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts.join('')).toContain('vs MTL');
    });

    it('does not show matchup when not present', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ matchup: undefined }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts.join('')).not.toContain('vs ');
    });
  });

  describe('headshot image', () => {
    it('renders Image with correct source', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ headshotUrl: 'https://example.com/test.png' }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const images = findByType(result, 'Image');
      expect(images.length).toBeGreaterThan(0);
      expect(images[0].props.source).toEqual({ uri: 'https://example.com/test.png' });
    });

    it('renders Image with accessibility label', () => {
      const result = HeroLeaderCard({
        player: makePlayer(),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const images = findByType(result, 'Image');
      expect(images[0].props.accessibilityLabel).toBe('Auston Matthews headshot');
    });
  });

  describe('onPress callback', () => {
    it('calls onPress with playerId when pressed', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ playerId: 34 }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      result?.props?.onPress();
      expect(mockOnPress).toHaveBeenCalledWith(34);
    });

    it('calls onPress with correct ID for different player', () => {
      const result = HeroLeaderCard({
        player: makePlayer({ playerId: 97 }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      result?.props?.onPress();
      expect(mockOnPress).toHaveBeenCalledWith(97);
    });
  });
});
