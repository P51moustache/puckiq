import { buildGoalieForm, buildSkaterForm } from '../form';
import { DEFAULT_SCORING, formatValue, goaliePoints, sanitizeScoring, skaterPoints } from '../scoring';
import type { GoalieLine, SkaterLine } from '../../nhl/stats';

function skater(gp: number, goals: number, assists: number, extra: Partial<SkaterLine> = {}): SkaterLine {
  return {
    playerId: 1,
    name: 'Test',
    position: 'C',
    team: 'EDM',
    gp,
    goals,
    assists,
    points: goals + assists,
    ppp: 0,
    shots: 0,
    hits: 0,
    blocks: 0,
    plusMinus: 0,
    toiPerGame: 1000,
    ...extra,
  };
}

function goalie(gs: number, wins: number, saves: number, ga: number, so = 0): GoalieLine {
  return {
    playerId: 2,
    name: 'Goalie',
    team: 'BOS',
    gp: gs,
    gs,
    wins,
    saves,
    shotsAgainst: saves + ga,
    goalsAgainst: ga,
    shutouts: so,
    savePct: saves / (saves + ga),
    gaa: 0,
  };
}

describe('scoring', () => {
  it('applies the default points weights', () => {
    expect(skaterPoints({ goals: 1, assists: 1, shots: 4, hits: 2 })).toBe(3 + 2 + 2 + 1);
    expect(goaliePoints({ wins: 1, saves: 30, goalsAgainst: 2 })).toBe(5 + 6 - 2);
  });

  it('formats without negative zero and sanitizes user weights', () => {
    expect(formatValue(-0.01)).toBe('0.0');
    expect(sanitizeScoring({ goals: 4, hits: Number.NaN })).toMatchObject({ goals: 4, hits: DEFAULT_SCORING.hits });
  });
});

describe('buildSkaterForm', () => {
  it('uses last season before opening night', () => {
    const form = buildSkaterForm(1, { previous: skater(80, 40, 40) });
    expect(form.basis).toBe('previous');
    expect(form.seasonRate).toBeCloseTo((40 * 3 + 40 * 2) / 80);
    expect(form.trend).toBe('unknown');
  });

  it('blends a thin current season with last season', () => {
    const form = buildSkaterForm(1, { current: skater(2, 4, 0), previous: skater(80, 20, 20) });
    expect(form.basis).toBe('blended');
    const prevRate = (20 * 3 + 20 * 2) / 80;
    expect(form.seasonRate).toBeCloseTo((12 + prevRate * 10) / 12);
  });

  it('weights recent form and flags a hot streak', () => {
    const form = buildSkaterForm(1, { current: skater(40, 10, 10), recent: skater(6, 5, 5) });
    expect(form.basis).toBe('current');
    expect(form.trend).toBe('hot');
    expect(form.value).toBeGreaterThan(form.seasonRate);
  });
});

describe('buildGoalieForm', () => {
  it('scales value per start by start share', () => {
    const form = buildGoalieForm(2, { current: goalie(30, 18, 800, 70), teamGamesPlayed: 40 });
    expect(form.isGoalie).toBe(true);
    expect(form.startShare).toBeCloseTo(0.75);
    const perStart = (18 * 5 + 800 * 0.2 - 70) / 30;
    expect(form.value).toBeCloseTo(perStart * 0.75);
  });

  it('falls back to last season share when the season has not started', () => {
    const form = buildGoalieForm(2, { previous: goalie(41, 20, 1000, 100) });
    expect(form.basis).toBe('previous');
    expect(form.startShare).toBeCloseTo(41 / 82);
  });
});
