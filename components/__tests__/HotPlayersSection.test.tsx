/**
 * Tests for HotPlayersSection component
 * Verifies extractHotPlayers logic by calling the component directly
 * and inspecting the returned JSX tree.
 */

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  FlatList: 'FlatList',
  StyleSheet: { create: (styles: any) => styles },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  FadeInRight: { duration: () => ({ delay: () => ({}) }) },
}));

// Mock teamColors
jest.mock('../../constants/teamColors', () => ({
  getTeamColors: () => ({ primary: '#FF0000', secondary: '#000000' }),
  getAccessibleTextColor: () => '#FF0000',
}));

import React from 'react';
import HotPlayersSectionComponent from '../HotPlayersSection';
import type { TeamPlayerStats, PlayerStatLine } from '../../types/gameResults';

// Helper to build a PlayerStatLine
function makeSkater(overrides: Partial<PlayerStatLine> & { playerId: number; firstName: string; lastName: string; points: number }): PlayerStatLine {
  return {
    positionCode: 'C',
    gamesPlayed: 20,
    goals: 10,
    assists: 10,
    plusMinus: 5,
    shots: 50,
    shootingPctg: 0.2,
    ...overrides,
  };
}

// Helper to build a game with home/away abbrevs
function makeGame(homeAbbrev: string, awayAbbrev: string) {
  return {
    homeTeam: { abbrev: homeAbbrev },
    awayTeam: { abbrev: awayAbbrev },
  };
}

describe('HotPlayersSection', () => {
  describe('returns null when there are no hot players', () => {
    it('returns null when playerStatsMap is empty', () => {
      const result = HotPlayersSectionComponent({
        playerStatsMap: new Map(),
        games: [makeGame('TOR', 'MTL')],
      });
      expect(result).toBeNull();
    });

    it('returns null when no matching teams in games', () => {
      const statsMap = new Map<string, TeamPlayerStats>();
      statsMap.set('BOS', {
        skaters: [
          makeSkater({ playerId: 1, firstName: 'David', lastName: 'Pastrnak', points: 50 }),
        ],
        goalies: [],
      });

      const result = HotPlayersSectionComponent({
        playerStatsMap: statsMap,
        games: [makeGame('TOR', 'MTL')], // BOS not playing
      });
      expect(result).toBeNull();
    });

    it('returns null when matching team has no skaters', () => {
      const statsMap = new Map<string, TeamPlayerStats>();
      statsMap.set('TOR', {
        skaters: [],
        goalies: [],
      });

      const result = HotPlayersSectionComponent({
        playerStatsMap: statsMap,
        games: [makeGame('TOR', 'MTL')],
      });
      expect(result).toBeNull();
    });
  });

  describe('renders when there are matching players', () => {
    it('renders with testID "hot-players-section"', () => {
      const statsMap = new Map<string, TeamPlayerStats>();
      statsMap.set('TOR', {
        skaters: [
          makeSkater({ playerId: 34, firstName: 'Auston', lastName: 'Matthews', points: 40, goals: 25, assists: 15 }),
        ],
        goalies: [],
      });

      const result = HotPlayersSectionComponent({
        playerStatsMap: statsMap,
        games: [makeGame('TOR', 'MTL')],
      });

      expect(result).not.toBeNull();
      expect(result?.props?.testID).toBe('hot-players-section');
    });

    it('renders header text "HOT PLAYERS TONIGHT"', () => {
      const statsMap = new Map<string, TeamPlayerStats>();
      statsMap.set('TOR', {
        skaters: [
          makeSkater({ playerId: 34, firstName: 'Auston', lastName: 'Matthews', points: 40 }),
        ],
        goalies: [],
      });

      const result = HotPlayersSectionComponent({
        playerStatsMap: statsMap,
        games: [makeGame('TOR', 'MTL')],
      });

      // result is View > [Text, FlatList]
      const children = result?.props?.children;
      const headerText = children[0]; // first child is the Text header
      expect(headerText?.props?.children).toBe('HOT PLAYERS TONIGHT');
    });

    it('passes correct data to FlatList', () => {
      const statsMap = new Map<string, TeamPlayerStats>();
      statsMap.set('TOR', {
        skaters: [
          makeSkater({ playerId: 34, firstName: 'Auston', lastName: 'Matthews', points: 40, goals: 25, assists: 15 }),
          makeSkater({ playerId: 16, firstName: 'Mitch', lastName: 'Marner', points: 35, goals: 12, assists: 23 }),
        ],
        goalies: [],
      });

      const result = HotPlayersSectionComponent({
        playerStatsMap: statsMap,
        games: [makeGame('TOR', 'MTL')],
      });

      const children = result?.props?.children;
      const flatList = children[1]; // second child is FlatList
      const data = flatList?.props?.data;

      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('A.Matthews');
      expect(data[0].points).toBe(40);
      expect(data[1].name).toBe('M.Marner');
      expect(data[1].points).toBe(35);
    });
  });

  describe('limits to 5 players max', () => {
    it('returns at most 5 players even with many teams', () => {
      const statsMap = new Map<string, TeamPlayerStats>();
      const teams = ['TOR', 'MTL', 'BOS', 'NYR'];

      // Each team gets 2 skaters => 8 total candidates, should be capped at 5
      teams.forEach((abbrev, teamIdx) => {
        statsMap.set(abbrev, {
          skaters: [
            makeSkater({
              playerId: teamIdx * 10 + 1,
              firstName: 'Player',
              lastName: `A${teamIdx}`,
              points: 50 - teamIdx * 5,
              goals: 20,
              assists: 30 - teamIdx * 5,
            }),
            makeSkater({
              playerId: teamIdx * 10 + 2,
              firstName: 'Player',
              lastName: `B${teamIdx}`,
              points: 45 - teamIdx * 5,
              goals: 18,
              assists: 27 - teamIdx * 5,
            }),
          ],
          goalies: [],
        });
      });

      const games = [
        makeGame('TOR', 'MTL'),
        makeGame('BOS', 'NYR'),
      ];

      const result = HotPlayersSectionComponent({
        playerStatsMap: statsMap,
        games,
      });

      const children = result?.props?.children;
      const flatList = children[1];
      const data = flatList?.props?.data;

      expect(data).toHaveLength(5);
    });

    it('sorts players by points descending', () => {
      const statsMap = new Map<string, TeamPlayerStats>();
      statsMap.set('TOR', {
        skaters: [
          makeSkater({ playerId: 1, firstName: 'Low', lastName: 'Scorer', points: 10, goals: 3, assists: 7 }),
          makeSkater({ playerId: 2, firstName: 'High', lastName: 'Scorer', points: 60, goals: 30, assists: 30 }),
        ],
        goalies: [],
      });

      const result = HotPlayersSectionComponent({
        playerStatsMap: statsMap,
        games: [makeGame('TOR', 'MTL')],
      });

      const children = result?.props?.children;
      const flatList = children[1];
      const data = flatList?.props?.data;

      expect(data[0].points).toBe(60);
      expect(data[1].points).toBe(10);
    });
  });

  describe('HOT badge logic', () => {
    it('marks player as HOT when goals/GP > 0.5', () => {
      const statsMap = new Map<string, TeamPlayerStats>();
      statsMap.set('TOR', {
        skaters: [
          makeSkater({
            playerId: 34,
            firstName: 'Auston',
            lastName: 'Matthews',
            points: 50,
            goals: 30,
            assists: 20,
            gamesPlayed: 40, // 30/40 = 0.75 > 0.5 => HOT
          }),
        ],
        goalies: [],
      });

      const result = HotPlayersSectionComponent({
        playerStatsMap: statsMap,
        games: [makeGame('TOR', 'MTL')],
      });

      const children = result?.props?.children;
      const flatList = children[1];
      const data = flatList?.props?.data;

      expect(data[0].isHot).toBe(true);
    });

    it('does NOT mark player as HOT when goals/GP <= 0.5', () => {
      const statsMap = new Map<string, TeamPlayerStats>();
      statsMap.set('TOR', {
        skaters: [
          makeSkater({
            playerId: 16,
            firstName: 'Mitch',
            lastName: 'Marner',
            points: 50,
            goals: 10,
            assists: 40,
            gamesPlayed: 40, // 10/40 = 0.25 <= 0.5 => NOT HOT
          }),
        ],
        goalies: [],
      });

      const result = HotPlayersSectionComponent({
        playerStatsMap: statsMap,
        games: [makeGame('TOR', 'MTL')],
      });

      const children = result?.props?.children;
      const flatList = children[1];
      const data = flatList?.props?.data;

      expect(data[0].isHot).toBe(false);
    });

    it('marks boundary case goals/GP = 0.5 as NOT hot', () => {
      const statsMap = new Map<string, TeamPlayerStats>();
      statsMap.set('TOR', {
        skaters: [
          makeSkater({
            playerId: 99,
            firstName: 'Boundary',
            lastName: 'Player',
            points: 30,
            goals: 10,
            assists: 20,
            gamesPlayed: 20, // 10/20 = 0.5, NOT > 0.5 => NOT HOT
          }),
        ],
        goalies: [],
      });

      const result = HotPlayersSectionComponent({
        playerStatsMap: statsMap,
        games: [makeGame('TOR', 'MTL')],
      });

      const children = result?.props?.children;
      const flatList = children[1];
      const data = flatList?.props?.data;

      expect(data[0].isHot).toBe(false);
    });

    it('does NOT mark player as HOT when gamesPlayed is 0', () => {
      const statsMap = new Map<string, TeamPlayerStats>();
      statsMap.set('TOR', {
        skaters: [
          makeSkater({
            playerId: 88,
            firstName: 'Zero',
            lastName: 'Games',
            points: 0,
            goals: 0,
            assists: 0,
            gamesPlayed: 0, // division check: gamesPlayed > 0 fails
          }),
        ],
        goalies: [],
      });

      const result = HotPlayersSectionComponent({
        playerStatsMap: statsMap,
        games: [makeGame('TOR', 'MTL')],
      });

      // The player still appears (they have stats from the map) but isHot should be false
      if (result) {
        const children = result?.props?.children;
        const flatList = children[1];
        const data = flatList?.props?.data;
        if (data?.length > 0) {
          expect(data[0].isHot).toBe(false);
        }
      }
    });
  });

  describe('takes top 2 scorers per team', () => {
    it('only picks top 2 skaters by points from each team', () => {
      const statsMap = new Map<string, TeamPlayerStats>();
      statsMap.set('TOR', {
        skaters: [
          makeSkater({ playerId: 1, firstName: 'First', lastName: 'Place', points: 50 }),
          makeSkater({ playerId: 2, firstName: 'Second', lastName: 'Place', points: 40 }),
          makeSkater({ playerId: 3, firstName: 'Third', lastName: 'Place', points: 30 }),
          makeSkater({ playerId: 4, firstName: 'Fourth', lastName: 'Place', points: 20 }),
        ],
        goalies: [],
      });

      const result = HotPlayersSectionComponent({
        playerStatsMap: statsMap,
        games: [makeGame('TOR', 'MTL')],
      });

      const children = result?.props?.children;
      const flatList = children[1];
      const data = flatList?.props?.data;

      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('F.Place');
      expect(data[1].name).toBe('S.Place');
    });
  });
});
