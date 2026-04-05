import {
  analyzeMatchup,
  CATEGORIES,
  CLOSE_THRESHOLD,
  sumCategory,
  determineEdge,
  findSwingPlayers,
  generateRecommendation,
  CategoryResult,
} from '../matchupAnalysis';
import type { PlayerProjection } from '../../types/fantasy';

// ---------------------------------------------------------------------------
// Mock fantasyProjections
// ---------------------------------------------------------------------------

let mockMyProjections: PlayerProjection[] = [];
let mockOppProjections: PlayerProjection[] = [];

jest.mock('../fantasyProjections', () => ({
  getProjectionsForRoster: jest.fn((playerIds: number[]) => {
    // Distinguish my roster from opponent based on which IDs are passed
    if (playerIds.length > 0 && playerIds[0] >= 9000000) {
      return Promise.resolve(mockOppProjections);
    }
    return Promise.resolve(mockMyProjections);
  }),
}));

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeProjection(overrides: Partial<PlayerProjection> = {}): PlayerProjection {
  return {
    playerId: 8478402,
    playerName: 'Connor McDavid',
    teamAbbrev: 'EDM',
    position: 'C',
    fantasyPoints: 8.5,
    floor: 3.0,
    ceiling: 15.0,
    predGoals: 0.6,
    predAssists: 1.2,
    predSog: 4.0,
    predHits: 0.5,
    predBlocks: 0.3,
    recommendation: 'START',
    confidence: 'high',
    reason: 'Elite matchup',
    gameId: 2025020100,
    opponentAbbrev: 'TOR',
    isHome: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Unit tests: sumCategory
// ---------------------------------------------------------------------------

describe('sumCategory', () => {
  it('sums a stat across multiple projections', () => {
    const projections = [
      makeProjection({ predGoals: 0.5 }),
      makeProjection({ predGoals: 0.8 }),
      makeProjection({ predGoals: 0.3 }),
    ];
    expect(sumCategory(projections, 'predGoals')).toBeCloseTo(1.6);
  });

  it('returns 0 for empty array', () => {
    expect(sumCategory([], 'predGoals')).toBe(0);
  });

  it('handles zero values', () => {
    const projections = [
      makeProjection({ predHits: 0 }),
      makeProjection({ predHits: 0 }),
    ];
    expect(sumCategory(projections, 'predHits')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: determineEdge
// ---------------------------------------------------------------------------

describe('determineEdge', () => {
  it('returns winning when myTotal is significantly higher', () => {
    expect(determineEdge(10, 5)).toBe('winning');
  });

  it('returns losing when oppTotal is significantly higher', () => {
    expect(determineEdge(5, 10)).toBe('losing');
  });

  it('returns close when within threshold', () => {
    // 9.5 vs 10: diff = 0.5/10 = 5% < 10%
    expect(determineEdge(9.5, 10)).toBe('close');
  });

  it('returns close when both are zero', () => {
    expect(determineEdge(0, 0)).toBe('close');
  });

  it('returns losing when my total is 0 and opp has value', () => {
    expect(determineEdge(0, 5)).toBe('losing');
  });

  it('edge case: exactly at threshold boundary', () => {
    // diff = 1/10 = 10% = threshold => should be close
    expect(determineEdge(9, 10)).toBe('close');
  });
});

// ---------------------------------------------------------------------------
// Unit tests: findSwingPlayers
// ---------------------------------------------------------------------------

describe('findSwingPlayers', () => {
  it('returns top contributors sorted by stat', () => {
    const projections = [
      makeProjection({ playerName: 'Player A', predHits: 3.0 }),
      makeProjection({ playerName: 'Player B', predHits: 1.0 }),
      makeProjection({ playerName: 'Player C', predHits: 5.0 }),
    ];
    const result = findSwingPlayers(projections, 'predHits', 2);
    expect(result).toEqual(['Player C', 'Player A']);
  });

  it('filters out players with zero contribution', () => {
    const projections = [
      makeProjection({ playerName: 'Player A', predBlocks: 0 }),
      makeProjection({ playerName: 'Player B', predBlocks: 2.0 }),
    ];
    const result = findSwingPlayers(projections, 'predBlocks', 3);
    expect(result).toEqual(['Player B']);
  });

  it('returns empty array for empty projections', () => {
    expect(findSwingPlayers([], 'predGoals')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: generateRecommendation
// ---------------------------------------------------------------------------

describe('generateRecommendation', () => {
  it('returns maintenance message when all winning', () => {
    const categories: CategoryResult[] = [
      { category: 'Goals', myTotal: 5, oppTotal: 2, edge: 'winning' },
      { category: 'Assists', myTotal: 8, oppTotal: 3, edge: 'winning' },
    ];
    expect(generateRecommendation(categories)).toContain('Maintain your current lineup');
  });

  it('recommends focusing on closest losing category', () => {
    const categories: CategoryResult[] = [
      { category: 'Goals', myTotal: 3, oppTotal: 5, edge: 'losing', swingPlayers: ['McDavid'] },
      { category: 'Hits', myTotal: 1, oppTotal: 10, edge: 'losing', swingPlayers: ['Reaves'] },
    ];
    const result = generateRecommendation(categories);
    // Goals has smaller gap (2) vs Hits (9), so should recommend Goals
    expect(result).toContain('Goals');
    expect(result).toContain('McDavid');
  });

  it('suggests streaming when no swing players', () => {
    const categories: CategoryResult[] = [
      { category: 'Blocks', myTotal: 2, oppTotal: 5, edge: 'losing' },
    ];
    const result = generateRecommendation(categories);
    expect(result).toContain('Blocks');
    expect(result).toContain('streaming');
  });
});

// ---------------------------------------------------------------------------
// Integration tests: analyzeMatchup
// ---------------------------------------------------------------------------

describe('analyzeMatchup', () => {
  beforeEach(() => {
    mockMyProjections = [];
    mockOppProjections = [];
  });

  it('returns all-close result for empty rosters', async () => {
    const result = await analyzeMatchup([], [], 'yahoo', '2026-04-04');

    expect(result.categories).toHaveLength(CATEGORIES.length);
    expect(result.myWins).toBe(0);
    expect(result.oppWins).toBe(0);
    expect(result.closeCategories).toBe(CATEGORIES.length);
    expect(result.recommendation).toContain('Add players');
  });

  it('correctly identifies winning and losing categories', async () => {
    mockMyProjections = [
      makeProjection({ predGoals: 2.0, predAssists: 0.5, predSog: 5.0, predHits: 1.0, predBlocks: 0.5 }),
    ];
    mockOppProjections = [
      makeProjection({
        playerId: 9000001,
        predGoals: 0.5,
        predAssists: 2.0,
        predSog: 2.0,
        predHits: 4.0,
        predBlocks: 0.3,
      }),
    ];

    const result = await analyzeMatchup([8478402], [9000001], 'yahoo', '2026-04-04');

    const goals = result.categories.find(c => c.category === 'Goals')!;
    expect(goals.edge).toBe('winning');
    expect(goals.myTotal).toBe(2.0);
    expect(goals.oppTotal).toBe(0.5);

    const assists = result.categories.find(c => c.category === 'Assists')!;
    expect(assists.edge).toBe('losing');

    const hits = result.categories.find(c => c.category === 'Hits')!;
    expect(hits.edge).toBe('losing');

    expect(result.myWins).toBeGreaterThan(0);
    expect(result.oppWins).toBeGreaterThan(0);
  });

  it('sums stats across multiple players', async () => {
    mockMyProjections = [
      makeProjection({ playerName: 'Player 1', predGoals: 0.5 }),
      makeProjection({ playerName: 'Player 2', predGoals: 0.8 }),
    ];
    mockOppProjections = [
      makeProjection({ playerId: 9000001, predGoals: 0.3 }),
    ];

    const result = await analyzeMatchup([1, 2], [9000001], 'yahoo', '2026-04-04');
    const goals = result.categories.find(c => c.category === 'Goals')!;
    expect(goals.myTotal).toBeCloseTo(1.3);
    expect(goals.oppTotal).toBeCloseTo(0.3);
  });

  it('adds swing players for close/losing categories', async () => {
    mockMyProjections = [
      makeProjection({ playerName: 'McDavid', predHits: 0.5 }),
      makeProjection({ playerName: 'Draisaitl', predHits: 0.3 }),
    ];
    mockOppProjections = [
      makeProjection({ playerId: 9000001, predHits: 5.0 }),
    ];

    const result = await analyzeMatchup([1, 2], [9000001], 'yahoo', '2026-04-04');
    const hits = result.categories.find(c => c.category === 'Hits')!;
    expect(hits.edge).toBe('losing');
    expect(hits.swingPlayers).toBeDefined();
    expect(hits.swingPlayers!.length).toBeGreaterThan(0);
  });

  it('does not add swing players for winning categories', async () => {
    mockMyProjections = [
      makeProjection({ predGoals: 5.0 }),
    ];
    mockOppProjections = [
      makeProjection({ playerId: 9000001, predGoals: 0.1 }),
    ];

    const result = await analyzeMatchup([1], [9000001], 'yahoo', '2026-04-04');
    const goals = result.categories.find(c => c.category === 'Goals')!;
    expect(goals.edge).toBe('winning');
    expect(goals.swingPlayers).toBeUndefined();
  });

  it('generates a recommendation string', async () => {
    mockMyProjections = [
      makeProjection({ predGoals: 0.5, predHits: 0.1 }),
    ];
    mockOppProjections = [
      makeProjection({ playerId: 9000001, predGoals: 0.5, predHits: 5.0 }),
    ];

    const result = await analyzeMatchup([1], [9000001], 'yahoo', '2026-04-04');
    expect(result.recommendation).toBeTruthy();
    expect(typeof result.recommendation).toBe('string');
  });
});
