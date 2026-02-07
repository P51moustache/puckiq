/**
 * Tests for StatOfTheNight component
 * Verifies null rendering, stat display, testIDs, and label text.
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
  default: { View: 'Animated.View' },
  FadeInUp: { duration: () => ({ delay: () => ({}) }) },
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

import React from 'react';
import type { Insight } from '../../types/insights';

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

  it('shows "STAT OF THE NIGHT" label text', () => {
    const element = StatOfTheNightComponent({ stat: mockStat, onShare: mockOnShare });
    const texts = collectText(element);
    expect(texts).toContain('STAT OF THE NIGHT');
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
    expect(texts).toContain('STAT OF THE NIGHT');
  });
});
