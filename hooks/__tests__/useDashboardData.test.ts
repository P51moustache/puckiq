/**
 * Tests for hooks/useDashboardData.ts
 *
 * Tests the exported transform functions (pure logic) and verifies the
 * hook's module shape. Follows the same pattern as useTonightData.test.ts.
 */

// --- Mocks must be declared before imports ---

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

jest.mock('../../services/fantasyRoster', () => ({
  loadRoster: jest.fn().mockResolvedValue(null),
  getScoringFormat: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/fantasyProjections', () => ({
  getProjectionsForRoster: jest.fn().mockResolvedValue([]),
  getWaiverWireRecommendations: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/playerTrends', () => ({
  getTrendingPlayers: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/insightGenerator', () => ({
  generateInsights: jest.fn().mockReturnValue([]),
}));

jest.mock('../../services/fantasyAlerts', () => ({
  getDismissedAlertIds: jest.fn().mockResolvedValue([]),
  dismissAlert: jest.fn(),
  getSavedAlertIds: jest.fn().mockResolvedValue([]),
  saveAlert: jest.fn(),
  getAlertColor: jest.fn().mockReturnValue('#ccc'),
}));

import {
  useDashboardData,
  transformStartSit,
  transformTrending,
  transformWaiver,
  transformMatchups,
  transformInsight,
  buildAlertsFromGames,
  generateFallbackData,
  type DashboardData,
} from '../useDashboardData';
import type { PlayerProjection } from '../../types/fantasy';
import type { TrendingPlayer } from '../../services/playerTrends';

// ---------------------------------------------------------------------------
// Module exports & shape tests
// ---------------------------------------------------------------------------

describe('useDashboardData module', () => {
  it('exports useDashboardData as a function', () => {
    expect(typeof useDashboardData).toBe('function');
  });

  it('exports DashboardData interface (type-level — verified by import)', () => {
    const typeCheck: DashboardData | null = null;
    expect(typeCheck).toBeNull();
  });

  it('DashboardData has all expected properties', () => {
    type AssertHasKey<T, K extends keyof T> = K;

    type _1 = AssertHasKey<DashboardData, 'startSitPlayers'>;
    type _2 = AssertHasKey<DashboardData, 'trendingPlayers'>;
    type _3 = AssertHasKey<DashboardData, 'alerts'>;
    type _4 = AssertHasKey<DashboardData, 'waiverPlayers'>;
    type _5 = AssertHasKey<DashboardData, 'matchups'>;
    type _6 = AssertHasKey<DashboardData, 'dailyInsight'>;
    type _7 = AssertHasKey<DashboardData, 'isLoading'>;
    type _7b = AssertHasKey<DashboardData, 'isOffDay'>;
    type _8 = AssertHasKey<DashboardData, 'refresh'>;

    // If we get here TypeScript is satisfied
    expect(true).toBe(true);
  });

  it('exports all transform functions', () => {
    expect(typeof transformStartSit).toBe('function');
    expect(typeof transformTrending).toBe('function');
    expect(typeof transformWaiver).toBe('function');
    expect(typeof transformMatchups).toBe('function');
    expect(typeof transformInsight).toBe('function');
    expect(typeof buildAlertsFromGames).toBe('function');
    expect(typeof generateFallbackData).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Fallback data tests
// ---------------------------------------------------------------------------

describe('generateFallbackData', () => {
  it('returns non-empty arrays for all modules', () => {
    const data = generateFallbackData();
    expect(data.startSitPlayers.length).toBeGreaterThanOrEqual(3);
    expect(data.trendingPlayers.length).toBeGreaterThanOrEqual(3);
    expect(data.alerts.length).toBeGreaterThanOrEqual(2);
    expect(data.waiverPlayers.length).toBeGreaterThanOrEqual(2);
    expect(data.matchups.length).toBeGreaterThanOrEqual(2);
    expect(data.dailyInsight).not.toBeNull();
  });

  it('start/sit players have correct shape', () => {
    const { startSitPlayers } = generateFallbackData();
    for (const p of startSitPlayers) {
      expect(p.id).toBeLessThan(0); // negative IDs mark fallback
      expect(p.name).toBeTruthy();
      expect(p.team).toBeTruthy();
      expect(p.opponent).toBeTruthy();
      expect(['START', 'SIT']).toContain(p.recommendation);
      expect(typeof p.projectedPoints).toBe('number');
    }
  });

  it('includes both START and SIT recommendations', () => {
    const { startSitPlayers } = generateFallbackData();
    expect(startSitPlayers.some((p) => p.recommendation === 'START')).toBe(true);
    expect(startSitPlayers.some((p) => p.recommendation === 'SIT')).toBe(true);
  });

  it('includes at least one disagreement flag', () => {
    const { startSitPlayers } = generateFallbackData();
    expect(startSitPlayers.some((p) => p.hasDisagreement)).toBe(true);
  });

  it('trending players have valid sparkline data', () => {
    const { trendingPlayers } = generateFallbackData();
    for (const p of trendingPlayers) {
      expect(p.recentPoints).toHaveLength(10);
      expect(p.flameCount).toBeGreaterThanOrEqual(1);
      expect(p.flameCount).toBeLessThanOrEqual(5);
      expect(['up', 'down', 'stable']).toContain(p.trend);
    }
  });

  it('matchups have valid edge ratings', () => {
    const { matchups } = generateFallbackData();
    for (const m of matchups) {
      expect(m.edgeRating).toBeGreaterThanOrEqual(1);
      expect(m.edgeRating).toBeLessThanOrEqual(10);
      expect(m.reasons.length).toBeGreaterThan(0);
    }
  });

  it('daily insight has all required fields', () => {
    const { dailyInsight } = generateFallbackData();
    expect(dailyInsight.headline).toBeTruthy();
    expect(dailyInsight.context).toBeTruthy();
    expect(['bullish', 'bearish', 'surprising']).toContain(dailyInsight.sentiment);
  });

  it('waiver players have valid positions', () => {
    const { waiverPlayers } = generateFallbackData();
    for (const p of waiverPlayers) {
      expect(['C', 'LW', 'RW', 'D', 'G']).toContain(p.position);
      expect(p.ownershipPct).toBeGreaterThan(0);
      expect(p.ownershipPct).toBeLessThan(100);
    }
  });
});

// ---------------------------------------------------------------------------
// Transform function tests (pure logic, no async)
// ---------------------------------------------------------------------------

describe('transformStartSit', () => {
  it('filters to only START and SIT recommendations', () => {
    const projections: PlayerProjection[] = [
      makeProjection({ recommendation: 'START', playerName: 'Player A' }),
      makeProjection({ recommendation: 'SIT', playerName: 'Player B' }),
      makeProjection({ recommendation: 'UPSIDE', playerName: 'Player C' }),
      makeProjection({ recommendation: 'FLEX', playerName: 'Player D' }),
    ];

    const result = transformStartSit(projections);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Player A');
    expect(result[0].recommendation).toBe('START');
    expect(result[1].name).toBe('Player B');
    expect(result[1].recommendation).toBe('SIT');
  });

  it('maps fields correctly', () => {
    const proj = makeProjection({
      playerId: 42,
      playerName: 'Connor McDavid',
      teamAbbrev: 'EDM',
      opponentAbbrev: 'CGY',
      fantasyPoints: 4.5,
      recommendation: 'START',
      confidence: 'medium',
    });

    const result = transformStartSit([proj]);
    expect(result[0]).toEqual({
      id: 42,
      name: 'Connor McDavid',
      team: 'EDM',
      opponent: 'CGY',
      projectedPoints: 4.5,
      recommendation: 'START',
      hasDisagreement: false,
      disagreementReason: undefined,
    });
  });

  it('sets hasDisagreement true when confidence is low', () => {
    const proj = makeProjection({
      recommendation: 'START',
      confidence: 'low',
      reason: 'Tough opponent defense',
    });

    const result = transformStartSit([proj]);
    expect(result[0].hasDisagreement).toBe(true);
    expect(result[0].disagreementReason).toBe('Tough opponent defense');
  });

  it('uses default disagreement reason when reason is empty and confidence is low', () => {
    const proj = makeProjection({
      recommendation: 'SIT',
      confidence: 'low',
      reason: '',
    });

    const result = transformStartSit([proj]);
    expect(result[0].hasDisagreement).toBe(true);
    expect(result[0].disagreementReason).toBe('Close matchup \u2014 model is uncertain');
  });

  it('sets hasDisagreement false when confidence is high', () => {
    const proj = makeProjection({
      recommendation: 'START',
      confidence: 'high',
      reason: 'Strong matchup',
    });

    const result = transformStartSit([proj]);
    expect(result[0].hasDisagreement).toBe(false);
    expect(result[0].disagreementReason).toBeUndefined();
  });

  it('returns empty array for no projections', () => {
    expect(transformStartSit([])).toEqual([]);
  });

  it('handles projections with no START or SIT recommendations', () => {
    const projections: PlayerProjection[] = [
      makeProjection({ recommendation: 'UPSIDE' }),
      makeProjection({ recommendation: 'FLEX' }),
    ];

    expect(transformStartSit(projections)).toEqual([]);
  });
});

describe('transformTrending', () => {
  it('maps trendLabel to flameCount correctly', () => {
    const players = [
      makeTrendingPlayer({ trendLabel: 'HOT' }),
      makeTrendingPlayer({ trendLabel: 'WARM' }),
      makeTrendingPlayer({ trendLabel: 'STEADY' }),
      makeTrendingPlayer({ trendLabel: 'COOL' }),
      makeTrendingPlayer({ trendLabel: 'COLD' }),
    ];

    const result = transformTrending(players);
    expect(result.map((p) => p.flameCount)).toEqual([5, 4, 3, 2, 1]);
  });

  it('maps trendLabel to trend direction correctly', () => {
    const players = [
      makeTrendingPlayer({ trendLabel: 'HOT' }),
      makeTrendingPlayer({ trendLabel: 'WARM' }),
      makeTrendingPlayer({ trendLabel: 'STEADY' }),
      makeTrendingPlayer({ trendLabel: 'COOL' }),
      makeTrendingPlayer({ trendLabel: 'COLD' }),
    ];

    const result = transformTrending(players);
    expect(result.map((p) => p.trend)).toEqual(['up', 'up', 'stable', 'down', 'down']);
  });

  it('builds recentPoints array of 10 values', () => {
    const player = makeTrendingPlayer({ avgPoints5g: 3.0, avgPoints10g: 2.5 });
    const result = transformTrending([player]);
    expect(result[0].recentPoints).toHaveLength(10);
    result[0].recentPoints.forEach((val) => {
      expect(val).toBeGreaterThanOrEqual(0);
    });
  });

  it('maps basic fields correctly', () => {
    const player = makeTrendingPlayer({
      playerId: 99,
      playerName: 'Wayne Gretzky',
      teamAbbrev: 'EDM',
      trendLabel: 'HOT',
    });

    const result = transformTrending([player]);
    expect(result[0].id).toBe(99);
    expect(result[0].name).toBe('Wayne Gretzky');
    expect(result[0].team).toBe('EDM');
  });

  it('returns empty array for no players', () => {
    expect(transformTrending([])).toEqual([]);
  });

  it('handles zero-value averages without negative points', () => {
    const player = makeTrendingPlayer({ avgPoints5g: 0, avgPoints10g: 0 });
    const result = transformTrending([player]);
    result[0].recentPoints.forEach((val) => {
      expect(val).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('transformWaiver', () => {
  it('maps fields correctly', () => {
    const proj = makeProjection({
      playerId: 10,
      playerName: 'Marco Rossi',
      teamAbbrev: 'MIN',
      position: 'C',
      fantasyPoints: 3.5,
    });

    const result = transformWaiver([proj]);
    expect(result[0]).toEqual({
      id: 10,
      name: 'Marco Rossi',
      team: 'MIN',
      position: 'C',
      valueScore: 1.5,
      ownershipPct: 25, // C = 25%
      projectedPoints: 3.5,
    });
  });

  it('uses position-based ownership estimates', () => {
    const positions = ['C', 'LW', 'RW', 'D', 'G'];
    const expectedOwnership = [25, 20, 20, 15, 30];

    const projections = positions.map((pos) => makeProjection({ position: pos }));
    const result = transformWaiver(projections);

    result.forEach((p, i) => {
      expect(p.ownershipPct).toBe(expectedOwnership[i]);
    });
  });

  it('computes valueScore as fantasyPoints - 2.0 baseline (clamped to 0)', () => {
    const low = makeProjection({ fantasyPoints: 1.0 });
    const high = makeProjection({ fantasyPoints: 5.5 });

    expect(transformWaiver([low])[0].valueScore).toBe(0);
    expect(transformWaiver([high])[0].valueScore).toBe(3.5);
  });

  it('defaults to 15% ownership for unknown positions', () => {
    const proj = makeProjection({ position: 'UTIL' });
    expect(transformWaiver([proj])[0].ownershipPct).toBe(15);
  });
});

describe('transformMatchups', () => {
  it('takes top 5 by fantasyPoints', () => {
    const projections = Array.from({ length: 8 }, (_, i) =>
      makeProjection({ playerId: i + 1, fantasyPoints: 8 - i })
    );

    const result = transformMatchups(projections);
    expect(result).toHaveLength(5);
    expect(result[0].projectedPoints).toBe(8);
    expect(result[4].projectedPoints).toBe(4);
  });

  it('computes edgeRating in 1-10 range', () => {
    const high = makeProjection({ fantasyPoints: 6.0 });
    const low = makeProjection({ fantasyPoints: 0.5 });

    const resultHigh = transformMatchups([high]);
    const resultLow = transformMatchups([low]);

    expect(resultHigh[0].edgeRating).toBeGreaterThanOrEqual(1);
    expect(resultHigh[0].edgeRating).toBeLessThanOrEqual(10);
    expect(resultLow[0].edgeRating).toBeGreaterThanOrEqual(1);
    expect(resultLow[0].edgeRating).toBeLessThanOrEqual(10);
  });

  it('builds reasons from projection data', () => {
    const proj = makeProjection({
      reason: 'Favorable matchup',
      isHome: true,
      predGoals: 0.8,
      fantasyPoints: 4.0,
    });

    const result = transformMatchups([proj]);
    expect(result[0].reasons).toContain('Favorable matchup');
    expect(result[0].reasons).toContain('Home ice advantage');
    expect(result[0].reasons.some((r) => r.includes('goals'))).toBe(true);
  });

  it('adds fallback reason when reason field is empty', () => {
    const proj = makeProjection({ reason: '', isHome: false, predGoals: 0.1 });

    const result = transformMatchups([proj]);
    expect(result[0].reasons.length).toBeGreaterThan(0);
    expect(result[0].reasons.some((r) => r.includes('fantasy points'))).toBe(true);
  });

  it('returns fewer than 5 if fewer projections provided', () => {
    const projections = [makeProjection(), makeProjection({ playerId: 2 })];
    const result = transformMatchups(projections);
    expect(result).toHaveLength(2);
  });

  it('returns empty array for no projections', () => {
    expect(transformMatchups([])).toEqual([]);
  });
});

describe('transformInsight', () => {
  it('maps sentiment correctly', () => {
    expect(
      transformInsight({
        id: '1',
        text: 'Headline',
        shareText: 'Context',
        sentiment: 'positive',
        category: 'h2h',
      }).sentiment
    ).toBe('bullish');

    expect(
      transformInsight({
        id: '2',
        text: 'Bad news',
        shareText: 'Context',
        sentiment: 'negative',
        category: 'streak',
      }).sentiment
    ).toBe('bearish');

    expect(
      transformInsight({
        id: '3',
        text: 'Neutral',
        shareText: 'Context',
        sentiment: 'neutral',
        category: 'rest',
      }).sentiment
    ).toBe('surprising');
  });

  it('maps text to headline and shareText to context', () => {
    const result = transformInsight({
      id: '1',
      text: 'My headline',
      shareText: 'My context',
      sentiment: 'positive',
      category: 'player',
    });
    expect(result.headline).toBe('My headline');
    expect(result.context).toBe('My context');
  });
});

describe('buildAlertsFromGames', () => {
  it('creates goalie and lineup alerts for each game', () => {
    const games = [
      {
        id: 1001,
        gameDate: '2026-04-05',
        homeTeam: { abbrev: 'EDM' },
        awayTeam: { abbrev: 'CGY' },
      },
    ];

    const alerts = buildAlertsFromGames(games, new Set(), []);
    // 2 goalie alerts (one per team) + 1 lineup alert
    expect(alerts).toHaveLength(3);
    expect(alerts.filter((a) => a.type === 'goalie')).toHaveLength(2);
    expect(alerts.filter((a) => a.type === 'lineup')).toHaveLength(1);
  });

  it('filters out dismissed alerts', () => {
    const games = [
      {
        id: 1001,
        gameDate: '2026-04-05',
        homeTeam: { abbrev: 'EDM' },
        awayTeam: { abbrev: 'CGY' },
      },
    ];

    const dismissed = ['goalie-EDM-2026-04-05', 'lineup-1001'];
    const alerts = buildAlertsFromGames(games, new Set(), dismissed);
    // Only the away goalie alert should remain
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('goalie');
    expect(alerts[0].team).toBe('CGY');
  });

  it('returns empty array for no games', () => {
    expect(buildAlertsFromGames([], new Set(), [])).toEqual([]);
  });

  it('handles multiple games correctly', () => {
    const games = [
      {
        id: 1001,
        gameDate: '2026-04-05',
        homeTeam: { abbrev: 'EDM' },
        awayTeam: { abbrev: 'CGY' },
      },
      {
        id: 1002,
        gameDate: '2026-04-05',
        homeTeam: { abbrev: 'TOR' },
        awayTeam: { abbrev: 'MTL' },
      },
    ];

    const alerts = buildAlertsFromGames(games, new Set(), []);
    // 4 goalie alerts + 2 lineup alerts
    expect(alerts).toHaveLength(6);
    expect(alerts.filter((a) => a.type === 'goalie')).toHaveLength(4);
    expect(alerts.filter((a) => a.type === 'lineup')).toHaveLength(2);
  });

  it('sets correct team and message for alerts', () => {
    const games = [
      {
        id: 1001,
        gameDate: '2026-04-05',
        homeTeam: { abbrev: 'EDM' },
        awayTeam: { abbrev: 'CGY' },
      },
    ];

    const alerts = buildAlertsFromGames(games, new Set(), []);
    const edmGoalie = alerts.find((a) => a.team === 'EDM' && a.type === 'goalie');
    expect(edmGoalie).toBeDefined();
    expect(edmGoalie!.message).toContain('EDM');
    expect(edmGoalie!.message).toContain('CGY');
  });

  it('handles games with missing team data gracefully', () => {
    const games = [
      {
        id: 1001,
        gameDate: '2026-04-05',
        homeTeam: {},
        awayTeam: { abbrev: 'CGY' },
      },
    ];

    // Should not throw
    const alerts = buildAlertsFromGames(games, new Set(), []);
    // Only away goalie + lineup alert (no home goalie since abbrev is missing)
    expect(alerts.some((a) => a.team === 'CGY')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test factories
// ---------------------------------------------------------------------------

function makeProjection(overrides: Partial<PlayerProjection> = {}): PlayerProjection {
  return {
    playerId: 1,
    playerName: 'Test Player',
    teamAbbrev: 'TST',
    position: 'C',
    fantasyPoints: 3.0,
    floor: 1.0,
    ceiling: 5.0,
    predGoals: 0.3,
    predAssists: 0.5,
    predSog: 2.5,
    predHits: 1.0,
    predBlocks: 0.5,
    recommendation: 'START',
    confidence: 'medium',
    reason: 'Test reason',
    gameId: 2026040001,
    opponentAbbrev: 'OPP',
    isHome: true,
    ...overrides,
  };
}

function makeTrendingPlayer(
  overrides: Partial<TrendingPlayer> = {},
): TrendingPlayer {
  return {
    playerId: 1,
    playerName: 'Trending Player',
    firstName: 'Trending',
    lastName: 'Player',
    teamAbbrev: 'TST',
    position: 'C',
    trendLabel: 'STEADY',
    hotColdScore: 0,
    pointStreak: 0,
    recentPpg: 0.5,
    seasonPpg: 0.4,
    recentGpg: 0.2,
    seasonGpg: 0.15,
    recentShootingPct: 12,
    seasonShootingPct: 10,
    avgGoals5g: 0.3,
    avgAssists5g: 0.5,
    avgPoints5g: 0.8,
    avgShots5g: 3.0,
    avgGoals10g: 0.25,
    avgPoints10g: 0.7,
    gamesPlayed: 50,
    seasonGoals: 15,
    seasonAssists: 25,
    seasonPoints: 40,
    recentShotsPerGame: 3.2,
    seasonShotsPerGame: 2.8,
    ...overrides,
  };
}
