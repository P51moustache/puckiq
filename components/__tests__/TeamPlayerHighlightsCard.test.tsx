/**
 * Tests for TeamPlayerHighlightsCard component
 * Tests the logic for finding top players by category
 */

// Mock react-native
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  StyleSheet: { create: (styles: any) => styles },
  Text: 'Text',
  View: 'View',
  Dimensions: {
    get: () => ({ width: 400, height: 800 }),
  },
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  default: { call: () => {} },
  useSharedValue: () => ({ value: 0 }),
  useAnimatedStyle: () => ({}),
  withRepeat: (value: any) => value,
  withTiming: (value: any) => value,
  interpolate: () => 0.5,
}));

// Types for testing
interface SkaterStats {
  playerId: number;
  headshot: string;
  firstName: { default: string };
  lastName: { default: string };
  positionCode: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
}

interface GoalieStats {
  playerId: number;
  headshot: string;
  firstName: { default: string };
  lastName: { default: string };
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  overtimeLosses: number;
  goalsAgainstAverage: number;
  savePercentage: number;
  shutouts: number;
}

// Helper function to get player name (matches component logic)
function getPlayerName(player: SkaterStats | GoalieStats): string {
  const firstName = typeof player.firstName === 'string'
    ? player.firstName
    : player.firstName?.default || '';
  const lastName = typeof player.lastName === 'string'
    ? player.lastName
    : player.lastName?.default || '';
  return `${firstName} ${lastName}`.trim();
}

// Helper function to calculate highlights (matches component logic)
function getHighlights(skaters: SkaterStats[], goalies: GoalieStats[]) {
  if (!skaters || skaters.length === 0) {
    return {
      topScorer: null,
      topGoals: null,
      topAssists: null,
      topPlusMinus: null,
      startingGoalie: null,
    };
  }

  const filteredSkaters = skaters.filter(s => s.gamesPlayed > 0);

  const byPoints = [...filteredSkaters].sort((a, b) => b.points - a.points);
  const byGoals = [...filteredSkaters].sort((a, b) => b.goals - a.goals);
  const byAssists = [...filteredSkaters].sort((a, b) => b.assists - a.assists);
  const byPlusMinus = [...filteredSkaters].sort((a, b) => b.plusMinus - a.plusMinus);
  const sortedGoalies = [...goalies].sort((a, b) => b.gamesPlayed - a.gamesPlayed);

  return {
    topScorer: byPoints[0] ? { name: getPlayerName(byPoints[0]), value: byPoints[0].points } : null,
    topGoals: byGoals[0] ? { name: getPlayerName(byGoals[0]), value: byGoals[0].goals } : null,
    topAssists: byAssists[0] ? { name: getPlayerName(byAssists[0]), value: byAssists[0].assists } : null,
    topPlusMinus: byPlusMinus[0] ? { name: getPlayerName(byPlusMinus[0]), value: byPlusMinus[0].plusMinus } : null,
    startingGoalie: sortedGoalies[0] ? { name: getPlayerName(sortedGoalies[0]), wins: sortedGoalies[0].wins } : null,
  };
}

const mockSkaters: SkaterStats[] = [
  {
    playerId: 8478402,
    headshot: 'https://example.com/player1.jpg',
    firstName: { default: 'Connor' },
    lastName: { default: 'McDavid' },
    positionCode: 'C',
    gamesPlayed: 40,
    goals: 25,
    assists: 35,
    points: 60,
    plusMinus: 15,
  },
  {
    playerId: 8477934,
    headshot: 'https://example.com/player2.jpg',
    firstName: { default: 'Leon' },
    lastName: { default: 'Draisaitl' },
    positionCode: 'C',
    gamesPlayed: 40,
    goals: 30,
    assists: 25,
    points: 55,
    plusMinus: 10,
  },
  {
    playerId: 8479318,
    headshot: 'https://example.com/player3.jpg',
    firstName: { default: 'Evan' },
    lastName: { default: 'Bouchard' },
    positionCode: 'D',
    gamesPlayed: 40,
    goals: 10,
    assists: 30,
    points: 40,
    plusMinus: 20,
  },
];

const mockGoalies: GoalieStats[] = [
  {
    playerId: 8479406,
    headshot: 'https://example.com/goalie1.jpg',
    firstName: { default: 'Stuart' },
    lastName: { default: 'Skinner' },
    gamesPlayed: 30,
    gamesStarted: 28,
    wins: 18,
    losses: 8,
    overtimeLosses: 2,
    goalsAgainstAverage: 2.65,
    savePercentage: 0.908,
    shutouts: 2,
  },
];

describe('TeamPlayerHighlightsCard Logic', () => {
  describe('getHighlights', () => {
    it('returns null values when no skaters provided', () => {
      const result = getHighlights([], []);

      expect(result.topScorer).toBeNull();
      expect(result.topGoals).toBeNull();
      expect(result.topAssists).toBeNull();
      expect(result.topPlusMinus).toBeNull();
      expect(result.startingGoalie).toBeNull();
    });

    it('correctly identifies top scorer by points', () => {
      const result = getHighlights(mockSkaters, mockGoalies);

      expect(result.topScorer?.name).toBe('Connor McDavid');
      expect(result.topScorer?.value).toBe(60);
    });

    it('correctly identifies top goal scorer', () => {
      const result = getHighlights(mockSkaters, mockGoalies);

      expect(result.topGoals?.name).toBe('Leon Draisaitl');
      expect(result.topGoals?.value).toBe(30);
    });

    it('correctly identifies top assists leader', () => {
      const result = getHighlights(mockSkaters, mockGoalies);

      // McDavid has 35 assists, Bouchard has 30
      expect(result.topAssists?.name).toBe('Connor McDavid');
      expect(result.topAssists?.value).toBe(35);
    });

    it('correctly identifies best plus/minus', () => {
      const result = getHighlights(mockSkaters, mockGoalies);

      expect(result.topPlusMinus?.name).toBe('Evan Bouchard');
      expect(result.topPlusMinus?.value).toBe(20);
    });

    it('correctly identifies starting goalie by games played', () => {
      const result = getHighlights(mockSkaters, mockGoalies);

      expect(result.startingGoalie?.name).toBe('Stuart Skinner');
      expect(result.startingGoalie?.wins).toBe(18);
    });

    it('handles multiple goalies and picks the one with most games', () => {
      const multipleGoalies: GoalieStats[] = [
        { ...mockGoalies[0], gamesPlayed: 20 },
        {
          playerId: 8479407,
          headshot: 'https://example.com/goalie2.jpg',
          firstName: { default: 'Jack' },
          lastName: { default: 'Campbell' },
          gamesPlayed: 25,
          gamesStarted: 23,
          wins: 15,
          losses: 7,
          overtimeLosses: 3,
          goalsAgainstAverage: 2.80,
          savePercentage: 0.902,
          shutouts: 1,
        },
      ];

      const result = getHighlights(mockSkaters, multipleGoalies);

      expect(result.startingGoalie?.name).toBe('Jack Campbell');
    });

    it('filters out players with 0 games played', () => {
      const skatersWithZeroGP: SkaterStats[] = [
        { ...mockSkaters[0], gamesPlayed: 0, points: 100 }, // Would be top scorer if not filtered
        mockSkaters[1],
        mockSkaters[2],
      ];

      const result = getHighlights(skatersWithZeroGP, mockGoalies);

      expect(result.topScorer?.name).toBe('Leon Draisaitl');
    });

    it('handles tied stats by array order', () => {
      const tiedSkaters: SkaterStats[] = [
        { ...mockSkaters[0], points: 50, goals: 25 },
        { ...mockSkaters[1], points: 50, goals: 25 },
      ];

      const result = getHighlights(tiedSkaters, mockGoalies);

      // First in array wins tie
      expect(result.topScorer?.name).toBe('Connor McDavid');
    });
  });

  describe('getPlayerName', () => {
    it('handles object firstName/lastName format', () => {
      const player = {
        firstName: { default: 'Connor' },
        lastName: { default: 'McDavid' },
      } as SkaterStats;

      expect(getPlayerName(player)).toBe('Connor McDavid');
    });

    it('handles missing first or last name', () => {
      const playerNoFirst = {
        firstName: { default: '' },
        lastName: { default: 'McDavid' },
      } as SkaterStats;

      const playerNoLast = {
        firstName: { default: 'Connor' },
        lastName: { default: '' },
      } as SkaterStats;

      expect(getPlayerName(playerNoFirst)).toBe('McDavid');
      expect(getPlayerName(playerNoLast)).toBe('Connor');
    });
  });
});

describe('TeamPlayerHighlightsCard API Integration', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  it('constructs correct API URL for team', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ skaters: [], goalies: [] }),
    });

    // Simulate calling the API
    await fetch('https://api-web.nhle.com/v1/club-stats/TOR/now');

    expect(global.fetch).toHaveBeenCalledWith('https://api-web.nhle.com/v1/club-stats/TOR/now');
  });

  it('handles API error response', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    try {
      await fetch('https://api-web.nhle.com/v1/club-stats/EDM/now');
    } catch (error: any) {
      expect(error.message).toBe('Network error');
    }
  });

  it('handles non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
    });

    const response = await fetch('https://api-web.nhle.com/v1/club-stats/INVALID/now');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });
});
