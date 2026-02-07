/**
 * Tests for devData/sampleGames.ts
 * Validates sample game data structure and content integrity.
 */

import {
  sampleGamesResponse,
  type SampleGame,
  type SampleTeam,
  type SampleGamesResponse,
} from '../sampleGames';

const VALID_GAME_STATES: SampleGame['gameState'][] = ['FUT', 'LIVE', 'FINAL', 'OFF'];

describe('sampleGames', () => {
  describe('response shape', () => {
    it('exports sampleGamesResponse with a games array', () => {
      expect(sampleGamesResponse).toBeDefined();
      expect(sampleGamesResponse).toHaveProperty('games');
      expect(Array.isArray(sampleGamesResponse.games)).toBe(true);
    });

    it('contains exactly 6 games', () => {
      expect(sampleGamesResponse.games).toHaveLength(6);
    });
  });

  describe('each game has required fields', () => {
    it.each(sampleGamesResponse.games.map((g, i) => [i, g]))(
      'game[%i] has all required fields',
      (_index, game) => {
        const g = game as SampleGame;
        expect(typeof g.id).toBe('number');
        expect(typeof g.season).toBe('number');
        expect(typeof g.gameType).toBe('number');
        expect(typeof g.gameDate).toBe('string');
        expect(typeof g.startTimeUTC).toBe('string');
        expect(VALID_GAME_STATES).toContain(g.gameState);
        expect(g.homeTeam).toBeDefined();
        expect(g.awayTeam).toBeDefined();
      },
    );
  });

  describe('team structure', () => {
    it.each(sampleGamesResponse.games.map((g, i) => [i, g]))(
      'game[%i] homeTeam and awayTeam have id and abbrev',
      (_index, game) => {
        const g = game as SampleGame;
        expect(typeof g.homeTeam.id).toBe('number');
        expect(typeof g.homeTeam.abbrev).toBe('string');
        expect(g.homeTeam.abbrev.length).toBe(3);

        expect(typeof g.awayTeam.id).toBe('number');
        expect(typeof g.awayTeam.abbrev).toBe('string');
        expect(g.awayTeam.abbrev.length).toBe(3);
      },
    );

    it('no game has the same team on both sides', () => {
      sampleGamesResponse.games.forEach((g) => {
        expect(g.homeTeam.abbrev).not.toBe(g.awayTeam.abbrev);
      });
    });
  });

  describe('game states are valid', () => {
    it('all gameState values are one of FUT, LIVE, FINAL, OFF', () => {
      sampleGamesResponse.games.forEach((g) => {
        expect(VALID_GAME_STATES).toContain(g.gameState);
      });
    });

    it('contains at least one FUT game', () => {
      const futGames = sampleGamesResponse.games.filter((g) => g.gameState === 'FUT');
      expect(futGames.length).toBeGreaterThan(0);
    });

    it('contains at least one LIVE game', () => {
      const liveGames = sampleGamesResponse.games.filter((g) => g.gameState === 'LIVE');
      expect(liveGames.length).toBeGreaterThan(0);
    });

    it('contains at least one FINAL game', () => {
      const finalGames = sampleGamesResponse.games.filter((g) => g.gameState === 'FINAL');
      expect(finalGames.length).toBeGreaterThan(0);
    });
  });

  describe('LIVE games have scores and period info', () => {
    const liveGames = sampleGamesResponse.games.filter((g) => g.gameState === 'LIVE');

    it.each(liveGames.map((g, i) => [i, g]))(
      'LIVE game[%i] has scores for both teams',
      (_index, game) => {
        const g = game as SampleGame;
        expect(typeof g.homeTeam.score).toBe('number');
        expect(typeof g.awayTeam.score).toBe('number');
      },
    );

    it.each(liveGames.map((g, i) => [i, g]))(
      'LIVE game[%i] has period and clock',
      (_index, game) => {
        const g = game as SampleGame;
        expect(typeof g.period).toBe('number');
        expect(g.period).toBeGreaterThanOrEqual(1);
        expect(g.clock).toBeDefined();
        expect(typeof g.clock!.timeRemaining).toBe('string');
      },
    );
  });

  describe('FINAL games have scores', () => {
    const finalGames = sampleGamesResponse.games.filter((g) => g.gameState === 'FINAL');

    it.each(finalGames.map((g, i) => [i, g]))(
      'FINAL game[%i] has scores for both teams',
      (_index, game) => {
        const g = game as SampleGame;
        expect(typeof g.homeTeam.score).toBe('number');
        expect(typeof g.awayTeam.score).toBe('number');
      },
    );
  });

  describe('FUT games do not have scores', () => {
    const futGames = sampleGamesResponse.games.filter((g) => g.gameState === 'FUT');

    it.each(futGames.map((g, i) => [i, g]))(
      'FUT game[%i] does not have scores',
      (_index, game) => {
        const g = game as SampleGame;
        expect(g.homeTeam.score).toBeUndefined();
        expect(g.awayTeam.score).toBeUndefined();
      },
    );
  });

  describe('game IDs are unique', () => {
    it('all game IDs are distinct', () => {
      const ids = sampleGamesResponse.games.map((g) => g.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('date format', () => {
    it('gameDate matches YYYY-MM-DD format', () => {
      sampleGamesResponse.games.forEach((g) => {
        expect(g.gameDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('startTimeUTC contains a T and ends with Z', () => {
      sampleGamesResponse.games.forEach((g) => {
        expect(g.startTimeUTC).toContain('T');
        expect(g.startTimeUTC).toMatch(/Z$/);
      });
    });
  });

  describe('season and gameType', () => {
    it('all games are regular season (gameType 2)', () => {
      sampleGamesResponse.games.forEach((g) => {
        expect(g.gameType).toBe(2);
      });
    });

    it('all games have a valid season number', () => {
      sampleGamesResponse.games.forEach((g) => {
        expect(g.season).toBe(20252026);
      });
    });
  });

  describe('team abbreviations are valid 3-letter NHL codes', () => {
    const VALID_ABBREVS = [
      'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET',
      'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT',
      'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK',
      'WPG', 'WSH',
    ];

    it('all team abbreviations are recognized NHL team codes', () => {
      sampleGamesResponse.games.forEach((g) => {
        expect(VALID_ABBREVS).toContain(g.homeTeam.abbrev);
        expect(VALID_ABBREVS).toContain(g.awayTeam.abbrev);
      });
    });
  });
});
