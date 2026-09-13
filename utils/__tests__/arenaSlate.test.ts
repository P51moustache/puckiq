import { formatFinalScore, selectArchiveGames, selectCurrentArenaGames } from '../arenaSlate';
import type { ArenaGame } from '../../types/arena';

const now = new Date('2026-10-06T04:15:00Z');
const base = {
  id: 2026020001,
  season: 20262027,
  game_type: 2,
  game_date: '2026-10-05',
  start_time_utc: '2026-10-06T02:00:00Z',
  updated_at: '2026-10-06T04:12:00Z',
  game_state: 'LIVE',
} as ArenaGame;

const makeGame = (overrides: Partial<ArenaGame> = {}) => ({
  id: 2026020001,
  season: 20262027,
  game_type: 2,
  game_date: '2026-10-06',
  start_time_utc: '2026-10-07T00:00:00Z',
  updated_at: null,
  game_state: 'FUT',
  home_team_abbrev: 'BOS',
  away_team_abbrev: 'NYR',
  home_score: null,
  away_score: null,
  venue: null,
  forecast: null,
  freshness: {
    source: { asOf: null, ageHours: null, status: 'unknown' },
    prediction: { asOf: null, ageHours: null, status: 'unknown' },
    forecastUnavailable: true,
  },
  ...overrides,
} as ArenaGame);

it('keeps a fresh late game across NHL Eastern midnight', () => {
  expect(selectCurrentArenaGames([base],now)).toEqual([base]);
});

it('excludes old or unverified live flags while keeping recent finals and upcoming games', () => {
  const final = { ...base, id: 2, game_state: 'OFF' };
  const upcoming = { ...base, id: 3, game_state: 'FUT', game_date: '2026-10-08', start_time_utc: '2026-10-09T00:00:00Z' };
  const stale = { ...base, id: 4, updated_at: '2026-10-01T00:00:00Z' };
  const old = { ...base, id: 5, game_date: '2026-05-04', game_state: 'OFF' };

  expect(selectCurrentArenaGames([stale, final, upcoming, old], now)).toEqual([final, upcoming]);
});

it('keeps legitimate future games with unavailable source freshness', () => {
  const future = makeGame({ id: 6, game_date: '2026-10-08', start_time_utc: '2026-10-09T00:00:00Z' });

  expect(selectCurrentArenaGames([future], now)).toEqual([future]);
});

it('excludes stale future and stale live games without dropping a fresh future game', () => {
  const freshFuture = makeGame({
    id: 7,
    game_date: '2026-10-08',
    start_time_utc: '2026-10-09T00:00:00Z',
    updated_at: '2026-10-06T04:00:00Z',
    freshness: {
      source: { asOf: '2026-10-06T04:00:00Z', ageHours: 0.25, status: 'fresh' },
      prediction: { asOf: null, ageHours: null, status: 'unknown' },
      forecastUnavailable: true,
    },
  });
  const staleFuture = makeGame({
    id: 8,
    game_date: '2026-10-08',
    start_time_utc: '2026-10-09T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    freshness: {
      source: { asOf: '2026-10-01T00:00:00Z', ageHours: 148, status: 'stale' },
      prediction: { asOf: null, ageHours: null, status: 'unknown' },
      forecastUnavailable: true,
    },
  });
  const staleLive = { ...base, id: 9, updated_at: '2026-10-01T00:00:00Z' };

  expect(selectCurrentArenaGames([staleFuture, freshFuture, staleLive], now)).toEqual([freshFuture]);
});

it('keeps future current-slate rows in the resolved season without filtering archive history', () => {
  const otherSeasonFuture = makeGame({ id: 17, season: 20252026, game_date: '2026-10-08', start_time_utc: '2026-10-09T00:00:00Z' });

  expect(selectCurrentArenaGames([otherSeasonFuture], now, 20262027)).toEqual([]);
  expect(selectArchiveGames([otherSeasonFuture])).toEqual([]);
});

it('rejects malformed dates, unknown states, and FUT games whose kickoff has passed', () => {
  const malformedDate = makeGame({ id: 18, game_date: '2026-02-30', start_time_utc: '2026-03-01T00:00:00Z' });
  const unknownState = makeGame({ id: 19, game_state: 'UNKNOWN' });
  const passedKickoff = makeGame({ id: 20, start_time_utc: '2026-10-06T04:00:00Z' });

  expect(selectCurrentArenaGames([malformedDate, unknownState, passedKickoff], now)).toEqual([]);
});

it('archives only completed games with known valid scores across seasons', () => {
  const historicalFinal = makeGame({
    id: 10,
    season: 20242025,
    game_date: '2025-04-20',
    start_time_utc: '2025-04-21T00:00:00Z',
    game_state: 'FINAL',
    home_score: 4,
    away_score: 2,
    updated_at: '2025-04-21T03:00:00Z',
    freshness: {
      source: { asOf: '2025-04-21T03:00:00Z', ageHours: 12000, status: 'stale' },
      prediction: { asOf: null, ageHours: null, status: 'unknown' },
      forecastUnavailable: true,
    },
  });
  const currentFinal = makeGame({ id: 11, game_state: 'OFF', home_score: 3, away_score: 1 });
  const missingScore = makeGame({ id: 12, game_state: 'FINAL', home_score: null, away_score: 1 });
  const malformedScore = makeGame({ id: 13, game_state: 'FINAL', home_score: 2.5, away_score: 1 });
  const negativeScore = makeGame({ id: 14, game_state: 'FINAL', home_score: -1, away_score: 1 });
  const live = makeGame({ id: 15, game_state: 'LIVE', home_score: 2, away_score: 1 });
  const future = makeGame({ id: 16, game_state: 'FUT', home_score: null, away_score: null });
  const futureFinal = makeGame({
    id: 21,
    game_date: '2026-10-07',
    start_time_utc: '2026-10-08T00:00:00Z',
    game_state: 'FINAL',
    home_score: 3,
    away_score: 2,
  });

  expect(selectArchiveGames([
    missingScore,
    historicalFinal,
    live,
    currentFinal,
    malformedScore,
    negativeScore,
    future,
  ], now)).toEqual([historicalFinal, currentFinal]);
  expect(selectArchiveGames([futureFinal], now)).toEqual([]);
});

it('formats unknown final scores honestly', () => {
  expect(formatFinalScore(makeGame({ home_score: 3, away_score: 2 }))).toBe('2–3');
  expect(formatFinalScore(makeGame({ home_score: null, away_score: null }))).toBe('SCORE UNAVAILABLE');
  expect(formatFinalScore(makeGame({ home_score: 2.5, away_score: 1 }))).toBe('SCORE UNAVAILABLE');
});
