/**
 * Tests for components/EmptyNightCard.tsx
 * Covers: team-specific content, generic fallback, next game info, standings data
 */

import React from 'react';

import EmptyNightCard from '../EmptyNightCard';

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (s: any) => s },
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

jest.mock('expo-image', () => ({
  Image: 'ExpoImage',
}));

jest.mock('../../constants/theme', () => ({
  theme: {
    card: '#141c2e',
    text: '#ffffff',
    subtext: '#94a3b8',
  },
}));

jest.mock('../../constants/teamColors', () => ({
  getTeamColors: (abbrev: string) => ({
    primary: '#005DAA',
    secondary: '#FFFFFF',
  }),
  getAccessibleTextColor: () => '#4488cc',
}));

// Helpers
function collectText(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (node.props?.children) return collectText(node.props.children);
  return [];
}

const mockStandings = {
  standings: [
    {
      teamAbbrev: { default: 'TOR' },
      teamName: { default: 'Toronto Maple Leafs' },
      divisionName: 'Atlantic',
      conferenceName: 'Eastern',
      points: 69,
      divisionSequence: 2,
      wins: 32,
      losses: 18,
      otLosses: 5,
    },
    {
      teamAbbrev: { default: 'BOS' },
      teamName: { default: 'Boston Bruins' },
      divisionName: 'Atlantic',
      conferenceName: 'Eastern',
      points: 64,
      divisionSequence: 3,
      wins: 29,
      losses: 20,
      otLosses: 6,
    },
    {
      teamAbbrev: { default: 'FLA' },
      teamName: { default: 'Florida Panthers' },
      divisionName: 'Atlantic',
      conferenceName: 'Eastern',
      points: 71,
      divisionSequence: 1,
      wins: 33,
      losses: 16,
      otLosses: 5,
    },
  ],
};

describe('EmptyNightCard', () => {
  describe('generic content (no selectedTeam)', () => {
    it('shows "No Games Today" title', () => {
      const element = EmptyNightCard({});
      const text = collectText(element);
      expect(text).toContain('No Games Today');
    });

    it('shows "Schedule resumes shortly." subtitle', () => {
      const element = EmptyNightCard({});
      const text = collectText(element).join(' ');
      expect(text).toContain('Schedule resumes shortly.');
    });

    it('renders without crashing when all props are undefined', () => {
      const element = EmptyNightCard({
        selectedTeam: undefined,
        standings: undefined,
        nextGame: undefined,
      });
      expect(element).not.toBeNull();
    });

    it('renders without crashing when selectedTeam is null', () => {
      const element = EmptyNightCard({
        selectedTeam: null,
        standings: null,
        nextGame: null,
      });
      expect(element).not.toBeNull();
      const text = collectText(element);
      expect(text).toContain('No Games Today');
    });
  });

  describe('team-specific content (selectedTeam set)', () => {
    it('shows team name from standings', () => {
      const element = EmptyNightCard({
        selectedTeam: 'TOR',
        standings: mockStandings,
      });
      const text = collectText(element).join(' ');
      expect(text).toContain('Toronto Maple Leafs');
    });

    it('shows division position with ordinal', () => {
      const element = EmptyNightCard({
        selectedTeam: 'TOR',
        standings: mockStandings,
      });
      const text = collectText(element).join(' ');
      expect(text).toContain('2nd');
      expect(text).toContain('Atlantic');
    });

    it('shows points and record', () => {
      const element = EmptyNightCard({
        selectedTeam: 'TOR',
        standings: mockStandings,
      });
      const text = collectText(element).join(' ');
      expect(text).toContain('69');
      expect(text).toContain('32-18-5');
    });

    it('shows "No games today" note', () => {
      const element = EmptyNightCard({
        selectedTeam: 'TOR',
        standings: mockStandings,
      });
      const text = collectText(element).join(' ');
      expect(text.toLowerCase()).toContain('no games today');
    });

    it('falls back to selectedTeam abbrev when teamName is missing', () => {
      const standingsNoName = {
        standings: [
          {
            teamAbbrev: { default: 'TOR' },
            divisionName: 'Atlantic',
            points: 69,
            divisionSequence: 2,
            wins: 32,
            losses: 18,
            otLosses: 5,
          },
        ],
      };
      const element = EmptyNightCard({
        selectedTeam: 'TOR',
        standings: standingsNoName,
      });
      const text = collectText(element).join(' ');
      // Should use 'TOR' as fallback team name
      expect(text).toContain('TOR');
    });
  });

  describe('next game info', () => {
    it('shows next game section when nextGame is provided (personalized)', () => {
      const element = EmptyNightCard({
        selectedTeam: 'TOR',
        standings: mockStandings,
        nextGame: { opponent: 'MTL', date: 'Feb 8', time: '7:00 PM' },
      });
      const text = collectText(element).join(' ');
      expect(text).toContain('NEXT GAME');
      expect(text).toContain('MTL');
      expect(text).toContain('Feb 8');
      expect(text).toContain('7:00 PM');
    });

    it('does not show next game section when nextGame is null', () => {
      const element = EmptyNightCard({
        selectedTeam: 'TOR',
        standings: mockStandings,
        nextGame: null,
      });
      const text = collectText(element).join(' ');
      expect(text).not.toContain('NEXT GAME');
    });
  });

  describe('fun stat', () => {
    it('shows league leader stat when standings available', () => {
      const element = EmptyNightCard({
        standings: mockStandings,
      });
      const text = collectText(element).join(' ');
      // FLA has 71 pts (highest), should appear as fun stat
      expect(text).toContain('FLA');
      expect(text).toContain('71');
      expect(text).toContain('pts');
    });

    it('does not show fun stat when no standings', () => {
      const element = EmptyNightCard({});
      const text = collectText(element).join(' ');
      expect(text).not.toContain('leads the league');
    });
  });

  describe('standings with string teamAbbrev', () => {
    it('handles string teamAbbrev (non-nested)', () => {
      const stringStandings = {
        standings: [
          {
            teamAbbrev: 'TOR',
            teamName: { default: 'Toronto Maple Leafs' },
            divisionName: 'Atlantic',
            points: 69,
            divisionSequence: 2,
            wins: 32,
            losses: 18,
            otLosses: 5,
          },
        ],
      };
      const element = EmptyNightCard({
        selectedTeam: 'TOR',
        standings: stringStandings as any,
      });
      const text = collectText(element).join(' ');
      expect(text).toContain('Toronto Maple Leafs');
    });
  });

  describe('ordinal formatting', () => {
    it('formats 1st correctly', () => {
      const standings = {
        standings: [{
          teamAbbrev: { default: 'TOR' },
          teamName: { default: 'Toronto' },
          divisionName: 'Atlantic',
          points: 70,
          divisionSequence: 1,
          wins: 32, losses: 18, otLosses: 5,
        }],
      };
      const element = EmptyNightCard({ selectedTeam: 'TOR', standings });
      const text = collectText(element).join(' ');
      expect(text).toContain('1st');
    });

    it('formats 3rd correctly', () => {
      const standings = {
        standings: [{
          teamAbbrev: { default: 'TOR' },
          teamName: { default: 'Toronto' },
          divisionName: 'Atlantic',
          points: 60,
          divisionSequence: 3,
          wins: 28, losses: 22, otLosses: 5,
        }],
      };
      const element = EmptyNightCard({ selectedTeam: 'TOR', standings });
      const text = collectText(element).join(' ');
      expect(text).toContain('3rd');
    });
  });
});
