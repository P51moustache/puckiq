import {
  TYPICAL_GAME_MS,
  formatGameTime,
  getGameLiveStatus,
  isLiveGame,
  livePrefixLabel,
} from '../gameStatus';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-10-15T00:00:00.000Z');

function game(overrides: Record<string, unknown> = {}) {
  return {
    gameState: 'FUT',
    startTimeUTC: '2026-10-15T01:00:00.000Z',
    period: null,
    clock: null,
    awayTeam: { score: 0 },
    homeTeam: { score: 0 },
    ...overrides,
  };
}

describe('isLiveGame', () => {
  it('treats LIVE and CRIT as live', () => {
    expect(isLiveGame(game({ gameState: 'LIVE' }), NOW)).toBe(true);
    expect(isLiveGame(game({ gameState: 'CRIT' }), NOW)).toBe(true);
  });

  it('never treats FINAL or OFF as live', () => {
    expect(isLiveGame(game({
      gameState: 'FINAL',
      startTimeUTC: '2026-10-14T21:00:00.000Z',
    }), NOW)).toBe(false);
    expect(isLiveGame(game({ gameState: 'OFF' }), NOW)).toBe(false);
  });

  it('does not treat PRE as live before puck drop', () => {
    expect(isLiveGame(game({
      gameState: 'PRE',
      startTimeUTC: '2026-10-15T01:00:00.000Z',
    }), NOW)).toBe(false);
  });

  it('treats FUT/PRE as live after puck drop inside the typical window', () => {
    const start = '2026-10-14T22:00:00.000Z';
    expect(isLiveGame(game({ gameState: 'FUT', startTimeUTC: start }), NOW)).toBe(true);
    expect(isLiveGame(game({ gameState: 'PRE', startTimeUTC: start }), NOW)).toBe(true);
  });

  it('stops inferring live after the typical game window', () => {
    const start = new Date(NOW - TYPICAL_GAME_MS).toISOString();
    expect(isLiveGame(game({ gameState: 'FUT', startTimeUTC: start }), NOW)).toBe(false);
    const almostOver = new Date(NOW - TYPICAL_GAME_MS + 60_000).toISOString();
    expect(isLiveGame(game({ gameState: 'FUT', startTimeUTC: almostOver }), NOW)).toBe(true);
  });

  it('does not infer live without a start time', () => {
    expect(isLiveGame(game({ gameState: 'FUT', startTimeUTC: undefined }), NOW)).toBe(false);
    expect(isLiveGame(game({ gameState: 'PRE', startTimeUTC: null }), NOW)).toBe(false);
  });
});

describe('getGameLiveStatus / formatGameTime', () => {
  it('never emits P0 when period and clock are missing', () => {
    const status = getGameLiveStatus(game({ gameState: 'LIVE', period: 0 }), NOW);
    expect(status.isLive).toBe(true);
    expect(status.detail).not.toMatch(/P0/);
    expect(status.periodClock).toBeNull();
    expect(status.score).toBeNull();
    expect(livePrefixLabel(status.detail)).toBe('LIVE');
  });

  it('keeps real period, clock, and score when they exist', () => {
    const formatted = formatGameTime(game({
      gameState: 'LIVE',
      period: 2,
      clock: { timeRemaining: '12:34' },
      awayTeam: { score: 2 },
      homeTeam: { score: 1 },
    }), NOW);
    expect(formatted.isLive).toBe(true);
    expect(formatted.text).toContain('2-1');
    expect(formatted.text).toContain('P2');
    expect(formatted.text).toContain('12:34');
    expect(formatted.text).not.toMatch(/P0/);
  });

  it('shows OT for period > 3', () => {
    const formatted = formatGameTime(game({
      gameState: 'CRIT',
      period: 4,
      clock: { timeRemaining: '3:00' },
      awayTeam: { score: 2 },
      homeTeam: { score: 2 },
    }), NOW);
    expect(formatted.text).toContain('OT');
  });

  it('shows INT without inventing a period', () => {
    const status = getGameLiveStatus(game({
      gameState: 'LIVE',
      period: 0,
      clock: { inIntermission: true },
    }), NOW);
    expect(status.periodClock).toBe('INT');
  });

  it('hides 0-0 scores on inferred live games (stale FUT row)', () => {
    const start = new Date(NOW - HOUR).toISOString();
    const status = getGameLiveStatus(game({
      gameState: 'FUT',
      startTimeUTC: start,
      awayTeam: { score: 0 },
      homeTeam: { score: 0 },
    }), NOW);
    expect(status.isLive).toBe(true);
    expect(status.score).toBeNull();
    expect(status.detail).toBe('');
  });

  it('formats FINAL with the score', () => {
    const formatted = formatGameTime(game({
      gameState: 'FINAL',
      awayTeam: { score: 4 },
      homeTeam: { score: 2 },
    }), NOW);
    expect(formatted.isFinal).toBe(true);
    expect(formatted.text).toBe('FINAL 4-2');
  });

  it('formats upcoming games as a local time, not LIVE', () => {
    const formatted = formatGameTime(game({
      gameState: 'FUT',
      startTimeUTC: '2026-10-15T01:00:00.000Z',
    }), NOW);
    expect(formatted.isLive).toBe(false);
    expect(formatted.text).toMatch(/\d{1,2}:\d{2}/);
  });
});
