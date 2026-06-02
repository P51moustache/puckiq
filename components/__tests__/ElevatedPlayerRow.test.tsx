/**
 * Tests for ElevatedPlayerRow component
 * Verifies rendering of ranks #2-5: headshot, name, trend/flames,
 * sparkline, watch button, stat value, and onPress.
 */

// Mock react-native (string components)
import React from 'react';

import ElevatedPlayerRowMemo from '../ElevatedPlayerRow';
import type { TrendingPlayer, HitRateResult, LeaderTrend, StatCategory } from '../../services/playerTrends';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Pressable: 'Pressable',
  Platform: { select: (opts: any) => opts.ios },
  StyleSheet: { create: (styles: any) => styles },
}));

// Mock expo-image
jest.mock('expo-image', () => ({ Image: 'Image' }));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

// Mock Sparkline
jest.mock('../Sparkline', () => ({
  Sparkline: 'Sparkline',
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

// Override React hooks to work outside render cycle
(React as any).useCallback = (fn: any) => fn;
(React as any).useMemo = (fn: any) => fn();
(React as any).useState = (init: any) => [init, jest.fn()];
(React as any).useEffect = (_fn: any) => {};

const ElevatedPlayerRow = (ElevatedPlayerRowMemo as any).type || ElevatedPlayerRowMemo;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<TrendingPlayer> = {}): TrendingPlayer {
  return {
    playerId: 29,
    playerName: 'Nathan MacKinnon',
    firstName: 'Nathan',
    lastName: 'MacKinnon',
    headshotUrl: 'https://example.com/mackinnon.png',
    teamAbbrev: 'COL',
    position: 'C',
    trendLabel: 'HOT',
    hotColdScore: 7.5,
    pointStreak: 3,
    recentPpg: 1.6,
    seasonPpg: 1.3,
    recentGpg: 0.6,
    seasonGpg: 0.45,
    recentShootingPct: 16.0,
    seasonShootingPct: 13.5,
    avgGoals5g: 0.6,
    avgAssists5g: 1.0,
    avgPoints5g: 1.6,
    avgShots5g: 3.8,
    avgGoals10g: 0.5,
    avgPoints10g: 1.3,
    gamesPlayed: 52,
    seasonGoals: 28,
    seasonAssists: 40,
    seasonPoints: 68,
    recentShotsPerGame: 3.8,
    seasonShotsPerGame: 3.2,
    ...overrides,
  };
}

function makeTrend(overrides: Partial<LeaderTrend> = {}): LeaderTrend {
  return {
    playerId: 29,
    trendLabel: 'HOT',
    hotColdScore: 7.5,
    pointStreak: 3,
    recentPpg: 1.6,
    seasonPpg: 1.3,
    projectedGoals82: 44,
    projectedAssists82: 63,
    projectedPoints82: 107,
    goalsPerGame: 0.54,
    pointsPerGame: 1.31,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ElevatedPlayerRow', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  describe('basic rendering', () => {
    it('renders with correct testID', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      expect(result?.props?.testID).toBe('elevated-row-29');
    });

    it('uses player ID in testID', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ playerId: 8 }),
        rank: 3,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      expect(result?.props?.testID).toBe('elevated-row-8');
    });

    it('renders player name', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('Nathan MacKinnon');
    });

    it('renders rank number', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 3,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('3');
    });

    it('renders position and team abbrev', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ position: 'LW', teamAbbrev: 'BOS' }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      const joined = texts.join('');
      expect(joined).toContain('LW');
      expect(joined).toContain('BOS');
    });

    it('renders season points', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ seasonPoints: 68 }),
        rank: 2,
        statCategory: 'points',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('68');
    });

    it('renders games played', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ gamesPlayed: 52 }),
        rank: 2,
        statCategory: 'points',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts.join('')).toContain('52 GP');
    });
  });

  describe('flame badges and trend arrows', () => {
    it('renders flame badge for HOT trend (5 flames)', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ trendLabel: 'HOT' }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      const flameText = texts.find(t => t.includes('\uD83D\uDD25'));
      expect(flameText).toBeTruthy();
      // HOT = 5 flames
      expect(flameText!.split('\uD83D\uDD25').length - 1).toBe(5);
    });

    it('renders flame badge for WARM trend (4 flames)', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ trendLabel: 'WARM' }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      const flameText = texts.find(t => t.includes('\uD83D\uDD25'));
      expect(flameText).toBeTruthy();
      // WARM = 4 flames
      expect(flameText!.split('\uD83D\uDD25').length - 1).toBe(4);
    });

    it('renders trend arrow icon for COOL trend (no flames)', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ trendLabel: 'COOL' }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      const flameText = texts.find(t => t.includes('\uD83D\uDD25'));
      expect(flameText).toBeFalsy();
      const icons = findByType(result, 'Ionicons');
      const arrowIcon = icons.find((i: any) => i.props.name === 'arrow-down');
      expect(arrowIcon).toBeTruthy();
    });

    it('renders trend arrow for COLD trend', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ trendLabel: 'COLD' }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const icons = findByType(result, 'Ionicons');
      const arrowIcon = icons.find((i: any) => i.props.name === 'arrow-down');
      expect(arrowIcon).toBeTruthy();
    });

    it('renders no flames and no trend arrow for STEADY trend', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ trendLabel: 'STEADY' }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      const flameText = texts.find(t => t.includes('\uD83D\uDD25'));
      expect(flameText).toBeFalsy();
      const icons = findByType(result, 'Ionicons');
      const trendArrows = icons.filter(
        (i: any) => i.props.name === 'arrow-up' || i.props.name === 'arrow-down'
      );
      expect(trendArrows.length).toBe(0);
    });
  });

  describe('sparkline', () => {
    it('renders a Sparkline component', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const sparklines = findByType(result, 'Sparkline');
      expect(sparklines.length).toBe(1);
    });

    it('passes width=50 and height=18 to Sparkline', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const sparklines = findByType(result, 'Sparkline');
      expect(sparklines[0].props.width).toBe(50);
      expect(sparklines[0].props.height).toBe(18);
    });

    it('passes 5-element data array to Sparkline', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const sparklines = findByType(result, 'Sparkline');
      expect(sparklines[0].props.data).toHaveLength(5);
    });

    it('uses leaderTrend data for sparkline when provided', () => {
      const trend = makeTrend({ seasonPpg: 1.3, recentPpg: 1.6, hotColdScore: 7.5 });
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 2,
        leaderTrend: trend,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const sparklines = findByType(result, 'Sparkline');
      // First value should be seasonPpg
      expect(sparklines[0].props.data[0]).toBe(1.3);
    });
  });

  describe('watch button', () => {
    it('renders an eye-outline icon button', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const icons = findByType(result, 'Ionicons');
      const eyeIcon = icons.find((i: any) => i.props.name === 'eye-outline');
      expect(eyeIcon).toBeTruthy();
      expect(eyeIcon.props.size).toBe(16);
    });

    it('renders watch button with correct testID', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ playerId: 29 }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const touchables = findByType(result, 'TouchableOpacity');
      const watchBtn = touchables.find((t: any) => t.props.testID === 'watch-btn-29');
      expect(watchBtn).toBeTruthy();
    });
  });

  describe('headshot image', () => {
    it('renders Image with correct source', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ headshotUrl: 'https://example.com/nate.png' }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const images = findByType(result, 'Image');
      expect(images.length).toBeGreaterThan(0);
      expect(images[0].props.source).toEqual({ uri: 'https://example.com/nate.png' });
    });

    it('renders Image with accessibility label', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const images = findByType(result, 'Image');
      expect(images[0].props.accessibilityLabel).toBe('Nathan MacKinnon headshot');
    });
  });

  describe('onPress callback', () => {
    it('calls onPress with playerId when pressed', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ playerId: 29 }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      result?.props?.onPress();
      expect(mockOnPress).toHaveBeenCalledWith(29);
    });

    it('calls onPress with correct ID for different player', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ playerId: 87 }),
        rank: 3,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      result?.props?.onPress();
      expect(mockOnPress).toHaveBeenCalledWith(87);
    });
  });
});
