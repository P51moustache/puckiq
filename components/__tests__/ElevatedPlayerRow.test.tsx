/**
 * Tests for ElevatedPlayerRow component
 * Verifies rendering of ranks #2-5: headshot, name, trend arrow,
 * L5 mini dots from hit rate, stat value with unit label, and onPress.
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

import React from 'react';

// Override React hooks to work outside render cycle
(React as any).useCallback = (fn: any) => fn;
(React as any).useMemo = (fn: any) => fn();

import ElevatedPlayerRowMemo from '../ElevatedPlayerRow';
import type { TrendingPlayer, HitRateResult, StatCategory } from '../../services/playerTrends';

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

function makeHitRate(overrides: Partial<HitRateResult> = {}): HitRateResult {
  return {
    hit: 7,
    total: 10,
    rate: 0.7,
    games: [
      { gameId: 1, value: 1, exceeded: true, gameDate: '2026-01-05' },
      { gameId: 2, value: 0, exceeded: false, gameDate: '2026-01-04' },
      { gameId: 3, value: 1, exceeded: true, gameDate: '2026-01-03' },
      { gameId: 4, value: 1, exceeded: true, gameDate: '2026-01-02' },
      { gameId: 5, value: 0, exceeded: false, gameDate: '2026-01-01' },
      { gameId: 6, value: 1, exceeded: true, gameDate: '2025-12-31' },
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
  });

  describe('trend arrow icon', () => {
    it('renders up arrow for HOT trend', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ trendLabel: 'HOT' }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const icons = findByType(result, 'Ionicons');
      expect(icons.length).toBeGreaterThan(0);
      expect(icons[0].props.name).toBe('arrow-up');
      expect(icons[0].props.color).toBe('#ef4444');
    });

    it('renders up arrow for WARM trend', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ trendLabel: 'WARM' }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const icons = findByType(result, 'Ionicons');
      expect(icons[0].props.name).toBe('arrow-up');
      expect(icons[0].props.color).toBe('#f97316');
    });

    it('renders remove icon for STEADY trend', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ trendLabel: 'STEADY' }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const icons = findByType(result, 'Ionicons');
      expect(icons[0].props.name).toBe('remove');
      expect(icons[0].props.color).toBe('#60a5fa');
    });

    it('renders down arrow for COOL trend', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ trendLabel: 'COOL' }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const icons = findByType(result, 'Ionicons');
      expect(icons[0].props.name).toBe('arrow-down');
      expect(icons[0].props.color).toBe('#38bdf8');
    });

    it('renders down arrow for COLD trend', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ trendLabel: 'COLD' }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const icons = findByType(result, 'Ionicons');
      expect(icons[0].props.name).toBe('arrow-down');
      expect(icons[0].props.color).toBe('#6366f1');
    });
  });

  describe('stat values by category', () => {
    it('shows goals per game with GPG unit', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ avgGoals5g: 0.6 }),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('0.60');
      expect(texts).toContain('GPG');
    });

    it('shows assists per game with APG unit', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ avgAssists5g: 1.0 }),
        rank: 2,
        statCategory: 'assists',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('1.00');
      expect(texts).toContain('APG');
    });

    it('shows points per game with PPG unit', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ avgPoints5g: 1.6 }),
        rank: 2,
        statCategory: 'points',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('1.60');
      expect(texts).toContain('PPG');
    });

    it('shows shots per game with SPG unit', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer({ avgShots5g: 3.8 }),
        rank: 2,
        statCategory: 'shots',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('3.8');
      expect(texts).toContain('SPG');
    });
  });

  describe('L5 mini dots', () => {
    it('renders 5 dots from hit rate games (slices first 5, reverses)', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 2,
        hitRate: makeHitRate(),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      // Find View elements with backgroundColor (the dot Views)
      const views = findByType(result, 'View');
      const dots = views.filter(
        (v: any) => v?.props?.style && Array.isArray(v.props.style) &&
          v.props.style.some((s: any) =>
            s?.backgroundColor === '#22c55e' || s?.backgroundColor === 'rgba(255, 255, 255, 0.15)',
          ),
      );
      expect(dots.length).toBe(5);
    });

    it('does not render dots when hitRate is undefined', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 2,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const views = findByType(result, 'View');
      const dots = views.filter(
        (v: any) => v?.props?.style && Array.isArray(v.props.style) &&
          v.props.style.some((s: any) =>
            s?.backgroundColor === '#22c55e' || s?.backgroundColor === 'rgba(255, 255, 255, 0.15)',
          ),
      );
      expect(dots.length).toBe(0);
    });

    it('does not render dots when hitRate has empty games', () => {
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 2,
        hitRate: makeHitRate({ games: [] }),
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const views = findByType(result, 'View');
      const dots = views.filter(
        (v: any) => v?.props?.style && Array.isArray(v.props.style) &&
          v.props.style.some((s: any) =>
            s?.backgroundColor === '#22c55e' || s?.backgroundColor === 'rgba(255, 255, 255, 0.15)',
          ),
      );
      expect(dots.length).toBe(0);
    });

    it('uses green for exceeded and dim for not', () => {
      const hitRate = makeHitRate({
        games: [
          { gameId: 1, value: 1, exceeded: true, gameDate: '2026-01-03' },
          { gameId: 2, value: 0, exceeded: false, gameDate: '2026-01-02' },
          { gameId: 3, value: 1, exceeded: true, gameDate: '2026-01-01' },
        ],
      });
      const result = ElevatedPlayerRow({
        player: makePlayer(),
        rank: 2,
        hitRate,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const views = findByType(result, 'View');
      const greenDots = views.filter(
        (v: any) => v?.props?.style && Array.isArray(v.props.style) &&
          v.props.style.some((s: any) => s?.backgroundColor === '#22c55e'),
      );
      const dimDots = views.filter(
        (v: any) => v?.props?.style && Array.isArray(v.props.style) &&
          v.props.style.some((s: any) => s?.backgroundColor === 'rgba(255, 255, 255, 0.15)'),
      );
      expect(greenDots.length).toBe(2);
      expect(dimDots.length).toBe(1);
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
