import { bigNightOf, buildNightScore, linePoints, newGoalScorers, teamWon, type NightScoreInput } from '../nightScore';
import { DEFAULT_SCORING } from '../scoring';
import { game, player } from './fixtures';
import type { GameLine } from '../../nhl/gamecenter';
import type { DayPlan } from '../weekPlan';
import type { LineupSlots } from '../../../types/fantasy';

const DATE = '2026-10-13';
const slots: LineupSlots = { C: 1, LW: 0, RW: 0, F: 0, D: 1, UTIL: 0, G: 1 };

function skater(playerId: number, stats: Partial<GameLine> = {}): GameLine {
  return {
    playerId, isGoalie: false, goals: 0, assists: 0, points: 0, shots: 0, hits: 0, blocks: 0, plusMinus: 0,
    powerPlayGoals: 0, pim: 0, toi: '18:00', saves: 0, shotsAgainst: 0, goalsAgainst: 0, ...stats,
  };
}

function goalie(playerId: number, stats: Partial<GameLine> = {}): GameLine {
  return { ...skater(playerId), isGoalie: true, toi: '60:00', ...stats };
}

const mcdavid = player(1, 'Connor McDavid', 'EDM', 'C');
const larkin = player(2, 'Dylan Larkin', 'DET', 'C');
const makar = player(3, 'Cale Makar', 'COL', 'D');
const oettinger = player(4, 'Jake Oettinger', 'DAL', 'G');
const late = player(5, 'Quinn Hughes', 'VAN', 'D');

const edm = game(DATE, 'EDM', 'LAK', { id: 11, startTimeUTC: `${DATE}T23:00:00Z` });
const det = game(DATE, 'DET', 'BOS', { id: 12, startTimeUTC: `${DATE}T23:30:00Z` });
const col = game(DATE, 'COL', 'MIN', { id: 13, startTimeUTC: `${DATE}T23:30:00Z` });
const dal = game(DATE, 'CHI', 'DAL', { id: 14, startTimeUTC: `${DATE}T23:30:00Z` });
const van = game(DATE, 'VAN', 'SEA', { id: 15, startTimeUTC: `${DATE}T02:30:00Z` });

/** PuckIQ's pre-game lineup: McDavid at C (Larkin benched), Makar at D, Oettinger in goal. */
const day: DayPlan = {
  date: DATE, dayAbbrev: 'TUE', leagueGames: 10, offNight: false, isPast: false, isToday: true,
  playing: [1, 2, 3, 4], starters: [{ slot: 'C', playerId: 1 }, { slot: 'D', playerId: 3 }, { slot: 'G', playerId: 4 }],
  bench: [2], empty: [],
};

function input(overrides: Partial<NightScoreInput> = {}): NightScoreInput {
  return {
    players: [mcdavid, larkin, makar, oettinger],
    playerGames: {
      1: { gameId: 11, startTimeUTC: edm.startTimeUTC },
      2: { gameId: 12, startTimeUTC: det.startTimeUTC },
      3: { gameId: 13, startTimeUTC: col.startTimeUTC },
      4: { gameId: 14, startTimeUTC: dal.startTimeUTC },
    },
    games: [edm, det, col, dal],
    lines: new Map(),
    scoring: DEFAULT_SCORING,
    slots,
    day,
    ...overrides,
  };
}

describe('linePoints', () => {
  it('scores a skater line with league weights (PPP = power-play goals)', () => {
    // 2 G (6) + 1 A (2) + 1 PPG (1) + 4 SOG (2) + 2 hits (1) = 12
    expect(linePoints(skater(1, { goals: 2, assists: 1, powerPlayGoals: 1, shots: 4, hits: 2 }), DEFAULT_SCORING)).toBe(12);
  });

  it('counts a goalie win and shutout only when final', () => {
    const line = goalie(4, { saves: 30, goalsAgainst: 0 });
    expect(linePoints(line, DEFAULT_SCORING, { final: false, won: true })).toBeCloseTo(6); // 30 × 0.2
    expect(linePoints(line, DEFAULT_SCORING, { final: true, won: true })).toBeCloseTo(14); // + win 5 + shutout 3
  });
});

describe('teamWon / bigNightOf', () => {
  it('reads the winner from either side', () => {
    expect(teamWon({ home: 'LAK', away: 'EDM', homeScore: 1, awayScore: 3 }, 'edm')).toBe(true);
    expect(teamWon({ home: 'LAK', away: 'EDM', homeScore: 1, awayScore: 3 }, 'LAK')).toBe(false);
    expect(teamWon({ home: 'LAK', away: 'EDM', homeScore: null, awayScore: null }, 'EDM')).toBe(false);
  });

  it('names the nights fans recognise', () => {
    expect(bigNightOf(skater(1, { goals: 3 }), false, false)).toBe('hat-trick');
    expect(bigNightOf(skater(1, { goals: 1, assists: 2 }), false, false)).toBe('three-points');
    expect(bigNightOf(skater(1, { goals: 1, assists: 1 }), true, true)).toBeNull();
    expect(bigNightOf(goalie(4, { saves: 41, goalsAgainst: 2 }), false, false)).toBe('forty-saves');
    expect(bigNightOf(goalie(4, { saves: 25, goalsAgainst: 0 }), false, true)).toBeNull();
    expect(bigNightOf(goalie(4, { saves: 25, goalsAgainst: 0 }), true, true)).toBe('shutout');
    expect(bigNightOf(undefined, true, true)).toBeNull();
  });
});

describe('buildNightScore', () => {
  it('is "pre" before any puck drop, in puck-drop order with no points', () => {
    const score = buildNightScore(input());
    expect(score.phase).toBe('pre');
    expect(score.upcoming).toBe(4);
    expect(score.players.map((row) => row.playerId)).toEqual([1, 2, 3, 4]);
    expect(score.players.every((row) => row.points === null)).toBe(true);
    expect(score.top).toBeNull();
    expect(score.hindsight).toBeNull();
  });

  it('scores live games, splits starters from the bench, and leads with the top performer', () => {
    const live = { state: 'LIVE', period: 2, clock: '10:15', homeScore: 1, awayScore: 2 };
    const score = buildNightScore(input({
      games: [{ ...edm, ...live }, { ...det, ...live, period: 3, clock: '04:00' }, col, dal],
      lines: new Map([
        [1, skater(1, { goals: 1, assists: 1, shots: 4 })], // 3 + 2 + 2 = 7
        [2, skater(2, { goals: 2, shots: 2 })], // 6 + 1 = 7 (no slot)
      ]),
    }));
    expect(score.phase).toBe('live');
    expect([score.live, score.final, score.upcoming]).toEqual([2, 0, 2]);
    expect(score.totalPoints).toBe(14);
    expect(score.starterPoints).toBe(7);
    expect(score.benchPoints).toBe(7);
    // Tie on points: the starter leads.
    expect(score.top?.playerId).toBe(1);
    expect(score.players.slice(0, 2).map((row) => row.role)).toEqual(['starter', 'bench']);
    expect(score.leadGame?.id).toBe(12); // third period beats second
  });

  it('grades the night in hindsight once every game is final', () => {
    const final = { state: 'OFF', homeScore: 1, awayScore: 4 };
    const score = buildNightScore(input({
      games: [{ ...edm, ...final }, { ...det, ...final }, { ...col, ...final }, { ...dal, ...final, homeScore: 3, awayScore: 0 }],
      lines: new Map([
        [1, skater(1, { assists: 1 })], // 2
        [2, skater(2, { goals: 3, shots: 6 })], // 9 + 3 = 12, hat trick, benched pre-game
        [3, skater(3, { shots: 2 })], // 1
        [4, goalie(4, { saves: 30, goalsAgainst: 0 })], // 6 + 5 + 3 = 14 shutout
      ]),
    }));
    expect(score.phase).toBe('final');
    expect(score.starterPoints).toBe(17); // 2 + 1 + 14
    expect(score.benchPoints).toBe(12);
    expect(score.hindsight).toEqual({ best: 27, captured: 17, share: 17 / 27 });
    expect(score.players.find((row) => row.playerId === 2)?.bigNight).toBe('hat-trick');
    expect(score.players.find((row) => row.playerId === 4)?.bigNight).toBe('shutout');
    expect(score.top?.playerId).toBe(4);
    expect(score.leadGame).toBeNull();
  });

  it('leaves out scratches and IR, and has no hindsight without a lineup', () => {
    const final = { state: 'FINAL', homeScore: 2, awayScore: 1 };
    const score = buildNightScore(input({
      players: [mcdavid, larkin, makar, { ...oettinger, injuredReserve: true }, late],
      playerGames: { ...input().playerGames, 5: { gameId: 15, startTimeUTC: van.startTimeUTC } },
      games: [{ ...edm, ...final }, { ...det, ...final }, { ...col, ...final }, { ...dal, ...final }, { ...van, ...final }],
      lines: new Map([[1, skater(1, { goals: 1 })]]),
      scratched: new Set([2]),
      day: null,
    }));
    expect(score.players.map((row) => row.playerId).sort()).toEqual([1, 3, 5]);
    expect(score.players.every((row) => row.role === 'unplanned')).toBe(true);
    expect(score.hindsight).toBeNull();
    expect(score.totalPoints).toBe(3);
  });
});

describe('newGoalScorers', () => {
  it('flags goals scored since the last refresh, not first sightings', () => {
    const before = new Map([[1, skater(1, { goals: 1 })], [2, skater(2)]]);
    const after = new Map([[1, skater(1, { goals: 2 })], [2, skater(2)], [3, skater(3, { goals: 1 })]]);
    expect(newGoalScorers(before, after)).toEqual([1]);
  });
});
