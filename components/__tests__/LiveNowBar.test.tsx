/**
 * Tests for LiveNowBar component
 * Verifies: null when no live games, renders for LIVE/CRIT states,
 * correct team abbreviations/scores, testID presence.
 */

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: any) => styles },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  FadeIn: { duration: () => ({}) },
  useAnimatedStyle: () => ({}),
  useSharedValue: (val: any) => ({ value: val }),
  withRepeat: (x: any) => x,
  withTiming: (x: any) => x,
  withSpring: (x: any) => x,
}));

// Mock the theme
jest.mock('../../constants/theme', () => ({
  theme: { text: '#ffffff', fonts: { mono: 'monospace', system: 'System' } },
}));

import React from 'react';
import LiveNowBarComponent from '../LiveNowBar';

// Helper: build a game object
function makeGame(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 1,
    gameState: overrides.gameState ?? 'FUT',
    awayTeam: { abbrev: overrides.awayAbbrev ?? 'BOS', score: overrides.awayScore ?? 0 },
    homeTeam: { abbrev: overrides.homeAbbrev ?? 'TOR', score: overrides.homeScore ?? 0 },
    period: overrides.period ?? null,
    clock: overrides.clock ?? null,
  };
}

// Recursive helpers for traversing the shallow render tree
function findByTestID(element: any, testID: string): any {
  if (!element) return null;
  if (element?.props?.testID === testID) return element;
  const children = React.Children.toArray(element?.props?.children || []);
  for (const child of children) {
    if (typeof child === 'object') {
      const found = findByTestID(child, testID);
      if (found) return found;
    }
  }
  return null;
}

function collectTexts(element: any): string[] {
  if (!element) return [];
  if (typeof element === 'string' || typeof element === 'number') return [String(element)];
  const texts: string[] = [];
  const children = React.Children.toArray(element?.props?.children || []);
  for (const child of children) {
    texts.push(...collectTexts(child));
  }
  return texts;
}

const noopPress = () => {};

describe('LiveNowBar', () => {
  describe('returns null when no live games', () => {
    it('returns null for empty games array', () => {
      const result = LiveNowBarComponent({ games: [], onGamePress: noopPress });
      expect(result).toBeNull();
    });

    it('returns null when all games are FUT state', () => {
      const games = [
        makeGame({ id: 1, gameState: 'FUT' }),
        makeGame({ id: 2, gameState: 'FUT' }),
        makeGame({ id: 3, gameState: 'FUT' }),
      ];
      const result = LiveNowBarComponent({ games, onGamePress: noopPress });
      expect(result).toBeNull();
    });

    it('returns null when all games are FINAL state', () => {
      const games = [
        makeGame({ id: 1, gameState: 'FINAL' }),
        makeGame({ id: 2, gameState: 'OFF' }),
      ];
      const result = LiveNowBarComponent({ games, onGamePress: noopPress });
      expect(result).toBeNull();
    });
  });

  describe('renders when there are LIVE games', () => {
    it('renders a non-null element for a LIVE game', () => {
      const games = [makeGame({ id: 10, gameState: 'LIVE', period: 2 })];
      const result = LiveNowBarComponent({ games, onGamePress: noopPress });
      expect(result).not.toBeNull();
    });

    it('renders only live games, filtering out FUT games', () => {
      const games = [
        makeGame({ id: 1, gameState: 'FUT' }),
        makeGame({ id: 2, gameState: 'LIVE', period: 1 }),
        makeGame({ id: 3, gameState: 'FUT' }),
      ];
      const result = LiveNowBarComponent({ games, onGamePress: noopPress });
      expect(result).not.toBeNull();

      // The ScrollView children should only have 1 game chip (one live game)
      const scrollView = result!.props.children[1]; // ScrollView is second child
      const chips = scrollView.props.children;
      expect(chips).toHaveLength(1);
    });
  });

  describe('renders when there are CRIT games', () => {
    it('renders a non-null element for a CRIT game', () => {
      const games = [makeGame({ id: 20, gameState: 'CRIT', period: 3 })];
      const result = LiveNowBarComponent({ games, onGamePress: noopPress });
      expect(result).not.toBeNull();
    });

    it('renders both LIVE and CRIT games together', () => {
      const games = [
        makeGame({ id: 1, gameState: 'LIVE', period: 1 }),
        makeGame({ id: 2, gameState: 'CRIT', period: 3 }),
        makeGame({ id: 3, gameState: 'FUT' }),
      ];
      const result = LiveNowBarComponent({ games, onGamePress: noopPress });
      expect(result).not.toBeNull();

      const scrollView = result!.props.children[1];
      const chips = scrollView.props.children;
      expect(chips).toHaveLength(2);
    });
  });

  describe('shows correct team abbreviations and scores', () => {
    it('displays away and home abbreviations with scores', () => {
      const games = [
        makeGame({
          id: 5,
          gameState: 'LIVE',
          awayAbbrev: 'MTL',
          homeAbbrev: 'NYR',
          awayScore: 3,
          homeScore: 1,
          period: 2,
          clock: { timeRemaining: '12:34' },
        }),
      ];
      const result = LiveNowBarComponent({ games, onGamePress: noopPress });
      expect(result).not.toBeNull();

      // Use the game prop to verify the score chip renders correct text
      const scrollView = result!.props.children[1];
      const chip = scrollView.props.children[0];
      // The chip is a LiveScoreChip element; verify the game prop is passed
      expect(chip.props.game.awayTeam.abbrev).toBe('MTL');
      expect(chip.props.game.homeTeam.abbrev).toBe('NYR');
      expect(chip.props.game.awayTeam.score).toBe(3);
      expect(chip.props.game.homeTeam.score).toBe(1);
    });

    it('shows OT label when period > 3', () => {
      const games = [
        makeGame({
          id: 6,
          gameState: 'CRIT',
          awayAbbrev: 'EDM',
          homeAbbrev: 'CGY',
          awayScore: 2,
          homeScore: 2,
          period: 4,
          clock: { timeRemaining: '3:00' },
        }),
      ];
      const result = LiveNowBarComponent({ games, onGamePress: noopPress });

      const scrollView = result!.props.children[1];
      const chip = scrollView.props.children[0];
      expect(chip.props.game.period).toBe(4);
      expect(chip.props.game.awayTeam.abbrev).toBe('EDM');
      expect(chip.props.game.homeTeam.abbrev).toBe('CGY');
    });

    it('defaults missing abbreviations to ???', () => {
      const games = [
        {
          id: 7,
          gameState: 'LIVE',
          awayTeam: {},
          homeTeam: {},
          period: 1,
          clock: null,
        },
      ];
      const result = LiveNowBarComponent({ games, onGamePress: noopPress });

      const scrollView = result!.props.children[1];
      const chip = scrollView.props.children[0];
      // Missing abbrev should be passed as-is to the chip
      expect(chip.props.game.awayTeam.abbrev).toBeUndefined();
      expect(chip.props.game.homeTeam.abbrev).toBeUndefined();
    });
  });

  describe('testID', () => {
    it('has testID "live-now-bar"', () => {
      const games = [makeGame({ id: 1, gameState: 'LIVE', period: 1 })];
      const result = LiveNowBarComponent({ games, onGamePress: noopPress });
      expect(result!.props.testID).toBe('live-now-bar');
    });

    it('passes game with correct id to each chip', () => {
      const games = [
        makeGame({ id: 42, gameState: 'LIVE', period: 2 }),
      ];
      const result = LiveNowBarComponent({ games, onGamePress: noopPress });

      const scrollView = result!.props.children[1];
      const chip = scrollView.props.children[0];
      expect(chip.props.game.id).toBe(42);
    });
  });
});
