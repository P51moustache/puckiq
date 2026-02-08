/**
 * Tests for recent form calculations
 */

import {
  fetchTeamRecentGames,
  calculateRecentForm,
} from '../recentForm';
import type { RecentGame, RecentFormStats } from '../../types/predictions';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase');

describe('recentForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchTeamRecentGames', () => {
    it('should fetch and parse recent games correctly from Supabase', async () => {
      const mockRows = [
        {
          id: 1,
          game_date: '2024-11-15',
          game_state: 'FINAL',
          home_team_abbrev: 'TOR',
          away_team_abbrev: 'MTL',
          home_score: 4,
          away_score: 2,
        },
        {
          id: 2,
          game_date: '2024-11-13',
          game_state: 'FINAL',
          home_team_abbrev: 'OTT',
          away_team_abbrev: 'TOR',
          home_score: 3,
          away_score: 5,
        },
        {
          id: 3,
          game_date: '2024-11-12',
          game_state: 'FINAL',
          home_team_abbrev: 'TOR',
          away_team_abbrev: 'BOS',
          home_score: 2,
          away_score: 3,
        },
      ];

      // Override the default mock to return our test data
      const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: mockRows, error: null }).then(resolve),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockBuilder);

      const games = await fetchTeamRecentGames('TOR', 10);

      expect(supabase.from).toHaveBeenCalledWith('games');
      expect(games).toHaveLength(3);
      expect(games[0]).toEqual({
        id: 1,
        gameDate: '2024-11-15',
        isHomeGame: true,
        opponent: 'MTL',
        goalsFor: 4,
        goalsAgainst: 2,
        won: true,
      });
    });

    it('should handle away games correctly', async () => {
      const mockRows = [
        {
          id: 2,
          game_date: '2024-11-13',
          game_state: 'FINAL',
          home_team_abbrev: 'OTT',
          away_team_abbrev: 'TOR',
          home_score: 3,
          away_score: 5,
        },
      ];

      const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: mockRows, error: null }).then(resolve),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockBuilder);

      const games = await fetchTeamRecentGames('TOR', 10);

      const awayGame = games[0];
      expect(awayGame.isHomeGame).toBe(false);
      expect(awayGame.opponent).toBe('OTT');
      expect(awayGame.goalsFor).toBe(5);
      expect(awayGame.goalsAgainst).toBe(3);
      expect(awayGame.won).toBe(true);
    });

    it('should return empty array on Supabase error', async () => {
      const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: (resolve: any) => Promise.resolve({ data: null, error: { message: 'Query failed' } }).then(resolve),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockBuilder);

      const games = await fetchTeamRecentGames('TOR', 10);

      expect(games).toEqual([]);
    });

    it('should return empty array on exception', async () => {
      (supabase.from as jest.Mock).mockImplementation(() => {
        throw new Error('Connection error');
      });

      const games = await fetchTeamRecentGames('TOR', 10);

      expect(games).toEqual([]);
    });
  });

  describe('calculateRecentForm', () => {
    // Note: calculateRecentForm now uses recency weighting
    // Most recent game (index 0) = weight 1.0
    // Second game (index 1) = weight 0.85
    // Third game (index 2) = weight 0.72
    // etc.

    it('should calculate stats correctly for winning team with recency weighting', () => {
      const games: RecentGame[] = [
        {
          id: 1,
          gameDate: '2024-11-15',
          isHomeGame: true,
          opponent: 'MTL',
          goalsFor: 4,
          goalsAgainst: 2,
          won: true, // weight 1.0
        },
        {
          id: 2,
          gameDate: '2024-11-13',
          isHomeGame: false,
          opponent: 'OTT',
          goalsFor: 5,
          goalsAgainst: 3,
          won: true, // weight 0.85
        },
        {
          id: 3,
          gameDate: '2024-11-12',
          isHomeGame: true,
          opponent: 'BOS',
          goalsFor: 2,
          goalsAgainst: 3,
          won: false, // weight 0.72
        },
      ];

      const stats = calculateRecentForm(games);

      // Raw wins/losses are still counted normally for display
      expect(stats.wins).toBe(2);
      expect(stats.losses).toBe(1);
      expect(stats.gamesPlayed).toBe(3);

      // Weighted pointPctg: (1*1 + 1*0.85 + 0*0.72) / (1+0.85+0.72) = 1.85/2.57 ~ 0.719
      expect(stats.pointPctg).toBe(0.719);

      // Weighted goalDiff: (2*1) + (2*0.85) + (-1*0.72) = 2 + 1.7 - 0.72 = 2.98 -> 3.0
      expect(stats.goalDifferential).toBe(3);
    });

    it('should handle empty games array', () => {
      const stats = calculateRecentForm([]);

      expect(stats).toEqual({
        wins: 0,
        losses: 0,
        pointPctg: 0.5,
        goalDifferential: 0,
        gamesPlayed: 0,
      });
    });

    it('should calculate point percentage with recency weighting', () => {
      const games: RecentGame[] = [
        { id: 1, gameDate: '2024-11-15', isHomeGame: true, opponent: 'MTL', goalsFor: 3, goalsAgainst: 2, won: true },  // w=1.0
        { id: 2, gameDate: '2024-11-14', isHomeGame: true, opponent: 'OTT', goalsFor: 1, goalsAgainst: 4, won: false }, // w=0.85
        { id: 3, gameDate: '2024-11-13', isHomeGame: true, opponent: 'BOS', goalsFor: 2, goalsAgainst: 5, won: false }, // w=0.72
        { id: 4, gameDate: '2024-11-12', isHomeGame: true, opponent: 'NYR', goalsFor: 4, goalsAgainst: 3, won: true },  // w=0.61
        { id: 5, gameDate: '2024-11-11', isHomeGame: true, opponent: 'WSH', goalsFor: 2, goalsAgainst: 1, won: true },  // w=0.52
      ];

      const stats = calculateRecentForm(games);

      expect(stats.wins).toBe(3);
      expect(stats.losses).toBe(2);
      // Weighted: (1 + 0 + 0 + 0.61 + 0.52) / (1 + 0.85 + 0.72 + 0.61 + 0.52) = 2.13/3.7 ~ 0.576
      expect(stats.pointPctg).toBe(0.576);
      expect(stats.gamesPlayed).toBe(5);
    });

    it('should calculate goal differential with recency weighting', () => {
      const games: RecentGame[] = [
        { id: 1, gameDate: '2024-11-15', isHomeGame: true, opponent: 'MTL', goalsFor: 6, goalsAgainst: 1, won: true },  // +5 * 1.0 = 5.0
        { id: 2, gameDate: '2024-11-14', isHomeGame: true, opponent: 'OTT', goalsFor: 2, goalsAgainst: 7, won: false }, // -5 * 0.85 = -4.25
      ];

      const stats = calculateRecentForm(games);

      // Weighted goal diff: 5*1.0 + (-5)*0.85 = 5 - 4.25 = 0.75 -> rounds to 0.8
      expect(stats.goalDifferential).toBe(0.8);
    });

    it('should round point percentage to 3 decimal places', () => {
      // With recency weighting, test a simple 1-game case for exact result
      const games: RecentGame[] = [
        { id: 1, gameDate: '2024-11-15', isHomeGame: true, opponent: 'MTL', goalsFor: 3, goalsAgainst: 2, won: true },
      ];

      const stats = calculateRecentForm(games);

      // Single game with weight 1.0: 1/1 = 1.0
      expect(stats.pointPctg).toBe(1);
    });

    it('should weight recent games more heavily than older games', () => {
      // Two scenarios: recent win vs recent loss with same raw W/L record
      // This tests that recency weighting actually changes outcomes

      // Scenario 1: Recent win, older loss
      const recentWin: RecentGame[] = [
        { id: 1, gameDate: '2024-11-15', isHomeGame: true, opponent: 'MTL', goalsFor: 3, goalsAgainst: 2, won: true },  // w=1.0
        { id: 2, gameDate: '2024-11-14', isHomeGame: true, opponent: 'OTT', goalsFor: 1, goalsAgainst: 4, won: false }, // w=0.85
      ];

      // Scenario 2: Recent loss, older win
      const recentLoss: RecentGame[] = [
        { id: 1, gameDate: '2024-11-15', isHomeGame: true, opponent: 'MTL', goalsFor: 1, goalsAgainst: 4, won: false }, // w=1.0
        { id: 2, gameDate: '2024-11-14', isHomeGame: true, opponent: 'OTT', goalsFor: 3, goalsAgainst: 2, won: true },  // w=0.85
      ];

      const statsRecentWin = calculateRecentForm(recentWin);
      const statsRecentLoss = calculateRecentForm(recentLoss);

      // Both have 1-1 raw record, but weighted should differ
      expect(statsRecentWin.wins).toBe(1);
      expect(statsRecentLoss.wins).toBe(1);

      // Weighted pointPctg should favor the team with the recent win
      // recentWin: 1.0 / 1.85 ~ 0.541
      // recentLoss: 0.85 / 1.85 ~ 0.459
      expect(statsRecentWin.pointPctg).toBeGreaterThan(statsRecentLoss.pointPctg);
      expect(statsRecentWin.pointPctg).toBe(0.541);
      expect(statsRecentLoss.pointPctg).toBe(0.459);
    });
  });
});
