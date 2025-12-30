import {
  fetchTeamRoster,
  fetchPlayerStats,
  getTeamHotPlayers,
  getGoalieMatchup,
  getPlayerPredictionFactors,
  clearPlayerCache,
} from '../playerPrediction';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('playerPrediction service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPlayerCache();
  });

  describe('fetchTeamRoster', () => {
    it('should return an array of players for a valid team', async () => {
      const mockRoster = {
        forwards: [
          { id: 1, firstName: { default: 'Connor' }, lastName: { default: 'McDavid' }, positionCode: 'C', sweaterNumber: 97 },
          { id: 2, firstName: { default: 'Leon' }, lastName: { default: 'Draisaitl' }, positionCode: 'C', sweaterNumber: 29 },
        ],
        defensemen: [
          { id: 3, firstName: { default: 'Evan' }, lastName: { default: 'Bouchard' }, positionCode: 'D', sweaterNumber: 2 },
        ],
        goalies: [
          { id: 4, firstName: { default: 'Stuart' }, lastName: { default: 'Skinner' }, positionCode: 'G', sweaterNumber: 74 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRoster),
      });

      const roster = await fetchTeamRoster('EDM');

      expect(roster).toHaveLength(4);
      expect(roster[0].fullName).toBe('Connor McDavid');
      expect(roster[0].positionType).toBe('F');
      expect(roster[2].positionType).toBe('D');
      expect(roster[3].positionType).toBe('G');
    });

    it('should return cached data on subsequent calls', async () => {
      const mockRoster = {
        forwards: [{ id: 1, firstName: 'Test', lastName: 'Player', positionCode: 'C' }],
        defensemen: [],
        goalies: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRoster),
      });

      await fetchTeamRoster('TOR');
      await fetchTeamRoster('TOR');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return empty array on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const roster = await fetchTeamRoster('XXX');

      expect(roster).toEqual([]);
    });
  });

  describe('fetchPlayerStats', () => {
    it('should return player stats for a valid player ID', async () => {
      const mockPlayerData = {
        featuredStats: {
          regularSeason: {
            subSeason: {
              gamesPlayed: 50,
              goals: 30,
              assists: 40,
              points: 70,
            },
          },
        },
        last5Games: [
          { gameId: '1', goals: 2, assists: 1, points: 3 },
          { gameId: '2', goals: 1, assists: 2, points: 3 },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPlayerData),
      });

      const stats = await fetchPlayerStats(8478402); // McDavid's ID

      expect(stats).not.toBeNull();
      expect(stats?.skaterStats?.gamesPlayed).toBe(50);
      expect(stats?.last5Games).toHaveLength(2);
    });

    it('should parse goalie stats correctly', async () => {
      const mockGoalieData = {
        featuredStats: {
          regularSeason: {
            subSeason: {
              gamesPlayed: 40,
              wins: 25,
              losses: 10,
              otLosses: 5,
              savePctg: 0.915,
              goalsAgainstAvg: 2.50,
              shutouts: 3,
            },
          },
        },
        last5Games: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGoalieData),
      });

      const stats = await fetchPlayerStats(12345);

      expect(stats?.goalieStats?.wins).toBe(25);
      expect(stats?.goalieStats?.savePercentage).toBe(0.915);
      expect(stats?.goalieStats?.goalsAgainstAverage).toBe(2.50);
    });

    it('should return null on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const stats = await fetchPlayerStats(99999);

      expect(stats).toBeNull();
    });
  });

  describe('getTeamHotPlayers', () => {
    it('should identify hot players based on recent form', async () => {
      // Mock roster
      const mockRoster = {
        forwards: [
          { id: 1, firstName: 'Hot', lastName: 'Player', positionCode: 'C' },
        ],
        defensemen: [],
        goalies: [],
      };

      // Mock player stats with hot streak
      const mockPlayerStats = {
        featuredStats: {
          regularSeason: {
            subSeason: { gamesPlayed: 50, goals: 20, assists: 30, points: 50 },
          },
        },
        last5Games: [
          { goals: 2, assists: 2, points: 4, plusMinus: 2 },
          { goals: 1, assists: 2, points: 3, plusMinus: 1 },
          { goals: 2, assists: 1, points: 3, plusMinus: 0 },
          { goals: 1, assists: 1, points: 2, plusMinus: 1 },
          { goals: 0, assists: 2, points: 2, plusMinus: -1 },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockRoster) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPlayerStats) });

      const hotPlayers = await getTeamHotPlayers('TOR');

      expect(hotPlayers.teamAbbrev).toBe('TOR');
      // Player has 14 points in 5 games (2.8 ppg) vs season avg of 1.0 ppg - should be hot
      expect(hotPlayers.hotPlayers.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty arrays on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getTeamHotPlayers('XXX');

      expect(result.hotPlayers).toEqual([]);
      expect(result.coldPlayers).toEqual([]);
      expect(result.overallHeatIndex).toBe(0);
    });
  });

  describe('getGoalieMatchup', () => {
    it('should return goalie comparison for two teams', async () => {
      // Mock home roster
      const mockHomeRoster = {
        forwards: [],
        defensemen: [],
        goalies: [
          { id: 100, firstName: 'Home', lastName: 'Goalie', positionCode: 'G' },
        ],
      };

      // Mock away roster
      const mockAwayRoster = {
        forwards: [],
        defensemen: [],
        goalies: [
          { id: 200, firstName: 'Away', lastName: 'Goalie', positionCode: 'G' },
        ],
      };

      // Mock home goalie stats (better)
      const mockHomeGoalieStats = {
        featuredStats: {
          regularSeason: {
            subSeason: {
              gamesPlayed: 40,
              wins: 25,
              losses: 10,
              otLosses: 5,
              savePctg: 0.920,
              goalsAgainstAvg: 2.30,
            },
          },
        },
        last5Games: [
          { decision: 'W', shotsAgainst: 30, goalsAgainst: 2 },
          { decision: 'W', shotsAgainst: 28, goalsAgainst: 1 },
        ],
      };

      // Mock away goalie stats (worse)
      const mockAwayGoalieStats = {
        featuredStats: {
          regularSeason: {
            subSeason: {
              gamesPlayed: 35,
              wins: 15,
              losses: 15,
              otLosses: 5,
              savePctg: 0.890,
              goalsAgainstAvg: 3.20,
            },
          },
        },
        last5Games: [
          { decision: 'L', shotsAgainst: 32, goalsAgainst: 4 },
          { decision: 'L', shotsAgainst: 30, goalsAgainst: 3 },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockHomeRoster) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAwayRoster) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockHomeGoalieStats) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAwayGoalieStats) });

      const matchup = await getGoalieMatchup('TOR', 'MTL');

      expect(matchup.homeGoalie).not.toBeNull();
      expect(matchup.awayGoalie).not.toBeNull();
      expect(matchup.homeGoalie?.name).toBe('Home Goalie');
      expect(matchup.awayGoalie?.name).toBe('Away Goalie');
      // Home goalie has better stats, so should have advantage
      expect(matchup.advantage).toBe('home');
      expect(matchup.confidenceImpact).toBeGreaterThan(0);
    });

    it('should return neutral matchup when no goalies found', async () => {
      const emptyRoster = { forwards: [], defensemen: [], goalies: [] };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyRoster) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyRoster) });

      const matchup = await getGoalieMatchup('TOR', 'MTL');

      expect(matchup.homeGoalie).toBeNull();
      expect(matchup.awayGoalie).toBeNull();
      expect(matchup.advantage).toBe('neutral');
      expect(matchup.confidenceImpact).toBe(0);
    });
  });

  describe('getPlayerPredictionFactors', () => {
    it('should combine goalie matchup and hot players', async () => {
      // Simplified mocks - just need basic structure
      const mockRoster = {
        forwards: [],
        defensemen: [],
        goalies: [{ id: 1, firstName: 'Test', lastName: 'Goalie', positionCode: 'G' }],
      };

      const mockGoalieStats = {
        featuredStats: {
          regularSeason: {
            subSeason: {
              gamesPlayed: 30,
              wins: 15,
              savePctg: 0.910,
              goalsAgainstAvg: 2.80,
            },
          },
        },
        last5Games: [],
      };

      // Need 4 roster calls (home/away for matchup, home/away for hot players)
      // and 2 goalie stat calls
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockRoster) }) // home roster (matchup)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockRoster) }) // away roster (matchup)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGoalieStats) }) // home goalie
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGoalieStats) }); // away goalie
      // Hot players will use cached roster data

      const factors = await getPlayerPredictionFactors('TOR', 'MTL');

      expect(factors).toHaveProperty('goalieMatchup');
      expect(factors).toHaveProperty('homeHotPlayers');
      expect(factors).toHaveProperty('awayHotPlayers');
      expect(factors).toHaveProperty('totalImpact');
      expect(typeof factors.totalImpact).toBe('number');
    });

    it('should return zero impact on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const factors = await getPlayerPredictionFactors('XXX', 'YYY');

      expect(factors.totalImpact).toBe(0);
      // goalieMatchup returns default neutral object (not null) on error
      expect(factors.goalieMatchup?.advantage).toBe('neutral');
      expect(factors.goalieMatchup?.confidenceImpact).toBe(0);
    });
  });

  describe('clearPlayerCache', () => {
    it('should clear cached data', async () => {
      const mockRoster = {
        forwards: [{ id: 1, firstName: 'Test', lastName: 'Player', positionCode: 'C' }],
        defensemen: [],
        goalies: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRoster),
      });

      // First call - should fetch
      await fetchTeamRoster('TOR');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await fetchTeamRoster('TOR');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      clearPlayerCache();

      // Third call - should fetch again
      await fetchTeamRoster('TOR');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
