/**
 * Tests for CompactPlayerRow component
 * Verifies rendering of ranks #6-10: rank, small headshot, last name only,
 * team abbrev, trend pill (text label, not flame badges), and stat value.
 */

// Mock react-native (string components)
import React from 'react';

import CompactPlayerRowMemo from '../CompactPlayerRow';
import type { TrendingPlayer, StatCategory } from '../../services/playerTrends';

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

// Mock teamColors
jest.mock('../../constants/teamColors', () => ({
  getTeamColors: (abbrev: string) => ({
    primary: abbrev === 'EDM' ? '#FF4C00' : '#006D75',
    secondary: '#FFFFFF',
  }),
}));

// Override React hooks to work outside render cycle
(React as any).useCallback = (fn: any) => fn;
(React as any).useMemo = (fn: any) => fn();

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

    it('renders season points', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ seasonPoints: 85 }),
        rank: 6,
        statCategory: 'points',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('85');
    });

    it('renders goals and assists breakdown', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ seasonGoals: 35, seasonAssists: 50 }),
        rank: 6,
        statCategory: 'points',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      const joined = texts.join('');
      expect(joined).toContain('35G');
      expect(joined).toContain('50A');
    });
  });

  // NOTE: The redesigned row no longer renders flame emojis for HOT/WARM trends.
  // Every non-STEADY trend is now shown as a text "pill": a bordered View wrapping
  // a Text node that displays the raw trendLabel (e.g. "HOT", "WARM", "COOL",
  // "COLD"). The pill is tinted via `borderColor` (background stays transparent)
  // using TREND_COLORS; STEADY renders no pill at all.
  describe('trend pills', () => {
    it('renders the HOT trend label as a text pill', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ trendLabel: 'HOT' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('HOT');
      // Redesigned row uses text pills, not flame emojis.
      const flameText = texts.find(t => t.includes('\uD83D\uDD25'));
      expect(flameText).toBeFalsy();
    });

    it('renders the WARM trend label as a text pill', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ trendLabel: 'WARM' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('WARM');
      const flameText = texts.find(t => t.includes('\uD83D\uDD25'));
      expect(flameText).toBeFalsy();
    });

    it('renders COLD trend label as text pill', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ trendLabel: 'COLD' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('COLD');
      // No flame emojis
      const flameText = texts.find(t => t.includes('\uD83D\uDD25'));
      expect(flameText).toBeFalsy();
    });

    it('renders COOL trend label as text pill', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ trendLabel: 'COOL' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).toContain('COOL');
    });

    it('renders nothing for STEADY trend (no pill, no flames)', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ trendLabel: 'STEADY' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      expect(texts).not.toContain('STEADY');
      const flameText = texts.find(t => t.includes('\uD83D\uDD25'));
      expect(flameText).toBeFalsy();
    });

    it('applies the COLD trend color to the pill border', () => {
      const result = CompactPlayerRow({
        player: makePlayer({ trendLabel: 'COLD' }),
        rank: 6,
        statCategory: 'goals',
        onPress: mockOnPress,
      });
      const views = findByType(result, 'View');
      // The pill is a bordered View whose borderColor is the trend color
      // (rinkGlass.blueLight = '#4cc9f0' for COLD). Background is transparent.
      const pill = views.find(
        (v: any) => v?.props?.style && Array.isArray(v.props.style) &&
          v.props.style.some((s: any) => s?.borderColor === '#4cc9f0'),
      );
      expect(pill).toBeTruthy();
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
