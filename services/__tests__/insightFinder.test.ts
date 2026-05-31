import {
  detectGoalieInsights,
  detectPdoRegression,
  detectShootingRegression,
  detectSkaterTrends,
  rankAndFilter,
  type GoalieRollingRow,
  type SkaterTrendRow,
} from '../insightFinder';
import type { Insight } from '../../types/insights';

// Helper to build a skater row with sensible, eligible defaults.
function skater(overrides: Partial<SkaterTrendRow> = {}): SkaterTrendRow {
  return {
    player_id: 1,
    player_name: 'Test Skater',
    team_abbrev: 'TOR',
    position: 'C',
    games_played: 20,
    season_points: 30,
    season_ppg: 0.9,
    recent_ppg: 0.9,
    hot_cold_score: 0,
    trend_label: 'STEADY',
    point_streak: 0,
    recent_shooting_pct: 12,
    season_shooting_pct: 12,
    avg_pdo_5g: null,
    season_pdo: null,
    ...overrides,
  };
}

function goalie(overrides: Partial<GoalieRollingRow> = {}): GoalieRollingRow {
  return {
    player_id: 100,
    team_abbrev: 'BOS',
    starts: 12,
    save_pct_5g: 0.91,
    season_save_pct: 0.91,
    avg_ga_5g: 2.5,
    wins_5g: 3,
    ...overrides,
  };
}

describe('detectSkaterTrends', () => {
  it('flags a hot skater as a positive trend at simple depth', () => {
    const out = detectSkaterTrends([
      skater({ trend_label: 'HOT', recent_ppg: 1.4, point_streak: 4, hot_cold_score: 1.8 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('trend');
    expect(out[0].sentiment).toBe('positive');
    expect(out[0].depth).toBe(1);
    expect(out[0].playerId).toBe(1);
  });

  it('flags a cold skater as a negative trend at standard depth', () => {
    const out = detectSkaterTrends([
      skater({ trend_label: 'COLD', recent_ppg: 0.2, season_ppg: 0.9, hot_cold_score: -1.7 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].sentiment).toBe('negative');
    expect(out[0].depth).toBe(2);
  });

  it('surfaces a long point streak even when the label is steady', () => {
    const out = detectSkaterTrends([skater({ trend_label: 'STEADY', point_streak: 6 })]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain('6-game point streak');
  });

  it('ignores small-sample / low-production players', () => {
    expect(detectSkaterTrends([skater({ trend_label: 'HOT', games_played: 8 })])).toHaveLength(0);
    expect(detectSkaterTrends([skater({ trend_label: 'HOT', season_points: 2 })])).toHaveLength(0);
  });
});

describe('detectShootingRegression', () => {
  it('flags an over-performing shooter as neutral regression watch', () => {
    const out = detectShootingRegression([
      skater({ recent_shooting_pct: 22, season_shooting_pct: 12 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('regression');
    expect(out[0].sentiment).toBe('neutral');
    expect(out[0].depth).toBe(2);
  });

  it('flags a snakebitten shooter as a positive bounce-back candidate', () => {
    const out = detectShootingRegression([
      skater({ recent_shooting_pct: 4, season_shooting_pct: 14 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].sentiment).toBe('positive');
  });

  it('ignores small shooting% gaps', () => {
    expect(
      detectShootingRegression([skater({ recent_shooting_pct: 13, season_shooting_pct: 12 })]),
    ).toHaveLength(0);
  });
});

describe('detectPdoRegression', () => {
  it('returns nothing when advanced PDO data is missing', () => {
    expect(detectPdoRegression([skater({ avg_pdo_5g: null })])).toHaveLength(0);
  });

  it('flags high PDO as advanced-depth regression', () => {
    const out = detectPdoRegression([skater({ avg_pdo_5g: 103.5, season_pdo: 100.5 })]);
    expect(out).toHaveLength(1);
    expect(out[0].depth).toBe(3);
    expect(out[0].sentiment).toBe('neutral');
  });

  it('flags low PDO as a positive bounce-back', () => {
    const out = detectPdoRegression([skater({ avg_pdo_5g: 96, season_pdo: 99 })]);
    expect(out).toHaveLength(1);
    expect(out[0].sentiment).toBe('positive');
  });
});

describe('detectGoalieInsights', () => {
  const names = new Map([[100, { firstName: 'Test', lastName: 'Goalie' }]]);

  it('flags a hot goalie at simple depth', () => {
    const out = detectGoalieInsights([goalie({ save_pct_5g: 0.935, season_save_pct: 0.91 })], names);
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('goalie');
    expect(out[0].depth).toBe(1);
    expect(out[0].sentiment).toBe('positive');
  });

  it('flags above-season save% as neutral regression watch', () => {
    const out = detectGoalieInsights([goalie({ save_pct_5g: 0.925, season_save_pct: 0.9 })], names);
    expect(out).toHaveLength(1);
    expect(out[0].sentiment).toBe('neutral');
    expect(out[0].depth).toBe(2);
  });

  it('flags below-season save% as a positive bounce-back', () => {
    const out = detectGoalieInsights([goalie({ save_pct_5g: 0.88, season_save_pct: 0.91 })], names);
    expect(out).toHaveLength(1);
    expect(out[0].sentiment).toBe('positive');
  });

  it('ignores goalies under the start threshold or missing data', () => {
    expect(detectGoalieInsights([goalie({ starts: 3 })], names)).toHaveLength(0);
    expect(detectGoalieInsights([goalie({ save_pct_5g: null })], names)).toHaveLength(0);
  });
});

describe('rankAndFilter', () => {
  const base: Insight[] = [
    { id: 'a', text: 'A', category: 'trend', sentiment: 'positive', shareText: 'A', depth: 1, teamAbbrev: 'TOR', playerId: 1, severity: 50 },
    { id: 'b', text: 'B', category: 'regression', sentiment: 'neutral', shareText: 'B', depth: 2, teamAbbrev: 'BOS', playerId: 2, severity: 90 },
    { id: 'c', text: 'C', category: 'regression', sentiment: 'neutral', shareText: 'C', depth: 3, teamAbbrev: 'TOR', playerId: 3, severity: 80 },
  ];

  it('filters out insights deeper than the selected depth', () => {
    const out = rankAndFilter(base, { depth: 1, teams: null, limit: 50 });
    expect(out.map((i) => i.id)).toEqual(['a']);
  });

  it('sorts by severity descending', () => {
    const out = rankAndFilter(base, { depth: 3, teams: null, limit: 50 });
    expect(out.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('filters to favourite teams when provided', () => {
    const out = rankAndFilter(base, { depth: 3, teams: new Set(['TOR']), limit: 50 });
    expect(out.map((i) => i.id).sort()).toEqual(['a', 'c']);
  });

  it('keeps the strongest insight per player+category and respects the limit', () => {
    const dupes: Insight[] = [
      { id: 'lo', text: 'lo', category: 'trend', sentiment: 'positive', shareText: 'lo', depth: 1, playerId: 7, severity: 10 },
      { id: 'hi', text: 'hi', category: 'trend', sentiment: 'positive', shareText: 'hi', depth: 1, playerId: 7, severity: 99 },
    ];
    const out = rankAndFilter(dupes, { depth: 1, teams: null, limit: 1 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('hi');
  });
});
