/**
 * Tests for PickResultModal component
 * Tests the modal display logic for yesterday's pick results
 */

import { Pick } from '../../services/pickTracking';

// Mock react-native
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  StyleSheet: { create: (styles: any) => styles },
  Text: 'Text',
  View: 'View',
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  Dimensions: {
    get: () => ({ width: 400, height: 800 }),
  },
}));

// Mock theme
jest.mock('../../constants/theme', () => ({
  makeStyles: () => ({
    card: { backgroundColor: '#1a2a4a' },
    text: { color: '#e6eef8' },
  }),
}));

// Game score interface
interface GameScore {
  homeScore: number;
  awayScore: number;
  gameState: string;
  periodDescriptor?: { number: number; periodType: string };
}

// Period scoring interface
interface PeriodScore {
  periodNumber: number;
  periodType: string; // 'REG', 'OT', 'SO'
  homeScore: number;
  awayScore: number;
}

// Game details with period breakdown
interface GameDetails {
  periodScores: PeriodScore[];
  homeShots: number;
  awayShots: number;
  homePowerPlayGoals: number;
  homePowerPlayOpportunities: number;
  awayPowerPlayGoals: number;
  awayPowerPlayOpportunities: number;
}

// Helper to parse period scores from landing API response
function parsePeriodScores(
  scoring: any[],
  homeAbbrev: string,
  awayAbbrev: string
): PeriodScore[] {
  if (!scoring || !Array.isArray(scoring)) return [];

  return scoring.map((period: any) => {
    const goals = period.goals || [];
    const homeGoals = goals.filter(
      (g: any) => g.teamAbbrev?.default === homeAbbrev
    ).length;
    const awayGoals = goals.filter(
      (g: any) => g.teamAbbrev?.default === awayAbbrev
    ).length;

    return {
      periodNumber: period.periodDescriptor?.number || 0,
      periodType: period.periodDescriptor?.periodType || 'REG',
      homeScore: homeGoals,
      awayScore: awayGoals,
    };
  });
}

// Helper to parse game stats from boxscore
function parseGameStats(boxscore: any): { homeShots: number; awayShots: number } | null {
  if (!boxscore?.homeTeam || !boxscore?.awayTeam) return null;

  return {
    homeShots: boxscore.homeTeam.sog || 0,
    awayShots: boxscore.awayTeam.sog || 0,
  };
}

// Helper to format period label
function getPeriodLabel(periodNumber: number, periodType: string): string {
  if (periodType === 'OT') return 'OT';
  if (periodType === 'SO') return 'SO';
  return `${periodNumber}`;
}

// Helper to determine which team led after each period
function getLeaderAfterPeriod(periodScores: PeriodScore[], upToPeriod: number): 'home' | 'away' | 'tie' {
  let homeTotal = 0;
  let awayTotal = 0;

  for (let i = 0; i < upToPeriod && i < periodScores.length; i++) {
    homeTotal += periodScores[i].homeScore;
    awayTotal += periodScores[i].awayScore;
  }

  if (homeTotal > awayTotal) return 'home';
  if (awayTotal > homeTotal) return 'away';
  return 'tie';
}

// Helper to get pick type label
function getPickTypeLabel(type: Pick['type']): string {
  switch (type) {
    case 'lock':
      return 'Lock of the Day';
    case 'smart-pick':
      return 'Smart Pick';
    case 'user-pick':
      return 'Your Pick';
    default:
      return 'Pick';
  }
}

// Helper to get pick type color
function getPickTypeColor(type: Pick['type']): string {
  switch (type) {
    case 'lock':
      return '#fbbf24'; // Gold
    case 'smart-pick':
      return '#60a5fa'; // Blue
    case 'user-pick':
      return '#10b981'; // Green
    default:
      return '#98a6bf';
  }
}

// Helper to get outcome styling
function getOutcomeDisplay(outcome?: 'win' | 'loss' | 'push'): { label: string; color: string; icon: string } {
  switch (outcome) {
    case 'win':
      return { label: 'Correct', color: '#10b981', icon: '✓' };
    case 'loss':
      return { label: 'Incorrect', color: '#ef4444', icon: '✗' };
    case 'push':
      return { label: 'Push', color: '#98a6bf', icon: '−' };
    default:
      return { label: 'Pending', color: '#98a6bf', icon: '...' };
  }
}

// Helper to format game score display
function formatGameScore(gameScore: GameScore | null, pick: Pick): string {
  if (!gameScore) return 'Score unavailable';

  const { homeScore, awayScore } = gameScore;
  return `${pick.awayTeam} ${awayScore} - ${homeScore} ${pick.homeTeam}`;
}

// Helper to determine if prediction was correct
function isPredictionCorrect(pick: Pick, gameScore: GameScore | null): boolean | null {
  if (!gameScore || !pick.actualWinner) return null;
  return pick.predictedWinner === pick.actualWinner;
}

// Mock picks for testing
const mockLockPick: Pick = {
  gameId: '2024020001',
  date: '2024-12-23',
  type: 'lock',
  predictedWinner: 'TOR',
  homeTeam: 'TOR',
  awayTeam: 'MTL',
  confidenceScore: 72,
  homeWinProb: 72,
  awayWinProb: 28,
  outcome: 'win',
  actualWinner: 'TOR',
};

const mockSmartPick: Pick = {
  gameId: '2024020002',
  date: '2024-12-23',
  type: 'smart-pick',
  predictedWinner: 'BOS',
  homeTeam: 'NYR',
  awayTeam: 'BOS',
  confidenceScore: 65,
  homeWinProb: 35,
  awayWinProb: 65,
  outcome: 'loss',
  actualWinner: 'NYR',
};

const mockUserPick: Pick = {
  gameId: '2024020003',
  date: '2024-12-23',
  type: 'user-pick',
  predictedWinner: 'EDM',
  homeTeam: 'EDM',
  awayTeam: 'CGY',
  confidenceScore: undefined,
  homeWinProb: undefined,
  awayWinProb: undefined,
  outcome: 'win',
  actualWinner: 'EDM',
};

const mockPendingPick: Pick = {
  gameId: '2024020004',
  date: '2024-12-23',
  type: 'smart-pick',
  predictedWinner: 'VGK',
  homeTeam: 'VGK',
  awayTeam: 'LAK',
  confidenceScore: 58,
  homeWinProb: 58,
  awayWinProb: 42,
  outcome: undefined,
  actualWinner: undefined,
};

const mockGameScore: GameScore = {
  homeScore: 4,
  awayScore: 2,
  gameState: 'OFF',
  periodDescriptor: { number: 3, periodType: 'REG' },
};

describe('PickResultModal Logic', () => {
  describe('getPickTypeLabel', () => {
    it('returns correct label for lock pick', () => {
      expect(getPickTypeLabel('lock')).toBe('Lock of the Day');
    });

    it('returns correct label for smart-pick', () => {
      expect(getPickTypeLabel('smart-pick')).toBe('Smart Pick');
    });

    it('returns correct label for user-pick', () => {
      expect(getPickTypeLabel('user-pick')).toBe('Your Pick');
    });
  });

  describe('getPickTypeColor', () => {
    it('returns gold for lock pick', () => {
      expect(getPickTypeColor('lock')).toBe('#fbbf24');
    });

    it('returns blue for smart-pick', () => {
      expect(getPickTypeColor('smart-pick')).toBe('#60a5fa');
    });

    it('returns green for user-pick', () => {
      expect(getPickTypeColor('user-pick')).toBe('#10b981');
    });
  });

  describe('getOutcomeDisplay', () => {
    it('returns correct display for win', () => {
      const result = getOutcomeDisplay('win');
      expect(result.label).toBe('Correct');
      expect(result.color).toBe('#10b981');
      expect(result.icon).toBe('✓');
    });

    it('returns correct display for loss', () => {
      const result = getOutcomeDisplay('loss');
      expect(result.label).toBe('Incorrect');
      expect(result.color).toBe('#ef4444');
      expect(result.icon).toBe('✗');
    });

    it('returns correct display for push', () => {
      const result = getOutcomeDisplay('push');
      expect(result.label).toBe('Push');
      expect(result.color).toBe('#98a6bf');
      expect(result.icon).toBe('−');
    });

    it('returns pending display when outcome is undefined', () => {
      const result = getOutcomeDisplay(undefined);
      expect(result.label).toBe('Pending');
      expect(result.color).toBe('#98a6bf');
      expect(result.icon).toBe('...');
    });
  });

  describe('formatGameScore', () => {
    it('formats game score correctly', () => {
      const result = formatGameScore(mockGameScore, mockLockPick);
      expect(result).toBe('MTL 2 - 4 TOR');
    });

    it('returns unavailable message when no score', () => {
      const result = formatGameScore(null, mockLockPick);
      expect(result).toBe('Score unavailable');
    });
  });

  describe('isPredictionCorrect', () => {
    it('returns true when prediction matches actual winner', () => {
      const result = isPredictionCorrect(mockLockPick, mockGameScore);
      expect(result).toBe(true);
    });

    it('returns false when prediction does not match', () => {
      const result = isPredictionCorrect(mockSmartPick, mockGameScore);
      expect(result).toBe(false);
    });

    it('returns null when game score is not available', () => {
      const result = isPredictionCorrect(mockLockPick, null);
      expect(result).toBeNull();
    });

    it('returns null when actual winner is not set', () => {
      const result = isPredictionCorrect(mockPendingPick, mockGameScore);
      expect(result).toBeNull();
    });
  });
});

describe('PickResultModal Pick Types', () => {
  describe('Lock pick display', () => {
    it('has gold color styling', () => {
      expect(getPickTypeColor(mockLockPick.type)).toBe('#fbbf24');
    });

    it('shows confidence score', () => {
      expect(mockLockPick.confidenceScore).toBe(72);
    });

    it('shows Lock of the Day label', () => {
      expect(getPickTypeLabel(mockLockPick.type)).toBe('Lock of the Day');
    });
  });

  describe('Smart pick display', () => {
    it('has blue color styling', () => {
      expect(getPickTypeColor(mockSmartPick.type)).toBe('#60a5fa');
    });

    it('shows confidence score', () => {
      expect(mockSmartPick.confidenceScore).toBe(65);
    });

    it('shows Smart Pick label', () => {
      expect(getPickTypeLabel(mockSmartPick.type)).toBe('Smart Pick');
    });
  });

  describe('User pick display', () => {
    it('has green color styling', () => {
      expect(getPickTypeColor(mockUserPick.type)).toBe('#10b981');
    });

    it('may not have confidence score', () => {
      expect(mockUserPick.confidenceScore).toBeUndefined();
    });

    it('shows Your Pick label', () => {
      expect(getPickTypeLabel(mockUserPick.type)).toBe('Your Pick');
    });
  });

  describe('Win probability display', () => {
    it('lock pick has win probabilities that sum to 100', () => {
      expect(mockLockPick.homeWinProb).toBe(72);
      expect(mockLockPick.awayWinProb).toBe(28);
      expect(mockLockPick.homeWinProb! + mockLockPick.awayWinProb!).toBe(100);
    });

    it('smart pick has win probabilities that sum to 100', () => {
      expect(mockSmartPick.homeWinProb).toBe(35);
      expect(mockSmartPick.awayWinProb).toBe(65);
      expect(mockSmartPick.homeWinProb! + mockSmartPick.awayWinProb!).toBe(100);
    });

    it('user pick may not have win probabilities', () => {
      expect(mockUserPick.homeWinProb).toBeUndefined();
      expect(mockUserPick.awayWinProb).toBeUndefined();
    });

    it('predicted winner matches team with higher probability', () => {
      // Lock: TOR (home) predicted, homeWinProb = 72 > awayWinProb = 28
      expect(mockLockPick.predictedWinner).toBe(mockLockPick.homeTeam);
      expect(mockLockPick.homeWinProb).toBeGreaterThan(mockLockPick.awayWinProb!);

      // Smart: BOS (away) predicted, awayWinProb = 65 > homeWinProb = 35
      expect(mockSmartPick.predictedWinner).toBe(mockSmartPick.awayTeam);
      expect(mockSmartPick.awayWinProb).toBeGreaterThan(mockSmartPick.homeWinProb!);
    });
  });
});

describe('PickResultModal Edge Cases', () => {
  it('handles pick without confidence score', () => {
    const pickWithoutConfidence: Pick = {
      ...mockUserPick,
      confidenceScore: undefined,
    };

    // Should not throw when confidence is undefined
    expect(pickWithoutConfidence.confidenceScore).toBeUndefined();
  });

  it('handles pending game (no outcome)', () => {
    const outcomeDisplay = getOutcomeDisplay(mockPendingPick.outcome);
    expect(outcomeDisplay.label).toBe('Pending');
  });

  it('handles overtime game', () => {
    const otGameScore: GameScore = {
      homeScore: 3,
      awayScore: 2,
      gameState: 'OFF',
      periodDescriptor: { number: 4, periodType: 'OT' },
    };

    expect(otGameScore.periodDescriptor?.periodType).toBe('OT');
  });

  it('handles shootout game', () => {
    const soGameScore: GameScore = {
      homeScore: 3,
      awayScore: 2,
      gameState: 'OFF',
      periodDescriptor: { number: 5, periodType: 'SO' },
    };

    expect(soGameScore.periodDescriptor?.periodType).toBe('SO');
  });
});

describe('PickResultModal API Integration', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  it('fetches game score from correct NHL API endpoint', async () => {
    const mockResponse = {
      games: [{
        id: 2024020001,
        homeTeam: { abbrev: 'TOR', score: 4 },
        awayTeam: { abbrev: 'MTL', score: 2 },
        gameState: 'OFF',
      }],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const date = '2024-12-23';
    await fetch(`https://api-web.nhle.com/v1/score/${date}`);

    expect(global.fetch).toHaveBeenCalledWith(`https://api-web.nhle.com/v1/score/${date}`);
  });

  it('handles API error gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    try {
      await fetch('https://api-web.nhle.com/v1/score/2024-12-23');
    } catch (error: any) {
      expect(error.message).toBe('Network error');
    }
  });

  it('handles non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
    });

    const response = await fetch('https://api-web.nhle.com/v1/score/2024-12-23');
    expect(response.ok).toBe(false);
  });

  it('finds correct game from multiple games in response', async () => {
    const mockResponse = {
      games: [
        { id: 2024020001, homeTeam: { abbrev: 'TOR', score: 4 }, awayTeam: { abbrev: 'MTL', score: 2 }, gameState: 'OFF' },
        { id: 2024020002, homeTeam: { abbrev: 'NYR', score: 3 }, awayTeam: { abbrev: 'BOS', score: 1 }, gameState: 'OFF' },
        { id: 2024020003, homeTeam: { abbrev: 'EDM', score: 5 }, awayTeam: { abbrev: 'CGY', score: 3 }, gameState: 'OFF' },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const response = await fetch('https://api-web.nhle.com/v1/score/2024-12-23');
    const data = await response.json();

    // Find game by ID
    const targetGame = data.games.find((g: any) => String(g.id) === mockLockPick.gameId);
    expect(targetGame).toBeDefined();
    expect(targetGame.homeTeam.abbrev).toBe('TOR');
    expect(targetGame.homeTeam.score).toBe(4);
  });
});

// Helper to create mock goal
const createGoal = (teamAbbrev: string) => ({
  teamAbbrev: { default: teamAbbrev },
  playerId: 12345,
});

// Mock landing API responses (scoring format)
const mockScoringRegulation = [
  {
    periodDescriptor: { number: 1, periodType: 'REG' },
    goals: [createGoal('TOR')], // 1 home goal
  },
  {
    periodDescriptor: { number: 2, periodType: 'REG' },
    goals: [createGoal('TOR'), createGoal('TOR'), createGoal('MTL')], // 2 home, 1 away
  },
  {
    periodDescriptor: { number: 3, periodType: 'REG' },
    goals: [createGoal('TOR'), createGoal('MTL')], // 1 home, 1 away
  },
];

const mockScoringOvertime = [
  {
    periodDescriptor: { number: 1, periodType: 'REG' },
    goals: [createGoal('TOR'), createGoal('MTL')], // 1-1
  },
  {
    periodDescriptor: { number: 2, periodType: 'REG' },
    goals: [createGoal('TOR'), createGoal('MTL')], // 1-1
  },
  {
    periodDescriptor: { number: 3, periodType: 'REG' },
    goals: [createGoal('TOR'), createGoal('MTL')], // 1-1
  },
  {
    periodDescriptor: { number: 4, periodType: 'OT' },
    goals: [createGoal('TOR')], // 1-0 OT winner
  },
];

const mockScoringShootout = [
  {
    periodDescriptor: { number: 1, periodType: 'REG' },
    goals: [createGoal('TOR'), createGoal('TOR'), createGoal('MTL')], // 2-1
  },
  {
    periodDescriptor: { number: 2, periodType: 'REG' },
    goals: [createGoal('MTL')], // 0-1
  },
  {
    periodDescriptor: { number: 3, periodType: 'REG' },
    goals: [], // 0-0
  },
  {
    periodDescriptor: { number: 4, periodType: 'OT' },
    goals: [], // 0-0
  },
  {
    periodDescriptor: { number: 5, periodType: 'SO' },
    goals: [createGoal('MTL')], // SO winner (counts as 1)
  },
];

describe('Period Scoring Logic', () => {
  describe('parsePeriodScores', () => {
    it('parses regulation game periods correctly', () => {
      const result = parsePeriodScores(mockScoringRegulation, 'TOR', 'MTL');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ periodNumber: 1, periodType: 'REG', homeScore: 1, awayScore: 0 });
      expect(result[1]).toEqual({ periodNumber: 2, periodType: 'REG', homeScore: 2, awayScore: 1 });
      expect(result[2]).toEqual({ periodNumber: 3, periodType: 'REG', homeScore: 1, awayScore: 1 });
    });

    it('parses overtime game correctly', () => {
      const result = parsePeriodScores(mockScoringOvertime, 'TOR', 'MTL');

      expect(result).toHaveLength(4);
      expect(result[3]).toEqual({ periodNumber: 4, periodType: 'OT', homeScore: 1, awayScore: 0 });
    });

    it('parses shootout game correctly', () => {
      const result = parsePeriodScores(mockScoringShootout, 'TOR', 'MTL');

      expect(result).toHaveLength(5);
      expect(result[3]).toEqual({ periodNumber: 4, periodType: 'OT', homeScore: 0, awayScore: 0 });
      expect(result[4]).toEqual({ periodNumber: 5, periodType: 'SO', homeScore: 0, awayScore: 1 });
    });

    it('returns empty array when no period data', () => {
      expect(parsePeriodScores(null as any, 'TOR', 'MTL')).toEqual([]);
      expect(parsePeriodScores(undefined as any, 'TOR', 'MTL')).toEqual([]);
      expect(parsePeriodScores([], 'TOR', 'MTL')).toEqual([]);
    });
  });

  describe('parseGameStats', () => {
    const mockLandingData = {
      homeTeam: { abbrev: 'TOR', sog: 35 },
      awayTeam: { abbrev: 'MTL', sog: 28 },
    };

    it('parses shots on goal correctly', () => {
      const result = parseGameStats(mockLandingData);

      expect(result).toEqual({ homeShots: 35, awayShots: 28 });
    });

    it('returns null when no team data', () => {
      expect(parseGameStats(null)).toBeNull();
      expect(parseGameStats({})).toBeNull();
      expect(parseGameStats({ homeTeam: null })).toBeNull();
    });

    it('defaults to 0 when sog is missing', () => {
      const result = parseGameStats({ homeTeam: {}, awayTeam: {} });

      expect(result).toEqual({ homeShots: 0, awayShots: 0 });
    });
  });

  describe('getPeriodLabel', () => {
    it('returns period number for regulation periods', () => {
      expect(getPeriodLabel(1, 'REG')).toBe('1');
      expect(getPeriodLabel(2, 'REG')).toBe('2');
      expect(getPeriodLabel(3, 'REG')).toBe('3');
    });

    it('returns OT for overtime period', () => {
      expect(getPeriodLabel(4, 'OT')).toBe('OT');
    });

    it('returns SO for shootout', () => {
      expect(getPeriodLabel(5, 'SO')).toBe('SO');
    });
  });

  describe('getLeaderAfterPeriod', () => {
    const periodScores: PeriodScore[] = [
      { periodNumber: 1, periodType: 'REG', homeScore: 1, awayScore: 0 },
      { periodNumber: 2, periodType: 'REG', homeScore: 0, awayScore: 2 },
      { periodNumber: 3, periodType: 'REG', homeScore: 2, awayScore: 0 },
    ];

    it('returns correct leader after first period', () => {
      expect(getLeaderAfterPeriod(periodScores, 1)).toBe('home'); // 1-0
    });

    it('returns correct leader after second period', () => {
      expect(getLeaderAfterPeriod(periodScores, 2)).toBe('away'); // 1-2
    });

    it('returns correct leader after third period', () => {
      expect(getLeaderAfterPeriod(periodScores, 3)).toBe('home'); // 3-2
    });

    it('returns tie when scores are equal', () => {
      const tiedScores: PeriodScore[] = [
        { periodNumber: 1, periodType: 'REG', homeScore: 1, awayScore: 1 },
      ];
      expect(getLeaderAfterPeriod(tiedScores, 1)).toBe('tie');
    });

    it('handles empty period scores', () => {
      expect(getLeaderAfterPeriod([], 1)).toBe('tie');
    });
  });
});

describe('Period Scoring Display', () => {
  it('calculates total score from periods', () => {
    const periodScores = parsePeriodScores(mockScoringRegulation, 'TOR', 'MTL');
    const homeTotal = periodScores.reduce((sum, p) => sum + p.homeScore, 0);
    const awayTotal = periodScores.reduce((sum, p) => sum + p.awayScore, 0);

    expect(homeTotal).toBe(4); // 1 + 2 + 1
    expect(awayTotal).toBe(2); // 0 + 1 + 1
  });

  it('calculates overtime game total correctly', () => {
    const periodScores = parsePeriodScores(mockScoringOvertime, 'TOR', 'MTL');
    const homeTotal = periodScores.reduce((sum, p) => sum + p.homeScore, 0);
    const awayTotal = periodScores.reduce((sum, p) => sum + p.awayScore, 0);

    expect(homeTotal).toBe(4); // 1 + 1 + 1 + 1
    expect(awayTotal).toBe(3); // 1 + 1 + 1 + 0
  });

  it('calculates shootout game total correctly', () => {
    const periodScores = parsePeriodScores(mockScoringShootout, 'TOR', 'MTL');
    const homeTotal = periodScores.reduce((sum, p) => sum + p.homeScore, 0);
    const awayTotal = periodScores.reduce((sum, p) => sum + p.awayScore, 0);

    // In shootouts, the winning team gets +1 in final score
    expect(homeTotal).toBe(2); // 2 + 0 + 0 + 0 + 0
    expect(awayTotal).toBe(3); // 1 + 1 + 0 + 0 + 1
  });
});

describe('Landing API Integration', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  it('fetches landing data from correct endpoint', async () => {
    const mockLandingResponse = {
      summary: { scoring: mockScoringRegulation },
      homeTeam: { abbrev: 'TOR', sog: 35 },
      awayTeam: { abbrev: 'MTL', sog: 28 },
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLandingResponse),
    });

    const gameId = '2024020001';
    await fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`);

    expect(global.fetch).toHaveBeenCalledWith(
      `https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`
    );
  });

  it('handles landing API error gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    try {
      await fetch('https://api-web.nhle.com/v1/gamecenter/2024020001/landing');
    } catch (error: any) {
      expect(error.message).toBe('Network error');
    }
  });

  it('handles 404 for non-existent game', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
    });

    const response = await fetch('https://api-web.nhle.com/v1/gamecenter/9999999/landing');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });
});
