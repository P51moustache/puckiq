/**
 * Tests for CompactPlayerRow component
 * Verifies rendering of ranks #6-10: rank, small headshot, last name only,
 * team abbrev, trend pill, and stat value.
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

// Mock teamColors
jest.mock('../../constants/teamColors', () => ({
  getTeamColors: (abbrev: string) => ({
    primary: abbrev === 'EDM' ? '#FF4C00' : '#006D75',
    secondary: '#FFFFFF',
  }),
}));

import React from 'react';

// Override React hooks to work outside render cycle
(React as any).useCallback = (fn: any) => fn;
(React as any).useMemo = (fn: any) => fn();

import CompactPlayerRowMemo from '../CompactPlayerRow';
import type { TrendingPlayer, StatCategory } from '../../services/playerTrends';

const CompactPlayerRow = (CompactPlayerRowMemo as any).type || CompactPlayerRowMemo;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<TrendingPlayer> = {}): TrendingPlayer {
  return {
    playerId: 97,
    playerName: 'Connor McDavid',
    firstName: 'Connor',
    lastName: 'McDavid',
    headshotUrl: 'https://example.com/mcdavid.png',
    teamAbbrev: 'EDM',
    position: 'C',
    trendLabel: 'HOT',
    hotColdScore: 9.0,
    pointStreak: 8,
    recentPpg: 2.0,
    seasonPpg: 1.5,
    recentGpg: 0.8,
    seasonGpg: 0.6,
    recentShootingPct: 20.0,
    seasonShootingPct: 16.0,
    avgGoals5g: 0.8,
    avgAssists5g: 1.2,
    avgPoints5g: 2.0,
    avgShots5g: 4.0,
    avgGoals10g: 0.7,
    avgPoints10g: 1.8,
    gamesPlayed: 55,
    seasonGoals: 35,
    seasonAssists: 50,
    seasonPoints: 85,
    recentShotsPerGame: 4.0,
    seasonShotsPerGame: 3.6,
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

describe('CompactPlayerRow', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  describe('basic rendering', () => {
    it('renders with correct testID', () => {
      const result = CompactPlayerRow({
        player: makePlayer(),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      expect(result?.props?.testID).toBe('compact-row-97');
    });

    it('uses player ID in testID', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ playerId: 13 }),
        rank: 7,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      expect(result?.props?.testID).toBe('compact-row-13');
    });

    it('renders last name only (not full name)', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ lastName: 'McDavid', playerName: 'Connor McDavid' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('McDavid');
      expect(texts).not.toContain('Connor McDavid');
    });

    it('renders rank number', () => {
      const result = CompactPlayerRow({
        player: makePlayer(),
        rank: 8,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('8');
    });

    it('renders team abbreviation', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ teamAbbrev: 'EDM' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('EDM');
    });
  });

  describe('trend pill', () => {
    it('renders trend label text HOT', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ trendLabel: 'HOT' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('HOT');
    });

    it('renders COLD trend label', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ trendLabel: 'COLD' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('COLD');
    });

    it('renders STEADY trend label', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ trendLabel: 'STEADY' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('STEADY');
    });

    it('applies trend color to pill background', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ trendLabel: 'HOT' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const views = findByType(result, 'View');
      const pill = views.find(
        (v: any) => v?.props?.style && Array.isArray(v.props.style) &&
          v.props.style.some((s: any) => s?.backgroundColor === '#ef444422'),
      );
      expect(pill).toBeTruthy();
    });

    it('applies COLD trend color to pill background', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ trendLabel: 'COLD' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const views = findByType(result, 'View');
      const pill = views.find(
        (v: any) => v?.props?.style && Array.isArray(v.props.style) &&
          v.props.style.some((s: any) => s?.backgroundColor === '#6366f122'),
      );
      expect(pill).toBeTruthy();
    });
  });

  describe('stat values by category', () => {
    it('shows goals with 2 decimal places', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ avgGoals5g: 0.8 }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('0.80');
    });

    it('shows assists with 2 decimal places', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ avgAssists5g: 1.2 }),
        rank: 6,
        statCategory: 'assists',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('1.20');
    });

    it('shows points with 2 decimal places', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ avgPoints5g: 2.0 }),
        rank: 6,
        statCategory: 'points',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('2.00');
    });

    it('shows shots with 1 decimal place', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ avgShots5g: 4.0 }),
        rank: 6,
        statCategory: 'shots',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('4.0');
    });

    it('shows 0 for unknown stat category', () => {
      const result = CompactPlayerRow({
        player: makePlayer(),
        rank: 6,
        statCategory: 'unknown' as StatCategory,
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('0');
    });
  });

  describe('headshot image', () => {
    it('renders Image with correct source', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ headshotUrl: 'https://example.com/connor.png' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const images = findByType(result, 'Image');
      expect(images.length).toBeGreaterThan(0);
      expect(images[0].props.source).toEqual({ uri: 'https://example.com/connor.png' });
    });

    it('uses memory-disk cache policy', () => {
      const result = CompactPlayerRow({
        player: makePlayer(),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const images = findByType(result, 'Image');
      expect(images[0].props.cachePolicy).toBe('memory-disk');
    });

    it('uses recycling key with player ID', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ playerId: 97 }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const images = findByType(result, 'Image');
      expect(images[0].props.recyclingKey).toBe('compact-97');
    });
  });

  describe('onPress callback', () => {
    it('calls onPress with playerId when pressed', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ playerId: 97 }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      result?.props?.onPress();
      expect(mockOnPress).toHaveBeenCalledWith(97);
    });

    it('calls onPress with correct ID for different player', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ playerId: 8 }),
        rank: 9,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      result?.props?.onPress();
      expect(mockOnPress).toHaveBeenCalledWith(8);
    });
  });
});
