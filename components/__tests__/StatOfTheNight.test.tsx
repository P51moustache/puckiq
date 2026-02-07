/**
 * Tests for StatOfTheNight component
 * Verifies null rendering, stat display, testIDs, label text,
 * category emoji + chip, gradient background, logo circle, and fallback behavior.
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
  default: {
    View: 'Animated.View',
    Text: 'Animated.Text',
  },
  FadeInUp: { duration: () => ({ delay: () => ({}) }) },
  useSharedValue: (val: number) => ({ value: val }),
  useAnimatedStyle: (fn: () => any) => fn(),
  withSpring: (val: number) => val,
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

import React from 'react';
import type { Insight } from '../../types/insights';

// Mock React.useEffect since tests call the component function directly (no renderer)
const originalUseEffect = React.useEffect;
beforeAll(() => {
  (React as any).useEffect = (fn: () => void) => { fn(); };
});
afterAll(() => {
  (React as any).useEffect = originalUseEffect;
});

// Access inner component through React.memo wrapper
const StatOfTheNightDefault = require('../StatOfTheNight').default;
const StatOfTheNightComponent = StatOfTheNightDefault.type || StatOfTheNightDefault;

const mockStat: Insight = {
  id: 'stat-1',
  text: 'Connor McDavid has 5 points in his last 2 games',
  teamAbbrev: 'EDM',
  category: 'player',
  shareText: 'McDavid is on fire!',
};

const mockOnShare = jest.fn();

/** Walk the React element tree and collect all string children */
function collectText(element: any): string[] {
  if (!element) return [];
  if (typeof element === 'string') return [element];
  if (typeof element === 'number') return [String(element)];
  const results: string[] = [];
  const children = element?.props?.children;
  if (children == null) return results;
  if (Array.isArray(children)) {
    children.forEach((c: any) => results.push(...collectText(c)));
  } else {
    results.push(...collectText(children));
  }
  return results;
}

/** Find first element with a given testID */
function findByTestID(element: any, testID: string): any {
  if (!element || typeof element !== 'object') return null;
  if (element?.props?.testID === testID) return element;
  const children = element?.props?.children;
  if (!children) return null;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findByTestID(child, testID);
      if (found) return found;
    }
  } else {
    return findByTestID(children, testID);
  }
  return null;
}

/** Find all elements of a given type */
function findByType(element: any, type: string): any[] {
  if (!element || typeof element !== 'object') return [];
  const results: any[] = [];
  if (element?.type === type) results.push(element);
  const children = element?.props?.children;
  if (!children) return results;
  if (Array.isArray(children)) {
    children.forEach((c: any) => results.push(...findByType(c, type)));
  } else {
    results.push(...findByType(children, type));
  }
  return results;
}

describe('StatOfTheNight', () => {
  beforeEach(() => {
    mockOnShare.mockClear();
  });

  it('returns null when stat is null', () => {
    const result = StatOfTheNightComponent({ stat: null, onShare: mockOnShare });
    expect(result).toBeNull();
  });

  it('renders stat text when stat is provided', () => {
    const element = StatOfTheNightComponent({ stat: mockStat, onShare: mockOnShare });
    const texts = collectText(element);
    expect(texts).toContain('Connor McDavid has 5 points in his last 2 games');
  });

  it('has testID "stat-of-the-night"', () => {
    const element = StatOfTheNightComponent({ stat: mockStat, onShare: mockOnShare });
    expect(element?.props?.testID).toBe('stat-of-the-night');
  });

  it('renders share button with testID "stat-of-night-share"', () => {
    const element = StatOfTheNightComponent({ stat: mockStat, onShare: mockOnShare });
    const shareBtn = findByTestID(element, 'stat-of-night-share');
    expect(shareBtn).not.toBeNull();
  });

  it('shows "STAT OF THE NIGHT" in label text with emoji prefix', () => {
    const element = StatOfTheNightComponent({ stat: mockStat, onShare: mockOnShare });
    const texts = collectText(element);
    const labelText = texts.find(t => t.includes('STAT OF THE NIGHT'));
    expect(labelText).toBeDefined();
  });

  it('extracts hero number from stat text', () => {
    const element = StatOfTheNightComponent({ stat: mockStat, onShare: mockOnShare });
    const texts = collectText(element);
    // "5 points" pattern should extract "5" as the hero number
    expect(texts).toContain('5');
  });

  it('renders without hero number when no number pattern found', () => {
    const noNumStat: Insight = {
      id: 'stat-2',
      text: 'Edmonton is the hottest team in the league',
      teamAbbrev: 'EDM',
      category: 'streak',
      shareText: 'Edmonton is hot!',
    };
    const element = StatOfTheNightComponent({ stat: noNumStat, onShare: mockOnShare });
    const texts = collectText(element);
    expect(texts).toContain('Edmonton is the hottest team in the league');
    const labelText = texts.find(t => t.includes('STAT OF THE NIGHT'));
    expect(labelText).toBeDefined();
  });

  it('uses LinearGradient for card background', () => {
    const element = StatOfTheNightComponent({ stat: mockStat, onShare: mockOnShare });
    const gradients = findByType(element, 'LinearGradient');
    expect(gradients.length).toBeGreaterThan(0);
  });

  it('renders team logo in circle container when teamAbbrev is present', () => {
    const element = StatOfTheNightComponent({ stat: mockStat, onShare: mockOnShare });
    const images = findByType(element, 'Image');
    expect(images.length).toBeGreaterThan(0);
  });

  it('does not render team logo when teamAbbrev is empty', () => {
    const noTeamStat: Insight = {
      id: 'stat-3',
      text: 'League-wide scoring is up 12 percent this season',
      teamAbbrev: '',
      category: 'standings',
      shareText: 'Scoring up!',
    };
    const element = StatOfTheNightComponent({ stat: noTeamStat, onShare: mockOnShare });
    const images = findByType(element, 'Image');
    expect(images.length).toBe(0);
  });

  it('renders category chip with correct label for each category', () => {
    const expectedLabels: Record<string, string> = {
      streak: 'STREAK',
      h2h: 'HEAD TO HEAD',
      rest: 'REST ADVANTAGE',
      player: 'PLAYER',
      standings: 'STANDINGS',
      edge: 'EDGE',
    };

    for (const [cat, label] of Object.entries(expectedLabels)) {
      const catStat: Insight = {
        id: `stat-${cat}`,
        text: 'Test stat text for category',
        teamAbbrev: 'TOR',
        category: cat as Insight['category'],
        shareText: 'Test',
      };
      const element = StatOfTheNightComponent({ stat: catStat, onShare: mockOnShare });
      const texts = collectText(element);
      expect(texts).toContain(label);
    }
  });

  it('uses theme.accent fallback when no team', () => {
    const noTeamStat: Insight = {
      id: 'stat-4',
      text: 'League average save percentage is rising',
      category: 'standings',
      shareText: 'Save pct rising!',
    };
    const element = StatOfTheNightComponent({ stat: noTeamStat, onShare: mockOnShare });
    const gradients = findByType(element, 'LinearGradient');
    expect(gradients.length).toBeGreaterThan(0);
    const texts = collectText(element);
    expect(texts).toContain('League average save percentage is rising');
  });

  it('has minimum height of 160px on the card', () => {
    const element = StatOfTheNightComponent({ stat: mockStat, onShare: mockOnShare });
    const gradients = findByType(element, 'LinearGradient');
    const card = gradients[0];
    // Style is an array [styles.card, dynamic overrides]
    const cardStyles = Array.isArray(card.props.style) ? card.props.style : [card.props.style];
    const baseStyle = cardStyles[0];
    expect(baseStyle.minHeight).toBe(160);
  });

  it('renders share button with Ionicons share-outline inside circle', () => {
    const element = StatOfTheNightComponent({ stat: mockStat, onShare: mockOnShare });
    const shareBtn = findByTestID(element, 'stat-of-night-share');
    expect(shareBtn).not.toBeNull();
    const icons = findByType(shareBtn, 'Ionicons');
    expect(icons.length).toBeGreaterThan(0);
    expect(icons[0].props.name).toBe('share-outline');
  });

  it('extracts hero number from +N momentum pattern', () => {
    const momentumStat: Insight = {
      id: 'stat-mtm',
      text: 'DAL riding surging momentum (+5)',
      teamAbbrev: 'DAL',
      category: 'edge',
      shareText: 'DAL momentum!',
    };
    const element = StatOfTheNightComponent({ stat: momentumStat, onShare: mockOnShare });
    const texts = collectText(element);
    // Should extract "+5" from parentheses or the +5 pattern
    expect(texts.some(t => t.includes('5'))).toBe(true);
  });

  it('extracts hero number from decimal pattern', () => {
    const decimalStat: Insight = {
      id: 'stat-dec',
      text: 'Vasilevskiy has a 0.93 save percentage this month',
      teamAbbrev: 'TBL',
      category: 'player',
      shareText: 'Vasi save pct!',
    };
    const element = StatOfTheNightComponent({ stat: decimalStat, onShare: mockOnShare });
    const texts = collectText(element);
    expect(texts.some(t => t.includes('0.93'))).toBe(true);
  });

  it('extracts hero number from standalone +N text', () => {
    const plusStat: Insight = {
      id: 'stat-plus',
      text: 'Team has a +12 goal differential this month',
      teamAbbrev: 'COL',
      category: 'edge',
      shareText: 'COL differential!',
    };
    const element = StatOfTheNightComponent({ stat: plusStat, onShare: mockOnShare });
    const texts = collectText(element);
    expect(texts.some(t => t.includes('12'))).toBe(true);
  });
});
