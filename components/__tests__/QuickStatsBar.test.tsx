/**
 * Tests for QuickStatsBar component
 * Verifies: null when no games, 3 stat pills rendered, correct values, testID
 */

// Mock react-native
import React from 'react';
import QuickStatsBarComponent from '../QuickStatsBar';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: any) => styles },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  FadeIn: { duration: () => ({ delay: () => ({}) }) },
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('QuickStatsBar', () => {
  it('returns null when gameCount is 0', () => {
    const result = QuickStatsBarComponent({ gameCount: 0, closeMatchups: 0, divisionBattles: 0 });
    expect(result).toBeNull();
  });

  it('renders 3 stat pills when gameCount > 0', () => {
    const result = QuickStatsBarComponent({ gameCount: 5, closeMatchups: 2, divisionBattles: 1 });
    const pills = result?.props?.children;
    expect(pills).toHaveLength(3);
  });

  it('displays correct values for games, close matchups, and division battles', () => {
    const result = QuickStatsBarComponent({ gameCount: 8, closeMatchups: 3, divisionBattles: 4 });
    const pills = result?.props?.children;

    // Each pill is: View > [Ionicons, Text(value), Text(label)]
    // Pill 0: Games
    const gamesPill = pills[0];
    const gamesChildren = gamesPill.props.children;
    expect(gamesChildren[1].props.children).toBe('8');
    expect(gamesChildren[2].props.children).toBe('Games');

    // Pill 1: Close
    const closePill = pills[1];
    const closeChildren = closePill.props.children;
    expect(closeChildren[1].props.children).toBe('3');
    expect(closeChildren[2].props.children).toBe('Close');

    // Pill 2: Division
    const divisionPill = pills[2];
    const divisionChildren = divisionPill.props.children;
    expect(divisionChildren[1].props.children).toBe('4');
    expect(divisionChildren[2].props.children).toBe('Division');
  });

  it('has testID "quick-stats-bar"', () => {
    const result = QuickStatsBarComponent({ gameCount: 1, closeMatchups: 0, divisionBattles: 0 });
    expect(result?.props?.testID).toBe('quick-stats-bar');
  });
});
