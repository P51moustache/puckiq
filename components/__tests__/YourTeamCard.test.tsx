/**
 * Tests for components/YourTeamCard.tsx
 * Covers: rendering, team colors/logo, YOUR TEAM badge, prediction, tappable, missing data
 */

import React from 'react';

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: ({ children, ...props }: any) =>
      React.createElement('AnimatedView', props, children),
    createAnimatedComponent: (c: any) => c,
  },
  FadeInUp: { duration: () => ({}) },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('expo-image', () => ({
  Image: 'ExpoImage',
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('../../constants/theme', () => ({
  theme: {
    background: '#0a0f1a',
    card: '#141c2e',
    text: '#ffffff',
    subtext: '#94a3b8',
    fonts: { mono: 'monospace', system: 'System' },
    glass: { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', borderBright: 'rgba(255,255,255,0.25)', blur: 60 },
    elevation: { low: {}, medium: {}, high: {}, glow: {} },
    semantic: { positive: '#10b981', negative: '#ef4444', neutral: '#fbbf24', info: '#60a5fa' },
    animation: { spring: { damping: 15, stiffness: 150 }, entryDuration: 400, staggerDelay: 80, flashDuration: 600 },
  },
}));

jest.mock('../../constants/teamColors', () => ({
  getTeamColors: (abbrev: string) => ({
    primary: abbrev === 'TOR' ? '#005DAA' : '#FFB81C',
    secondary: '#FFFFFF',
  }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../ConfidenceBadge', () => ({
  ConfidenceBadge: ({ confidence, size }: any) =>
    React.createElement('ConfidenceBadge', { confidence, size }),
}));

import YourTeamCard from '../YourTeamCard';

// Helpers
function collectText(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (node.props?.children) return collectText(node.props.children);
  return [];
}

function findByTestID(node: any, testID: string): any {
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

function findByType(node: any, type: string): any[] {
  const results: any[] = [];
  if (!node) return results;
  if (node.type === type || node.type?.name === type) results.push(node);
  if (Array.isArray(node)) {
    for (const child of node) results.push(...findByType(child, type));
  }
  if (node.props?.children) results.push(...findByType(node.props.children, type));
  return results;
}

const defaultGame = {
  id: 2025020801,
  gameState: 'FUT',
  startTimeUTC: '2026-02-07T00:00:00Z',
  homeTeam: { abbrev: 'BOS', score: undefined },
  awayTeam: { abbrev: 'TOR', score: undefined },
};

const defaultPrediction = { homeWinProb: 45, awayWinProb: 55 };
const defaultOnPress = jest.fn();

describe('YourTeamCard', () => {
  beforeEach(() => {
    defaultOnPress.mockClear();
  });

  describe('renders with correct team content', () => {
    it('renders team abbreviations', () => {
      const element = YourTeamCard({
        game: defaultGame,
        prediction: defaultPrediction,
        selectedTeam: 'TOR',
        confidenceScore: 65,
        onPress: defaultOnPress,
      });
      const text = collectText(element);
      expect(text).toContain('TOR');
      expect(text).toContain('BOS');
    });

    it('shows "YOUR TEAM" badge text', () => {
      const element = YourTeamCard({
        game: defaultGame,
        prediction: defaultPrediction,
        selectedTeam: 'TOR',
        confidenceScore: 65,
        onPress: defaultOnPress,
      });
      const text = collectText(element);
      expect(text).toContain('YOUR TEAM');
    });

    it('has testID "your-team-card"', () => {
      const element = YourTeamCard({
        game: defaultGame,
        prediction: defaultPrediction,
        selectedTeam: 'TOR',
        confidenceScore: 65,
        onPress: defaultOnPress,
      });
      const pressable = findByTestID(element, 'your-team-card');
      expect(pressable).not.toBeNull();
    });
  });

  describe('prediction and confidence display', () => {
    it('shows prediction percentage', () => {
      const element = YourTeamCard({
        game: defaultGame,
        prediction: { homeWinProb: 40, awayWinProb: 60 },
        selectedTeam: 'TOR',
        confidenceScore: 70,
        onPress: defaultOnPress,
      });
      const text = collectText(element).join(' ');
      // Text nodes may be split — check for the number
      expect(text).toContain('60');
    });

    it('shows team abbreviation and win probability in prediction text', () => {
      // TOR is away with 55%
      const element = YourTeamCard({
        game: defaultGame,
        prediction: defaultPrediction,
        selectedTeam: 'TOR',
        confidenceScore: 65,
        onPress: defaultOnPress,
      });
      const text = collectText(element).join(' ');
      expect(text).toContain('TOR');
      expect(text).toContain('55');
    });

    it('renders ConfidenceBadge with correct confidence', () => {
      const element = YourTeamCard({
        game: defaultGame,
        prediction: defaultPrediction,
        selectedTeam: 'TOR',
        confidenceScore: 72,
        onPress: defaultOnPress,
      });
      const badges = findByType(element, 'ConfidenceBadge');
      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0].props.confidence).toBe(72);
    });
  });

  describe('tappable behavior', () => {
    it('renders as a Pressable', () => {
      const element = YourTeamCard({
        game: defaultGame,
        prediction: defaultPrediction,
        selectedTeam: 'TOR',
        confidenceScore: 65,
        onPress: defaultOnPress,
      });
      const pressables = findByType(element, 'Pressable');
      expect(pressables.length).toBeGreaterThan(0);
    });

    it('calls onPress when Pressable is pressed', () => {
      const element = YourTeamCard({
        game: defaultGame,
        prediction: defaultPrediction,
        selectedTeam: 'TOR',
        confidenceScore: 65,
        onPress: defaultOnPress,
      });
      const pressable = findByTestID(element, 'your-team-card');
      expect(pressable?.props?.onPress).toBeDefined();
      // Call the wrapped onPress and verify it triggers the original callback
      pressable.props.onPress();
      expect(defaultOnPress).toHaveBeenCalled();
    });
  });

  describe('handles missing data gracefully', () => {
    it('returns null when no game and no nextGame', () => {
      const element = YourTeamCard({
        game: null,
        prediction: defaultPrediction,
        selectedTeam: 'TOR',
        confidenceScore: 65,
        onPress: defaultOnPress,
      });
      expect(element).toBeNull();
    });

    it('shows next game info when no game but nextGame provided', () => {
      const element = YourTeamCard({
        game: null,
        prediction: defaultPrediction,
        selectedTeam: 'TOR',
        confidenceScore: 65,
        onPress: defaultOnPress,
        nextGame: { opponent: 'MTL', date: 'Feb 8', time: '7:00 PM' },
      });
      expect(element).not.toBeNull();
      const text = collectText(element).join(' ');
      expect(text).toContain('MTL');
      expect(text).toContain('Feb 8');
      expect(text).toContain('7:00 PM');
    });

    it('handles game with missing team abbrevs', () => {
      const brokenGame = {
        id: 1,
        gameState: 'FUT',
        startTimeUTC: '2026-02-07T00:00:00Z',
        homeTeam: {},
        awayTeam: {},
      };
      const element = YourTeamCard({
        game: brokenGame,
        prediction: defaultPrediction,
        selectedTeam: 'TOR',
        confidenceScore: 65,
        onPress: defaultOnPress,
      });
      // Should render without crashing, using ??? fallbacks
      const text = collectText(element).join(' ');
      expect(text).toContain('???');
    });
  });

  describe('game state display', () => {
    it('shows LIVE status for live games', () => {
      const liveGame = {
        ...defaultGame,
        gameState: 'LIVE',
        period: 2,
        clock: { timeRemaining: '08:34' },
        homeTeam: { abbrev: 'BOS', score: 2 },
        awayTeam: { abbrev: 'TOR', score: 1 },
      };
      const element = YourTeamCard({
        game: liveGame,
        prediction: defaultPrediction,
        selectedTeam: 'TOR',
        confidenceScore: 65,
        onPress: defaultOnPress,
      });
      const text = collectText(element).join(' ');
      expect(text).toContain('LIVE');
      expect(text).toContain('P2');
    });

    it('shows FINAL score for finished games', () => {
      const finalGame = {
        ...defaultGame,
        gameState: 'FINAL',
        homeTeam: { abbrev: 'BOS', score: 3 },
        awayTeam: { abbrev: 'TOR', score: 4 },
      };
      const element = YourTeamCard({
        game: finalGame,
        prediction: defaultPrediction,
        selectedTeam: 'TOR',
        confidenceScore: 65,
        onPress: defaultOnPress,
      });
      const text = collectText(element).join(' ');
      expect(text).toContain('FINAL');
    });
  });
});
