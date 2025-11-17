/**
 * Tests for situational factors (back-to-back games, rest days)
 */

import {
  isBackToBack,
  calculateRestDays,
  calculateSituationalFactors,
} from '../situationalFactors';
import type { RecentGame, SituationalFactors } from '../../types/predictions';

describe('situationalFactors', () => {
  describe('isBackToBack', () => {
    const recentGames: RecentGame[] = [
      {
        id: 1,
        gameDate: '2024-11-15',
        isHomeGame: true,
        opponent: 'MTL',
        goalsFor: 4,
        goalsAgainst: 2,
        won: true,
      },
      {
        id: 2,
        gameDate: '2024-11-14',
        isHomeGame: false,
        opponent: 'OTT',
        goalsFor: 5,
        goalsAgainst: 3,
        won: true,
      },
      {
        id: 3,
        gameDate: '2024-11-12',
        isHomeGame: true,
        opponent: 'BOS',
        goalsFor: 2,
        goalsAgainst: 3,
        won: false,
      },
    ];

    it('should detect back-to-back game (game yesterday)', () => {
      const result = isBackToBack(recentGames, '2024-11-16');
      expect(result).toBe(true);
    });

    it('should return false when last game was 2 days ago', () => {
      const result = isBackToBack(recentGames, '2024-11-17');
      expect(result).toBe(false);
    });

    it('should return false when no recent games', () => {
      const result = isBackToBack([], '2024-11-16');
      expect(result).toBe(false);
    });

    it('should detect back-to-back correctly with consecutive games', () => {
      const consecutiveGames: RecentGame[] = [
        {
          id: 1,
          gameDate: '2024-11-15',
          isHomeGame: true,
          opponent: 'MTL',
          goalsFor: 4,
          goalsAgainst: 2,
          won: true,
        },
      ];

      expect(isBackToBack(consecutiveGames, '2024-11-16')).toBe(true);
    });

    it('should handle same-day game (edge case)', () => {
      const result = isBackToBack(recentGames, '2024-11-15');
      expect(result).toBe(false); // Same day doesn't count as B2B
    });
  });

  describe('calculateRestDays', () => {
    it('should calculate 1 rest day correctly', () => {
      const games: RecentGame[] = [
        {
          id: 1,
          gameDate: '2024-11-13',
          isHomeGame: true,
          opponent: 'MTL',
          goalsFor: 4,
          goalsAgainst: 2,
          won: true,
        },
      ];

      const restDays = calculateRestDays(games, '2024-11-15');
      expect(restDays).toBe(1); // Nov 13 -> Nov 15 = 1 day of rest (Nov 14)
    });

    it('should calculate 0 rest days for back-to-back', () => {
      const games: RecentGame[] = [
        {
          id: 1,
          gameDate: '2024-11-14',
          isHomeGame: true,
          opponent: 'MTL',
          goalsFor: 4,
          goalsAgainst: 2,
          won: true,
        },
      ];

      const restDays = calculateRestDays(games, '2024-11-15');
      expect(restDays).toBe(0);
    });

    it('should calculate multiple rest days', () => {
      const games: RecentGame[] = [
        {
          id: 1,
          gameDate: '2024-11-10',
          isHomeGame: true,
          opponent: 'MTL',
          goalsFor: 4,
          goalsAgainst: 2,
          won: true,
        },
      ];

      const restDays = calculateRestDays(games, '2024-11-15');
      expect(restDays).toBe(4); // Nov 10 -> Nov 15 = 4 days of rest
    });

    it('should return 0 when no recent games', () => {
      const restDays = calculateRestDays([], '2024-11-15');
      expect(restDays).toBe(0);
    });

    it('should handle games in the future (should not happen)', () => {
      const games: RecentGame[] = [
        {
          id: 1,
          gameDate: '2024-11-20',
          isHomeGame: true,
          opponent: 'MTL',
          goalsFor: 4,
          goalsAgainst: 2,
          won: true,
        },
      ];

      const restDays = calculateRestDays(games, '2024-11-15');
      expect(restDays).toBe(0); // Future game, return 0
    });
  });

  describe('calculateSituationalFactors', () => {
    const homeGames: RecentGame[] = [
      {
        id: 1,
        gameDate: '2024-11-13',
        isHomeGame: true,
        opponent: 'MTL',
        goalsFor: 4,
        goalsAgainst: 2,
        won: true,
      },
    ];

    const awayGames: RecentGame[] = [
      {
        id: 2,
        gameDate: '2024-11-14',
        isHomeGame: false,
        opponent: 'BOS',
        goalsFor: 3,
        goalsAgainst: 2,
        won: true,
      },
    ];

    it('should detect back-to-back for away team only', () => {
      const factors = calculateSituationalFactors('2024-11-15', homeGames, awayGames);

      expect(factors.homeBackToBack).toBe(false);
      expect(factors.awayBackToBack).toBe(true);
      expect(factors.homeRestDays).toBe(1);
      expect(factors.awayRestDays).toBe(0);
      expect(factors.restAdvantage).toBe('home');
    });

    it('should detect back-to-back for both teams', () => {
      const bothB2BGames: RecentGame[] = [
        {
          id: 1,
          gameDate: '2024-11-14',
          isHomeGame: true,
          opponent: 'MTL',
          goalsFor: 4,
          goalsAgainst: 2,
          won: true,
        },
      ];

      const factors = calculateSituationalFactors('2024-11-15', bothB2BGames, bothB2BGames);

      expect(factors.homeBackToBack).toBe(true);
      expect(factors.awayBackToBack).toBe(true);
      expect(factors.restAdvantage).toBe('neutral');
    });

    it('should detect neutral rest advantage when rest days equal', () => {
      const homeGamesEven: RecentGame[] = [
        { id: 1, gameDate: '2024-11-12', isHomeGame: true, opponent: 'MTL', goalsFor: 4, goalsAgainst: 2, won: true },
      ];

      const awayGamesEven: RecentGame[] = [
        { id: 2, gameDate: '2024-11-12', isHomeGame: false, opponent: 'BOS', goalsFor: 3, goalsAgainst: 2, won: true },
      ];

      const factors = calculateSituationalFactors('2024-11-15', homeGamesEven, awayGamesEven);

      expect(factors.homeRestDays).toBe(2);
      expect(factors.awayRestDays).toBe(2);
      expect(factors.restAdvantage).toBe('neutral');
    });

    it('should detect away rest advantage', () => {
      const homeGamesRecent: RecentGame[] = [
        { id: 1, gameDate: '2024-11-14', isHomeGame: true, opponent: 'MTL', goalsFor: 4, goalsAgainst: 2, won: true },
      ];

      const awayGamesOld: RecentGame[] = [
        { id: 2, gameDate: '2024-11-10', isHomeGame: false, opponent: 'BOS', goalsFor: 3, goalsAgainst: 2, won: true },
      ];

      const factors = calculateSituationalFactors('2024-11-15', homeGamesRecent, awayGamesOld);

      expect(factors.homeRestDays).toBe(0);
      expect(factors.awayRestDays).toBe(4);
      expect(factors.restAdvantage).toBe('away');
    });

    it('should handle empty game arrays', () => {
      const factors = calculateSituationalFactors('2024-11-15', [], []);

      expect(factors.homeBackToBack).toBe(false);
      expect(factors.awayBackToBack).toBe(false);
      expect(factors.homeRestDays).toBe(0);
      expect(factors.awayRestDays).toBe(0);
      expect(factors.restAdvantage).toBe('neutral');
    });
  });
});
