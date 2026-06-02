import React from 'react';

import HeroMatchup from '../HeroMatchup';

// Mock useState to work outside React render context
jest.spyOn(React, 'useState').mockImplementation(((init: any) => [init, jest.fn()]) as any);

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'View', createAnimatedComponent: (c: any) => c },
  FadeInDown: { duration: () => ({ delay: () => ({}) }) },
  FadeInRight: { duration: () => ({ delay: () => ({}) }) },
  FadeInUp: { duration: () => ({ delay: () => ({}) }) },
  useSharedValue: (v: any) => ({ value: v }),
  useAnimatedStyle: (fn: () => any) => fn(),
  useAnimatedProps: () => ({}),
  useDerivedValue: (fn: () => any) => ({ value: fn() }),
  withTiming: (v: any) => v,
  withSpring: (v: any) => v,
  Easing: { out: (fn: any) => fn, cubic: (v: any) => v },
}));

jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../ConfidenceBadge', () => ({
  ConfidenceBadge: 'ConfidenceBadge',
}));
jest.mock('../../hooks/useHaptics', () => ({
  useHaptics: () => ({ press: jest.fn(), success: jest.fn(), error: jest.fn() }),
}));

const baseGame = {
  id: 1,
  gameState: 'FUT',
  startTimeUTC: '2026-02-03T00:00:00Z',
  awayTeam: { abbrev: 'TOR' },
  homeTeam: { abbrev: 'MTL' },
};

const baseProps = {
  game: baseGame as any,
  prediction: { homeWinProb: 55, awayWinProb: 45 },
  confidenceScore: 72,
  h2hRecord: null as any,
  situationalFactors: null as any,
  onPress: jest.fn(),
  onShare: jest.fn(),
};

function collectText(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (node.props?.children) return collectText(node.props.children);
  return [];
}

function findByType(node: any, typeName: string): any[] {
  const results: any[] = [];
  if (!node) return results;
  if (Array.isArray(node)) { node.forEach((n: any) => results.push(...findByType(n, typeName))); return results; }
  if (node.type === typeName) results.push(node);
  if (node.props?.children) results.push(...findByType(node.props.children, typeName));
  return results;
}

function findByTestID(node: any, testID: string): any | null {
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

describe('HeroMatchup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders matchup text with team abbreviations', () => {
    const tree = HeroMatchup(baseProps);
    const joined = collectText(tree).join(' ');
    expect(joined).toContain('TOR');
    expect(joined).toContain('MTL');
  });

  it('renders "TOP EDGE" label', () => {
    const tree = HeroMatchup(baseProps);
    expect(collectText(tree)).toContain('TOP EDGE');
  });

  it('calls onPress when tapped', () => {
    const tree = HeroMatchup(baseProps);
    const pressables = findByType(tree, 'Pressable');
    pressables[0]?.props?.onPress?.();
    expect(baseProps.onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onShare when share button pressed', () => {
    const tree = HeroMatchup(baseProps);
    const pressables = findByType(tree, 'Pressable');
    const shareBtn = pressables[pressables.length - 1];
    shareBtn?.props?.onPress?.();
    expect(baseProps.onShare).toHaveBeenCalledTimes(1);
  });

  it('shows H2H chip when h2hRecord provided', () => {
    const props = { ...baseProps, h2hRecord: { teamAWins: 3, teamBWins: 1, games: [{}] } as any };
    const tree = HeroMatchup(props);
    expect(collectText(tree).join(' ')).toContain('H2H 3-1');
  });

  it('shows game time', () => {
    const tree = HeroMatchup(baseProps);
    const texts = collectText(tree);
    const hasTime = texts.some((t: string) => /\d{1,2}:\d{2}/.test(t) || t === 'TBD');
    expect(hasTime).toBe(true);
  });

  it('renders ConfidenceBadge', () => {
    const tree = HeroMatchup(baseProps);
    const badges = findByType(tree, 'ConfidenceBadge');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows B2B chip when home is back-to-back', () => {
    const props = {
      ...baseProps,
      situationalFactors: {
        homeBackToBack: true,
        awayBackToBack: false,
        homeRestDays: 0,
        awayRestDays: 2,
        restAdvantage: 'away' as const,
      },
    };
    const tree = HeroMatchup(props);
    expect(collectText(tree).join(' ')).toContain('B2B');
  });

  it('shows REST check chip when away is back-to-back', () => {
    const props = {
      ...baseProps,
      situationalFactors: {
        homeBackToBack: false,
        awayBackToBack: true,
        homeRestDays: 2,
        awayRestDays: 0,
        restAdvantage: 'home' as const,
      },
    };
    const tree = HeroMatchup(props);
    const text = collectText(tree).join(' ');
    expect(text).toMatch(/REST/);
  });

  it('does not show B2B or REST chip when neither team is B2B', () => {
    const props = {
      ...baseProps,
      situationalFactors: {
        homeBackToBack: false,
        awayBackToBack: false,
        homeRestDays: 2,
        awayRestDays: 2,
        restAdvantage: 'neutral' as const,
      },
    };
    const tree = HeroMatchup(props);
    const text = collectText(tree).join(' ');
    expect(text).not.toContain('B2B');
  });

  it('shows streak chip for team with 3+ win streak', () => {
    const props = {
      ...baseProps,
      game: {
        ...baseGame,
        awayTeam: { abbrev: 'TOR', streakCode: 'W5' },
        homeTeam: { abbrev: 'MTL' },
      } as any,
    };
    const tree = HeroMatchup(props);
    expect(collectText(tree).join(' ')).toContain('W5');
  });

  it('does NOT show streak chip for win streak < 3', () => {
    const props = {
      ...baseProps,
      game: {
        ...baseGame,
        awayTeam: { abbrev: 'TOR', streakCode: 'W2' },
        homeTeam: { abbrev: 'MTL' },
      } as any,
    };
    const tree = HeroMatchup(props);
    expect(collectText(tree).join(' ')).not.toContain('W2');
  });

  it('does NOT show streak chip for losing streaks', () => {
    const props = {
      ...baseProps,
      game: {
        ...baseGame,
        awayTeam: { abbrev: 'TOR', streakCode: 'L5' },
        homeTeam: { abbrev: 'MTL' },
      } as any,
    };
    const tree = HeroMatchup(props);
    expect(collectText(tree).join(' ')).not.toContain('L5');
  });

  it('shows both probability percentages', () => {
    const props = {
      ...baseProps,
      prediction: { homeWinProb: 62, awayWinProb: 38 },
    };
    const tree = HeroMatchup(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('62');
    expect(text).toContain('38');
  });

  it('shows LIVE for live game', () => {
    const props = {
      ...baseProps,
      game: {
        ...baseGame,
        gameState: 'LIVE',
        period: 2,
        clock: { timeRemaining: '14:22' },
        awayTeam: { abbrev: 'TOR', score: 1 },
        homeTeam: { abbrev: 'MTL', score: 2 },
      } as any,
    };
    const tree = HeroMatchup(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('LIVE');
    expect(text).toContain('1-2');
  });

  it('shows FINAL for completed game', () => {
    const props = {
      ...baseProps,
      game: {
        ...baseGame,
        gameState: 'FINAL',
        awayTeam: { abbrev: 'TOR', score: 3 },
        homeTeam: { abbrev: 'MTL', score: 4 },
      } as any,
    };
    const tree = HeroMatchup(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('FINAL');
    expect(text).toContain('3-4');
  });

  it('renders up to 3 chips maximum', () => {
    const props = {
      ...baseProps,
      h2hRecord: { teamAWins: 3, teamBWins: 1, games: [{}] } as any,
      situationalFactors: {
        homeBackToBack: true,
        awayBackToBack: false,
        homeRestDays: 0,
        awayRestDays: 2,
        restAdvantage: 'away' as const,
      },
      game: {
        ...baseGame,
        awayTeam: { abbrev: 'TOR', streakCode: 'W4' },
        homeTeam: { abbrev: 'MTL' },
      } as any,
    };
    const tree = HeroMatchup(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('H2H');
    expect(text).toContain('B2B');
    expect(text).toContain('W4');
  });

  describe('YOUR TEAM badge (isYourTeam prop)', () => {
    it('renders YOUR TEAM badge when isYourTeam is true', () => {
      const props = { ...baseProps, isYourTeam: true };
      const tree = HeroMatchup(props);
      const text = collectText(tree).join(' ');
      expect(text).toContain('YOUR TEAM');
    });

    it('has testID "your-team-badge" when isYourTeam is true', () => {
      const props = { ...baseProps, isYourTeam: true };
      const tree = HeroMatchup(props);
      const badge = findByTestID(tree, 'your-team-badge');
      expect(badge).not.toBeNull();
    });

    it('does NOT render YOUR TEAM badge when isYourTeam is false', () => {
      const props = { ...baseProps, isYourTeam: false };
      const tree = HeroMatchup(props);
      const text = collectText(tree).join(' ');
      expect(text).not.toContain('YOUR TEAM');
    });

    it('does NOT render YOUR TEAM badge when isYourTeam is undefined', () => {
      const tree = HeroMatchup(baseProps);
      const text = collectText(tree).join(' ');
      expect(text).not.toContain('YOUR TEAM');
    });

    it('does NOT have your-team-badge testID when isYourTeam is false', () => {
      const props = { ...baseProps, isYourTeam: false };
      const tree = HeroMatchup(props);
      const badge = findByTestID(tree, 'your-team-badge');
      expect(badge).toBeNull();
    });
  });

  it('has testID "hero-matchup-card"', () => {
    const tree = HeroMatchup(baseProps);
    const card = findByTestID(tree, 'hero-matchup-card');
    expect(card).not.toBeNull();
  });
});
