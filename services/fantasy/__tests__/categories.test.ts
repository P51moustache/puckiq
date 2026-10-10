jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { categoriesLabel, categoryWeights, isCategoryLeague, sanitizeCategories, YAHOO_DEFAULT_CATEGORIES } from '../categories';
import { buildNightScore, headlineRows, type NightScoreInput } from '../nightScore';
import { categoryLineText, nightTallies, savePctText, talliesLine, tileLineText } from '../nightTallies';
import { goaliePoints, scoringPresetFor, skaterPoints, YAHOO_POINTS_SCORING } from '../scoring';
import { createTeam, parseTeamsState, withLeagueFormat } from '../../teams';
import type { GameLine } from '../../nhl/gamecenter';
import type { DayPlan } from '../weekPlan';
import { game, player } from './fixtures';

/** A league-average start in the weights' reference group (2025-26, 20+ starts). */
const AVERAGE_START = { saves: 24.85, goalsAgainst: 2.905 };

describe('category weights', () => {
  const yahoo = categoryWeights(YAHOO_DEFAULT_CATEGORIES);

  it('counts hits and plus/minus in a Yahoo category league, and nothing it doesn’t count', () => {
    expect(yahoo.hits).toBeGreaterThan(0);
    expect(yahoo.plusMinus).toBeGreaterThan(0);
    expect(yahoo.blocks).toBe(0);
    // One standard deviation is half a unit: goals spread 0.15 a game → 3.333 per goal.
    expect(yahoo.goals).toBeCloseTo(3.333, 3);
  });

  it('makes a league-average start worth only its counting stats (W, SO), never a minus', () => {
    const rates = goaliePoints({ wins: 0, shutouts: 0, ...AVERAGE_START }, yahoo);
    expect(rates).toBeCloseTo(0, 1);
    expect(goaliePoints({ wins: 1, shutouts: 0, ...AVERAGE_START }, yahoo)).toBeGreaterThan(4);
    // Same shots, one goal fewer: better GAA and SV% → worth more; one more → worth less.
    const better = goaliePoints({ saves: AVERAGE_START.saves + 1, goalsAgainst: AVERAGE_START.goalsAgainst - 1 }, yahoo);
    const worse = goaliePoints({ saves: AVERAGE_START.saves - 1, goalsAgainst: AVERAGE_START.goalsAgainst + 1 }, yahoo);
    expect(better).toBeGreaterThan(1);
    expect(worse).toBeLessThan(-1);
  });

  it('values a banger the Yahoo points preset ignores', () => {
    const banger = { goals: 0, assists: 0, shots: 2, hits: 5 };
    const sniper = { goals: 1, assists: 0, shots: 2, hits: 0 };
    expect(skaterPoints(banger, YAHOO_POINTS_SCORING)).toBeLessThan(skaterPoints(sniper, YAHOO_POINTS_SCORING) / 3);
    expect(skaterPoints(banger, yahoo)).toBeGreaterThan(skaterPoints(sniper, yahoo) * 0.8);
  });

  it('adds a points category to both goals and assists', () => {
    const withPoints = categoryWeights(['goals', 'points']);
    expect(withPoints.goals).toBeGreaterThan(categoryWeights(['goals']).goals);
    expect(withPoints.assists).toBeGreaterThan(0);
  });

  it('cleans stored categories: known, once, in catalog order; none → Yahoo’s defaults', () => {
    expect(sanitizeCategories(['hits', 'goals', 'hits', 'faceoffs'])).toEqual(['goals', 'hits']);
    expect(sanitizeCategories([])).toEqual(YAHOO_DEFAULT_CATEGORIES);
    expect(sanitizeCategories('goals')).toEqual(YAHOO_DEFAULT_CATEGORIES);
    expect(categoriesLabel(YAHOO_DEFAULT_CATEGORIES)).toBe('G · A · +/- · PPP · SOG · HIT · W · GAA · SV% · SO');
  });
});

describe('league format on a team', () => {
  it('derives a category team’s weights, and restores the platform’s points when switching back', () => {
    const team = createTeam({ platform: 'yahoo', format: 'categories' });
    expect(isCategoryLeague(team)).toBe(true);
    expect(team.categories).toEqual(YAHOO_DEFAULT_CATEGORIES);
    expect(team.scoring).toEqual(categoryWeights(YAHOO_DEFAULT_CATEGORIES));

    const back = withLeagueFormat(team, 'points');
    expect(isCategoryLeague(back)).toBe(false);
    expect(back.categories).toBeUndefined();
    expect(back.scoring).toEqual(scoringPresetFor('yahoo'));
  });

  it('keeps a points team’s own scoring when it stays on points', () => {
    const team = createTeam({ platform: 'espn', scoring: { ...YAHOO_POINTS_SCORING, goals: 9 } });
    expect(withLeagueFormat(team, 'points').scoring.goals).toBe(9);
    expect(team.format).toBeUndefined();
  });

  it('re-derives stored category weights on load, and leaves older (points) teams alone', () => {
    const category = withLeagueFormat(createTeam({}), 'categories', ['goals', 'hits']);
    const points = createTeam({ scoring: YAHOO_POINTS_SCORING });
    const stored = JSON.parse(JSON.stringify({ activeTeamId: category.id, teams: [{ ...category, scoring: { goals: 99 } }, points] }));
    const [loadedCategory, loadedPoints] = parseTeamsState(stored).teams;
    expect(loadedCategory.categories).toEqual(['goals', 'hits']);
    expect(loadedCategory.scoring).toEqual(categoryWeights(['goals', 'hits']));
    expect(loadedPoints.format).toBeUndefined();
    expect(loadedPoints.scoring).toEqual(YAHOO_POINTS_SCORING);
  });
});

describe('night tallies', () => {
  const DATE = '2026-10-13';
  const skater = (playerId: number, stats: Partial<GameLine>): GameLine => ({
    playerId, isGoalie: false, goals: 0, assists: 0, points: 0, shots: 0, hits: 0, blocks: 0, plusMinus: 0,
    powerPlayGoals: 0, pim: 0, toi: '18:00', saves: 0, shotsAgainst: 0, goalsAgainst: 0, ...stats,
  });
  const mcdavid = player(1, 'Connor McDavid', 'EDM', 'C');
  const wilson = player(2, 'Tom Wilson', 'WSH', 'RW');
  const shesterkin = player(3, 'Igor Shesterkin', 'NYR', 'G');
  const edm = game(DATE, 'EDM', 'LAK', { id: 21, state: 'FINAL', homeScore: 1, awayScore: 4 });
  const wsh = game(DATE, 'WSH', 'PHI', { id: 22, state: 'LIVE', period: 2, clock: '10:00' });
  const nyr = game(DATE, 'NYR', 'BOS', { id: 23, state: 'FINAL', homeScore: 0, awayScore: 2 });
  const day: DayPlan = {
    date: DATE, dayAbbrev: 'TUE', leagueGames: 10, offNight: false, isPast: false, isToday: true,
    playing: [1, 2, 3], starters: [{ slot: 'C', playerId: 1 }, { slot: 'G', playerId: 3 }], bench: [2], empty: [],
  };
  const lines = new Map<number, GameLine>([
    [1, skater(1, { goals: 2, assists: 1, powerPlayGoals: 1, shots: 5, hits: 1, plusMinus: 2 })],
    [2, skater(2, { assists: 1, shots: 2, hits: 6, plusMinus: -1 })],
    [3, { ...skater(3, {}), isGoalie: true, toi: '60:00', saves: 30, shotsAgainst: 30, goalsAgainst: 0 }],
  ]);
  const input: NightScoreInput = {
    players: [mcdavid, wilson, shesterkin],
    playerGames: { 1: { gameId: 21, startTimeUTC: null }, 2: { gameId: 22, startTimeUTC: null }, 3: { gameId: 23, startTimeUTC: null } },
    games: [edm, wsh, nyr],
    lines,
    scoring: categoryWeights(YAHOO_DEFAULT_CATEGORIES),
    slots: { C: 1, LW: 0, RW: 0, F: 0, D: 0, UTIL: 0, G: 1 },
    day,
  };
  const score = buildNightScore(input);

  it('tallies everyone who played for free users, the lineup only for Pro', () => {
    const free = nightTallies(headlineRows(score, false), lines, YAHOO_DEFAULT_CATEGORIES);
    expect(talliesLine(free)).toBe('2 G · 2 A · +1 +/- · 1 PPP · 7 SOG · 7 HIT · 1 W · 0.00 GAA · 1.000 SV% · 1 SO');
    const pro = nightTallies(headlineRows(score, true), lines, YAHOO_DEFAULT_CATEGORIES);
    expect(pro.find((tally) => tally.key === 'hits')?.text).toBe('1');
    expect(pro.find((tally) => tally.key === 'plusMinus')?.text).toBe('+2');
  });

  it('waits for a goalie to play before showing his rates', () => {
    const skatersOnly = nightTallies(headlineRows(score, false).filter((row) => row.playerId !== 3), lines, ['wins', 'gaa', 'savePct']);
    expect(skatersOnly.map((tally) => tally.text)).toEqual(['0', '—', '—']);
    expect(savePctText(28, 30)).toBe('.933');
  });

  it('reads one player’s night in his league’s categories', () => {
    expect(categoryLineText(lines.get(1)!, YAHOO_DEFAULT_CATEGORIES)).toBe('2G · 1A · +2 +/- · 1 PPP · 5 SOG · 1 HIT');
    expect(categoryLineText(lines.get(2)!, ['goals', 'blocks'])).toBe('Nothing in your categories yet');
    expect(categoryLineText(lines.get(3)!, YAHOO_DEFAULT_CATEGORIES)).toBe('30 SV · 0 GA · 1.000');
    expect(tileLineText(lines.get(2)!)).toBe('1A');
  });
});
