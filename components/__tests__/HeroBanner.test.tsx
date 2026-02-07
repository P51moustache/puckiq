import React from 'react';

// Mock useState/useMemo to work outside React render context
jest.spyOn(React, 'useState').mockImplementation(((init: any) => [init, jest.fn()]) as any);
jest.spyOn(React, 'useMemo').mockImplementation((fn: () => any) => fn());

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: any) => s, absoluteFill: {}, absoluteFillObject: {} },
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: 'Animated.View',
    createAnimatedComponent: (c: any) => c,
  },
  FadeIn: { duration: () => ({ delay: () => ({}) }) },
  FadeInDown: { duration: () => ({ delay: () => ({}) }) },
  FadeInUp: { duration: () => ({ delay: () => ({}) }) },
  useSharedValue: (v: any) => ({ value: v }),
  useAnimatedStyle: (fn: () => any) => fn(),
  withSpring: (v: any) => v,
  withTiming: (v: any) => v,
}));

jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../ConfidenceBadge', () => ({
  ConfidenceBadge: 'ConfidenceBadge',
}));
jest.mock('../SettingsButton', () => ({
  SettingsButton: 'SettingsButton',
}));
jest.mock('../../hooks/useHaptics', () => ({
  useHaptics: () => ({ press: jest.fn(), success: jest.fn(), error: jest.fn() }),
}));
jest.mock('../../utils/teamLogo', () => ({
  getTeamLogoUrl: (abbrev: string) => `https://logo/${abbrev}.svg`,
}));
jest.mock('../../constants/teamColors', () => ({
  getTeamColors: () => ({ primary: '#000000', secondary: '#ffffff' }),
}));

import HeroBanner from '../HeroBanner';

// ─── Helpers ───

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
  if (Array.isArray(node)) {
    node.forEach((n: any) => results.push(...findByType(n, typeName)));
    return results;
  }
  if (node.type === typeName || (typeof node.type === 'function' && node.type.name === typeName)) {
    results.push(node);
  }
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

function findAllPressables(node: any): any[] {
  return findByType(node, 'Pressable');
}

// ─── Fixtures ───

const baseGame = {
  id: 1,
  gameState: 'FUT',
  startTimeUTC: '2026-02-07T00:00:00Z',
  awayTeam: { abbrev: 'TOR' },
  homeTeam: { abbrev: 'MTL' },
};

const baseProps = {
  game: baseGame as any,
  prediction: { homeWinProb: 55, awayWinProb: 45 },
  confidenceScore: 72,
  h2hRecord: null as any,
  situationalFactors: null as any,
  headline: 'Toronto has won 3 straight against Montreal',
  onPress: jest.fn(),
  onShare: jest.fn(),
};

// ─── Tests ───

describe('HeroBanner', () => {
  beforeEach(() => jest.clearAllMocks());

  // 1. Renders PuckIQ wordmark text
  it('renders PuckIQ wordmark text', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    expect(text).toContain('PuckIQ');
  });

  // 2. Renders tagline
  it('renders tagline "YOUR EDGE BEFORE EVERY PICK"', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    expect(text).toContain('YOUR EDGE BEFORE EVERY PICK');
  });

  // 3. Renders team logos for both teams
  it('renders team logos for away and home teams', () => {
    const tree = HeroBanner(baseProps);
    const images = findByType(tree, 'Image');
    // Should have at least 3 images: background + away logo + home logo
    expect(images.length).toBeGreaterThanOrEqual(3);
    // Check that team logo URLs are present
    const logoSources = images
      .map((img: any) => img.props?.source?.uri)
      .filter(Boolean);
    expect(logoSources).toContain('https://logo/TOR.svg');
    expect(logoSources).toContain('https://logo/MTL.svg');
  });

  // 4. Renders probability numbers matching prediction prop
  it('renders probability numbers matching prediction prop', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    expect(text).toContain('45');
    expect(text).toContain('55');
  });

  it('renders correct probability numbers for different values', () => {
    const props = {
      ...baseProps,
      prediction: { homeWinProb: 62, awayWinProb: 38 },
    };
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('62');
    expect(text).toContain('38');
  });

  // 5. Renders confidence badge
  it('renders ConfidenceBadge', () => {
    const tree = HeroBanner(baseProps);
    const badges = findByType(tree, 'ConfidenceBadge');
    expect(badges.length).toBeGreaterThanOrEqual(1);
    expect(badges[0].props.confidence).toBe(72);
  });

  // 6. Renders insight chips when data provided
  it('renders H2H chip when h2hRecord provided', () => {
    const props = {
      ...baseProps,
      h2hRecord: { teamAWins: 3, teamBWins: 1, games: [{}] } as any,
    };
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('H2H 3-1');
  });

  it('renders B2B chip when home team is back-to-back', () => {
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
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('B2B');
  });

  it('renders REST chip when away team is back-to-back', () => {
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
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).toMatch(/REST/);
  });

  it('renders streak chip for team with 3+ win streak', () => {
    const props = {
      ...baseProps,
      game: {
        ...baseGame,
        awayTeam: { abbrev: 'TOR', streakCode: 'W5' },
        homeTeam: { abbrev: 'MTL' },
      } as any,
    };
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('W5');
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
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('H2H');
    expect(text).toContain('B2B');
    expect(text).toContain('W4');
  });

  // 7. Renders tonight's headline text
  it('renders headline text', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    expect(text).toContain('Toronto has won 3 straight against Montreal');
  });

  // 8. Renders date text
  it('renders date text', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    // Date format: "Wednesday, Feb 7" or similar locale output
    // Just verify some date-like text exists (month name or day name)
    const hasDate = text.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
    expect(hasDate).not.toBeNull();
  });

  // 9. Calls onPress when hero zone is tapped
  it('calls onPress when hero zone is tapped', () => {
    const tree = HeroBanner(baseProps);
    const pressables = findAllPressables(tree);
    // The outer Pressable is the main tap target
    const mainPressable = pressables[0];
    mainPressable?.props?.onPress?.();
    expect(baseProps.onPress).toHaveBeenCalledTimes(1);
  });

  // 10. Calls onShare when share button is pressed
  it('calls onShare when share button is pressed', () => {
    const tree = HeroBanner(baseProps);
    const pressables = findAllPressables(tree);
    // The share button is the inner Pressable (last one)
    const shareBtn = pressables[pressables.length - 1];
    shareBtn?.props?.onPress?.();
    expect(baseProps.onShare).toHaveBeenCalledTimes(1);
  });

  // 11. Shows YOUR TEAM badge when isYourTeam=true
  it('shows YOUR TEAM badge when isYourTeam is true', () => {
    const props = { ...baseProps, isYourTeam: true };
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('YOUR TEAM');
  });

  it('does NOT show YOUR TEAM badge when isYourTeam is false', () => {
    const props = { ...baseProps, isYourTeam: false };
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).not.toContain('YOUR TEAM');
  });

  it('does NOT show YOUR TEAM badge when isYourTeam is undefined', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    expect(text).not.toContain('YOUR TEAM');
  });

  // 12. Handles missing h2hRecord gracefully
  it('does not render H2H chip when h2hRecord is null', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    expect(text).not.toContain('H2H');
  });

  it('does not render H2H chip when h2hRecord has empty games', () => {
    const props = {
      ...baseProps,
      h2hRecord: { teamAWins: 0, teamBWins: 0, games: [] } as any,
    };
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).not.toContain('H2H');
  });

  // 13. Handles missing situationalFactors gracefully
  it('does not render B2B or REST chip when situationalFactors is null', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    expect(text).not.toContain('B2B');
    expect(text).not.toMatch(/REST \u2713/);
  });

  it('does not render B2B chip when neither team is B2B', () => {
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
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).not.toContain('B2B');
  });

  // 14. Renders game time correctly for pre-game state
  it('renders game time for pre-game (FUT) state', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    // Should show time like "7:00 PM" or "TBD"
    const hasTime = text.match(/\d{1,2}:\d{2}/) || text.includes('TBD');
    expect(hasTime).toBeTruthy();
  });

  it('shows TBD when no startTimeUTC', () => {
    const props = {
      ...baseProps,
      game: { ...baseGame, startTimeUTC: undefined } as any,
    };
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('TBD');
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
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('FINAL');
    expect(text).toContain('3-4');
  });

  // 15. Renders LIVE indicator for live games
  it('renders LIVE indicator for live games', () => {
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
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('LIVE');
    expect(text).toContain('1-2');
    expect(text).toContain('P2');
  });

  it('renders LIVE indicator for CRIT state', () => {
    const props = {
      ...baseProps,
      game: {
        ...baseGame,
        gameState: 'CRIT',
        period: 3,
        clock: { timeRemaining: '2:30' },
        awayTeam: { abbrev: 'TOR', score: 2 },
        homeTeam: { abbrev: 'MTL', score: 2 },
      } as any,
    };
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('LIVE');
  });

  // Additional coverage: testID, TOP EDGE label, team abbreviations
  it('has testID "hero-banner"', () => {
    const tree = HeroBanner(baseProps);
    const banner = findByTestID(tree, 'hero-banner');
    expect(banner).not.toBeNull();
  });

  it('renders TOP EDGE label', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    expect(text).toContain('TOP EDGE');
  });

  it('renders team abbreviations', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    expect(text).toContain('TOR');
    expect(text).toContain('MTL');
  });

  it('renders VS divider', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    expect(text).toContain('VS');
  });

  it('does not show streak chip for win streak < 3', () => {
    const props = {
      ...baseProps,
      game: {
        ...baseGame,
        awayTeam: { abbrev: 'TOR', streakCode: 'W2' },
        homeTeam: { abbrev: 'MTL' },
      } as any,
    };
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).not.toContain('W2');
  });

  it('does not show streak chip for losing streaks', () => {
    const props = {
      ...baseProps,
      game: {
        ...baseGame,
        awayTeam: { abbrev: 'TOR', streakCode: 'L5' },
        homeTeam: { abbrev: 'MTL' },
      } as any,
    };
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).not.toContain('L5');
  });

  it('handles OT period display', () => {
    const props = {
      ...baseProps,
      game: {
        ...baseGame,
        gameState: 'LIVE',
        period: 4,
        clock: { timeRemaining: '3:15' },
        awayTeam: { abbrev: 'TOR', score: 3 },
        homeTeam: { abbrev: 'MTL', score: 3 },
      } as any,
    };
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    expect(text).toContain('OT');
  });

  it('renders SettingsButton', () => {
    const tree = HeroBanner(baseProps);
    const settingsBtns = findByType(tree, 'SettingsButton');
    expect(settingsBtns.length).toBe(1);
  });

  it('renders probability with percent sign', () => {
    const tree = HeroBanner(baseProps);
    const text = collectText(tree).join(' ');
    // Percent sign may be a separate text node: "45 %" vs "45%"
    expect(text).toMatch(/45\s*%/);
    expect(text).toMatch(/55\s*%/);
  });

  it('handles missing team abbreviations gracefully', () => {
    const props = {
      ...baseProps,
      game: {
        ...baseGame,
        awayTeam: {},
        homeTeam: {},
      } as any,
    };
    const tree = HeroBanner(props);
    const text = collectText(tree).join(' ');
    // Falls back to '???'
    expect(text).toContain('???');
  });
});
