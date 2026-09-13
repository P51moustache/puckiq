import type { ArenaGame } from '../../types/arena';
import { resolveSeasonContext } from '../seasonContext';

function game(overrides: Partial<ArenaGame> = {}): ArenaGame {
  return {
    id: 2026020001,
    season: 20262027,
    game_date: '2026-10-07',
    start_time_utc: '2026-10-07T23:00:00Z',
    game_type: 2,
    game_state: 'FUT',
    home_team_abbrev: 'EDM',
    away_team_abbrev: 'CGY',
    home_score: null,
    away_score: null,
    venue: null,
    updated_at: '2026-09-10T12:00:00Z',
    forecast: null,
    ...overrides,
  };
}

describe('resolveSeasonContext', () => {
  it.each([
    ['2026-07-15T16:00:00Z', 'offseason', 20262027, 'Offseason'],
    ['2026-09-20T16:00:00Z', 'preseason', 20262027, 'Preseason'],
    ['2026-10-07T16:00:00Z', 'regular', 20262027, 'Regular season'],
    ['2026-04-15T16:00:00Z', 'playoffs', 20252026, 'Playoffs'],
  ] as const)('uses an explicit calendar estimate on %s', (timestamp, phase, season, label) => {
    const result = resolveSeasonContext([], new Date(timestamp));
    expect(result).toMatchObject({ phase, season, label, confidence: 'calendar', nextGame: null, daysUntilNextGame: null });
    expect(result.note).toMatch(/estimated/i);
    expect(result.note).not.toMatch(/no games/i);
  });

  it('rolls the season on July 1 in NHL Eastern time rather than UTC', () => {
    expect(resolveSeasonContext([], new Date('2026-07-01T03:30:00Z')).season).toBe(20252026);
    expect(resolveSeasonContext([], new Date('2026-07-01T04:30:00Z')).season).toBe(20262027);
  });

  it('uses a fresh current schedule game to identify the phase', () => {
    const now = new Date('2026-04-10T16:00:00Z');
    const playoff = game({
      id: 2025030001,
      season: 20252026,
      game_date: '2026-04-10',
      start_time_utc: '2026-04-10T23:00:00Z',
      game_type: 3,
      updated_at: '2026-04-10T12:00:00Z',
    });
    expect(resolveSeasonContext([playoff], now)).toMatchObject({
      phase: 'playoffs', confidence: 'schedule', season: 20252026, nextGame: playoff, daysUntilNextGame: 0,
    });
  });

  it('keeps July in offseason while exposing a fresh distant September next game', () => {
    const now = new Date('2026-07-15T16:00:00Z');
    const preseason = game({
      id: 2026010001,
      game_date: '2026-09-20',
      start_time_utc: '2026-09-20T23:00:00Z',
      game_type: 1,
      updated_at: '2026-07-15T12:00:00Z',
    });
    expect(resolveSeasonContext([preseason], now)).toMatchObject({
      phase: 'offseason', confidence: 'calendar', nextGame: preseason, daysUntilNextGame: 67,
    });
  });

  it('does not let a future playoff game override a recently played regular-season phase', () => {
    const now = new Date('2026-04-05T16:00:00Z');
    const recentRegular = game({
      game_date: '2026-04-04',
      start_time_utc: '2026-04-04T23:00:00Z',
      game_state: 'FINAL',
      home_score: 3,
      away_score: 2,
      updated_at: '2026-04-05T12:00:00Z',
      season: 20252026,
    });
    const futurePlayoff = game({
      id: 2025030001,
      game_date: '2026-04-08',
      start_time_utc: '2026-04-08T23:00:00Z',
      game_type: 3,
      updated_at: '2026-04-05T12:00:00Z',
      season: 20252026,
    });
    expect(resolveSeasonContext([recentRegular, futurePlayoff], now)).toMatchObject({
      phase: 'regular', confidence: 'schedule', nextGame: futurePlayoff, daysUntilNextGame: 3,
    });
  });

  it('keeps September 10 in offseason when preseason is only upcoming', () => {
    const preseason = game({
      id: 2026010001,
      game_date: '2026-09-22',
      start_time_utc: '2026-09-22T23:00:00Z',
      game_type: 1,
      updated_at: '2026-09-10T12:00:00Z',
    });
    expect(resolveSeasonContext([preseason], new Date('2026-09-10T16:00:00Z'))).toMatchObject({
      phase: 'offseason', confidence: 'calendar', nextGame: preseason, daysUntilNextGame: 12,
    });
  });

  it('ignores months-old finals, stale active flags, and invalid source timestamps', () => {
    const now = new Date('2026-09-20T16:00:00Z');
    const result = resolveSeasonContext([
      game({ game_date: '2026-04-01', start_time_utc: '2026-04-01T23:00:00Z', game_state: 'FINAL', home_score: 3, away_score: 2, updated_at: '2026-09-20T12:00:00Z' }),
      game({ game_date: '2026-09-20', start_time_utc: '2026-09-20T23:00:00Z', game_state: 'LIVE', updated_at: '2026-09-01T12:00:00Z' }),
      game({ id: 2026010002, game_date: '2026-09-21', start_time_utc: 'bad', game_type: 1, updated_at: 'bad' }),
    ], now);
    expect(result).toMatchObject({ phase: 'preseason', confidence: 'calendar', nextGame: null, daysUntilNextGame: null });
  });

  it('counts Eastern calendar days across leap day and DST boundaries', () => {
    const leapNow = new Date('2028-02-28T17:00:00Z');
    const leapGame = game({
      id: 2027020001,
      season: 20272028,
      game_date: '2028-03-01',
      start_time_utc: '2028-03-02T00:00:00Z',
      updated_at: '2028-02-28T12:00:00Z',
    });
    expect(resolveSeasonContext([leapGame], leapNow).daysUntilNextGame).toBe(2);

    const dstNow = new Date('2026-03-08T04:30:00Z');
    const dstGame = game({
      id: 2025020002,
      season: 20252026,
      game_date: '2026-03-08',
      start_time_utc: '2026-03-08T23:00:00Z',
      updated_at: '2026-03-08T03:00:00Z',
    });
    expect(resolveSeasonContext([dstGame], dstNow).daysUntilNextGame).toBe(1);
  });

  it('rejects a source timestamp from the future even when the game is near', () => {
    const result = resolveSeasonContext([
      game({ game_date: '2026-09-21', start_time_utc: '2026-09-21T23:00:00Z', game_type: 1, updated_at: '2026-09-21T20:00:00Z' }),
    ], new Date('2026-09-20T16:00:00Z'));
    expect(result.confidence).toBe('calendar');
    expect(result.nextGame).toBeNull();
  });
});
