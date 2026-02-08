/**
 * Tests for GoalieSpotlightCard component
 * Verifies rendering of the featured goalie card: SV% comparison (L5 vs season),
 * GAA, record, team-color accent, trend badge, and conditional SV% coloring.
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
    primary: abbrev === 'NYR' ? '#0038A8' : '#CE1126',
    secondary: '#FFFFFF',
  }),
}));

import React from 'react';

// Override React hooks to work outside render cycle
(React as any).useCallback = (fn: any) => fn;
(React as any).useMemo = (fn: any) => fn();

import GoalieSpotlightCardMemo from '../GoalieSpotlightCard';
import type { TrendingGoalie } from '../../services/playerTrends';

const GoalieSpotlightCard = (GoalieSpotlightCardMemo as any).type || GoalieSpotlightCardMemo;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGoalie(overrides: Partial<TrendingGoalie> = {}): TrendingGoalie {
  return {
    playerId: 31,
    playerName: 'Igor Shesterkin',
    firstName: 'Igor',
    lastName: 'Shesterkin',
    headshotUrl: 'https://example.com/shesterkin.png',
    teamAbbrev: 'NYR',
    trendLabel: 'HOT',
    avgGa5g: 1.8,
    savePct5g: 0.935,
    wins5g: 4,
    avgGa10g: 2.1,
    savePct10g: 0.920,
    wins10g: 7,
    starts: 48,
    seasonSavePct: 0.918,
    seasonAvgGa: 2.45,
    seasonWins: 30,
    seasonShutouts: 4,
    gamesPlayed: 48,
    wins: 30,
    losses: 12,
    otLosses: 6,
    goalsAgainstAvg: 2.45,
    savePctg: 0.918,
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

describe('GoalieSpotlightCard', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  describe('basic rendering', () => {
    it('renders with correct testID', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie(), onPress: mockOnPress });
      expect(result?.props?.testID).toBe('goalie-spotlight-31');
    });

    it('uses goalie ID in testID', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ playerId: 35 }), onPress: mockOnPress });
      expect(result?.props?.testID).toBe('goalie-spotlight-35');
    });

    it('renders goalie name', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie(), onPress: mockOnPress });
      const texts = collectTexts(result);
      expect(texts).toContain('Igor Shesterkin');
    });

    it('renders position and team', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ teamAbbrev: 'NYR' }), onPress: mockOnPress });
      const texts = collectTexts(result);
      const joined = texts.join('');
      expect(joined).toContain('G');
      expect(joined).toContain('NYR');
    });

    it('renders trend label', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ trendLabel: 'WARM' }), onPress: mockOnPress });
      const texts = collectTexts(result);
      expect(texts).toContain('WARM');
    });
  });

  describe('team color accent', () => {
    it('applies team primary color to left border for NYR', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ teamAbbrev: 'NYR' }), onPress: mockOnPress });
      const style = result?.props?.style;
      expect(style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ borderLeftColor: '#0038A8', borderLeftWidth: 4 }),
        ]),
      );
    });

    it('uses different color for different team', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ teamAbbrev: 'MTL' }), onPress: mockOnPress });
      const style = result?.props?.style;
      expect(style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ borderLeftColor: '#CE1126' }),
        ]),
      );
    });
  });

  describe('trend badge styling', () => {
    it('applies HOT trend border color to badge', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ trendLabel: 'HOT' }), onPress: mockOnPress });
      const views = findByType(result, 'View');
      const badge = views.find(
        (v: any) => v?.props?.style && Array.isArray(v.props.style) &&
          v.props.style.some((s: any) => s?.borderColor === '#ef4444'),
      );
      expect(badge).toBeTruthy();
    });

    it('applies COLD trend border color to badge', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ trendLabel: 'COLD' }), onPress: mockOnPress });
      const views = findByType(result, 'View');
      const badge = views.find(
        (v: any) => v?.props?.style && Array.isArray(v.props.style) &&
          v.props.style.some((s: any) => s?.borderColor === '#6366f1'),
      );
      expect(badge).toBeTruthy();
    });
  });

  describe('save percentage display', () => {
    it('shows L5 SV% label and value', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ savePct5g: 0.935 }), onPress: mockOnPress });
      const texts = collectTexts(result);
      expect(texts).toContain('L5 SV%');
      expect(texts).toContain('93.5%');
    });

    it('shows season SV% label and value', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ seasonSavePct: 0.918 }), onPress: mockOnPress });
      const texts = collectTexts(result);
      expect(texts).toContain('SEASON');
      expect(texts).toContain('91.8%');
    });

    it('shows --- when savePct5g is null', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ savePct5g: null }), onPress: mockOnPress });
      const texts = collectTexts(result);
      expect(texts).toContain('---');
    });

    it('shows --- when seasonSavePct is null', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ seasonSavePct: null }), onPress: mockOnPress });
      const texts = collectTexts(result);
      expect(texts).toContain('---');
    });
  });

  describe('SV% conditional coloring', () => {
    it('applies green style when L5 SV% exceeds season SV%', () => {
      // diff = 0.935 - 0.918 = 0.017 > 0 => green
      const result = GoalieSpotlightCard({
        goalie: makeGoalie({ savePct5g: 0.935, seasonSavePct: 0.918 }),
        onPress: mockOnPress,
      });
      const textNodes = findByType(result, 'Text');
      const svPctNode = textNodes.find((t: any) => {
        const content = collectTexts(t);
        return content.includes('93.5%');
      });
      // Style array includes statValueGreen = { color: '#22c55e' }
      expect(svPctNode?.props?.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: '#22c55e' }),
        ]),
      );
    });

    it('applies red style when L5 SV% is more than 1% below season', () => {
      // diff = 0.880 - 0.918 = -0.038 < -0.01 => red
      const result = GoalieSpotlightCard({
        goalie: makeGoalie({ savePct5g: 0.880, seasonSavePct: 0.918 }),
        onPress: mockOnPress,
      });
      const textNodes = findByType(result, 'Text');
      const svPctNode = textNodes.find((t: any) => {
        const content = collectTexts(t);
        return content.includes('88.0%');
      });
      expect(svPctNode?.props?.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: '#ef4444' }),
        ]),
      );
    });

    it('applies neither color when diff is between -1% and 0%', () => {
      // diff = 0.915 - 0.918 = -0.003 (not > 0, not < -0.01)
      const result = GoalieSpotlightCard({
        goalie: makeGoalie({ savePct5g: 0.915, seasonSavePct: 0.918 }),
        onPress: mockOnPress,
      });
      const textNodes = findByType(result, 'Text');
      const svPctNode = textNodes.find((t: any) => {
        const content = collectTexts(t);
        return content.includes('91.5%');
      });
      const styleStr = JSON.stringify(svPctNode?.props?.style || {});
      expect(styleStr).not.toContain('#22c55e');
      expect(styleStr).not.toContain('#ef4444');
    });

    it('no color override when either SV% is null', () => {
      const result = GoalieSpotlightCard({
        goalie: makeGoalie({ savePct5g: null, seasonSavePct: 0.918 }),
        onPress: mockOnPress,
      });
      const textNodes = findByType(result, 'Text');
      const dashNode = textNodes.find((t: any) => {
        const content = collectTexts(t);
        return content.includes('---');
      });
      const styleStr = JSON.stringify(dashNode?.props?.style || {});
      expect(styleStr).not.toContain('#22c55e');
      expect(styleStr).not.toContain('#ef4444');
    });
  });

  describe('GAA display', () => {
    it('shows L5 GAA label and value', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ avgGa5g: 1.8 }), onPress: mockOnPress });
      const texts = collectTexts(result);
      expect(texts).toContain('L5 GAA');
      expect(texts).toContain('1.80');
    });

    it('formats GAA to 2 decimal places', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ avgGa5g: 2.0 }), onPress: mockOnPress });
      const texts = collectTexts(result);
      expect(texts).toContain('2.00');
    });
  });

  describe('record display', () => {
    it('shows RECORD label', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie(), onPress: mockOnPress });
      const texts = collectTexts(result);
      expect(texts).toContain('RECORD');
    });

    it('shows W-L-OT values', () => {
      const result = GoalieSpotlightCard({
        goalie: makeGoalie({ wins: 30, losses: 12, otLosses: 6 }),
        onPress: mockOnPress,
      });
      const texts = collectTexts(result);
      const joined = texts.join('');
      expect(joined).toContain('30');
      expect(joined).toContain('12');
      expect(joined).toContain('6');
    });
  });

  describe('headshot image', () => {
    it('renders Image with correct source', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie(), onPress: mockOnPress });
      const images = findByType(result, 'Image');
      expect(images.length).toBeGreaterThan(0);
      expect(images[0].props.source).toEqual({ uri: 'https://example.com/shesterkin.png' });
    });

    it('renders Image with accessibility label', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie(), onPress: mockOnPress });
      const images = findByType(result, 'Image');
      expect(images[0].props.accessibilityLabel).toBe('Igor Shesterkin headshot');
    });
  });

  describe('onPress callback', () => {
    it('calls onPress with playerId when pressed', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ playerId: 31 }), onPress: mockOnPress });
      result?.props?.onPress();
      expect(mockOnPress).toHaveBeenCalledWith(31);
    });

    it('calls onPress with correct ID for different goalie', () => {
      const result = GoalieSpotlightCard({ goalie: makeGoalie({ playerId: 70 }), onPress: mockOnPress });
      result?.props?.onPress();
      expect(mockOnPress).toHaveBeenCalledWith(70);
    });
  });
});
