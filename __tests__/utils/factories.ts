import { Pick, DailyPicks, PickStats } from '@/services/pickTracking';

// Helper to get today's date in YYYY-MM-DD format
export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to get a specific date string
export function getDateString(daysOffset: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Create a mock Pick
export function createMockPick(overrides: Partial<Pick> = {}): Pick {
  const today = getTodayDateString();
  return {
    gameId: '123456',
    date: today,
    type: 'smart-pick',
    predictedWinner: 'TOR',
    homeTeam: 'TOR',
    awayTeam: 'MTL',
    confidenceScore: 75,
    outcome: undefined,
    actualWinner: undefined,
    ...overrides,
  };
}

// Create a mock Lock of the Day pick
export function createMockLockPick(overrides: Partial<Pick> = {}): Pick {
  return createMockPick({
    type: 'lock',
    confidenceScore: 85,
    ...overrides,
  });
}

// Create a mock User pick
export function createMockUserPick(overrides: Partial<Pick> = {}): Pick {
  return createMockPick({
    type: 'user-pick',
    ...overrides,
  });
}

// Create mock DailyPicks
export function createMockDailyPicks(overrides: Partial<DailyPicks> = {}): DailyPicks {
  const today = getTodayDateString();
  return {
    date: today,
    lock: createMockLockPick({ date: today }),
    smartPicks: [
      createMockPick({ gameId: '123', date: today }),
      createMockPick({ gameId: '456', date: today, homeTeam: 'BOS', awayTeam: 'NYR' }),
    ],
    userPicks: [],
    ...overrides,
  };
}

// Create a mock NHL game
export function createMockGame(overrides: any = {}): any {
  return {
    id: 123456,
    season: 20242025,
    gameType: 2,
    gameDate: getTodayDateString(),
    startTimeUTC: new Date().toISOString(),
    gameState: 'FUT',
    gameScheduleState: 'OK',
    homeTeam: {
      id: 10,
      abbrev: 'TOR',
      name: { default: 'Toronto Maple Leafs' },
      logo: 'https://assets.nhle.com/logos/nhl/svg/TOR_light.svg',
      score: 0,
    },
    awayTeam: {
      id: 8,
      abbrev: 'MTL',
      name: { default: 'Montreal Canadiens' },
      logo: 'https://assets.nhle.com/logos/nhl/svg/MTL_light.svg',
      score: 0,
    },
    ...overrides,
  };
}

// Create a mock completed game
export function createMockCompletedGame(winner: 'home' | 'away', overrides: any = {}): any {
  return createMockGame({
    gameState: 'OFF',
    gameScheduleState: 'OK',
    homeTeam: {
      ...createMockGame().homeTeam,
      score: winner === 'home' ? 4 : 2,
    },
    awayTeam: {
      ...createMockGame().awayTeam,
      score: winner === 'away' ? 4 : 2,
    },
    ...overrides,
  });
}

// Create mock PickStats
export function createMockPickStats(overrides: Partial<PickStats> = {}): PickStats {
  return {
    total: 10,
    wins: 7,
    losses: 3,
    pushes: 0,
    accuracy: 70,
    ...overrides,
  };
}

// Create a winning pick
export function createWinningPick(overrides: Partial<Pick> = {}): Pick {
  return createMockPick({
    outcome: 'win',
    actualWinner: 'TOR',
    predictedWinner: 'TOR',
    ...overrides,
  });
}

// Create a losing pick
export function createLosingPick(overrides: Partial<Pick> = {}): Pick {
  return createMockPick({
    outcome: 'loss',
    actualWinner: 'MTL',
    predictedWinner: 'TOR',
    ...overrides,
  });
}

// Create a push pick (tie)
export function createPushPick(overrides: Partial<Pick> = {}): Pick {
  return createMockPick({
    outcome: 'push',
    actualWinner: 'tie',
    ...overrides,
  });
}
