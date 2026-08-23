import {
  buildTonightStatus,
  extractScratchIds,
  findGameForTeam,
  getTonightStatusesForRoster,
  sortTonightStatuses,
} from '../tonightRoster';
import type { FantasyPlayer, RosterNewsItem } from '../../types/fantasy';

const mcdavid: FantasyPlayer = {
  playerId: 8478402,
  playerName: 'Connor McDavid',
  teamAbbrev: 'EDM',
  position: 'C',
  rosterPosition: 'C',
};

const game = {
  id: 2026020001,
  gameState: 'FUT',
  startTimeUTC: '2026-09-29T23:00:00Z',
  homeTeam: { abbrev: 'EDM' },
  awayTeam: { abbrev: 'CGY' },
};

describe('findGameForTeam', () => {
  it('finds a home or away match', () => {
    expect(findGameForTeam([game], 'edm')?.id).toBe(2026020001);
    expect(findGameForTeam([game], 'CGY')?.id).toBe(2026020001);
    expect(findGameForTeam([game], 'TOR')).toBeNull();
  });
});

describe('extractScratchIds', () => {
  it('collects home and away scratches', () => {
    const ids = extractScratchIds({
      gameInfo: {
        awayTeam: { scratches: [{ id: 1 }] },
        homeTeam: { scratches: [{ id: 8478402 }] },
      },
    });
    expect([...ids].sort()).toEqual([1, 8478402]);
  });

  it('handles missing gameInfo', () => {
    expect(extractScratchIds({})).toEqual(new Set());
  });
});

describe('buildTonightStatus', () => {
  it('marks a healthy home player as START', () => {
    const row = buildTonightStatus(mcdavid, game, new Set());
    expect(row.opponentAbbrev).toBe('CGY');
    expect(row.isHome).toBe(true);
    expect(row.recommendation).toBe('START');
    expect(row.injurySignal).toBe('ok');
    expect(row.confidence).toBe('unknown');
  });

  it('sits a scratched player', () => {
    const row = buildTonightStatus(mcdavid, game, new Set([8478402]));
    expect(row.injurySignal).toBe('scratch');
    expect(row.recommendation).toBe('SIT');
    expect(row.confidence).toBe('confirmed');
  });

  it('sits when the team is off', () => {
    const row = buildTonightStatus(mcdavid, null, new Set());
    expect(row.opponentAbbrev).toBeNull();
    expect(row.recommendation).toBe('SIT');
    expect(row.reason).toBe('No game tonight');
  });

  it('applies injury language from roster news', () => {
    const news: RosterNewsItem[] = [{
      id: '1',
      title: 'McDavid placed on IR',
      url: 'https://example.com',
      summary: '',
      publishedAt: '',
      source: 'ESPN NHL',
      matchedPlayerIds: [8478402],
      matchedPlayerNames: ['Connor McDavid'],
    }];
    const row = buildTonightStatus(mcdavid, game, new Set(), news);
    expect(row.injurySignal).toBe('out');
    expect(row.recommendation).toBe('SIT');
    expect(row.confidence).toBe('likely');
  });

  it('never upgrades a news scratch to Confirmed', () => {
    const news: RosterNewsItem[] = [{
      id: '1',
      title: 'McDavid a healthy scratch tonight',
      url: 'https://example.com',
      summary: '',
      publishedAt: '',
      source: 'ESPN NHL',
      matchedPlayerIds: [8478402],
      matchedPlayerNames: ['Connor McDavid'],
    }];
    const row = buildTonightStatus(mcdavid, game, new Set(), news);
    expect(row.injurySignal).toBe('scratch');
    expect(row.confidence).toBe('likely');
  });
});

describe('getTonightStatusesForRoster', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns empty statuses for an empty roster without fetching scratches', async () => {
    global.fetch = jest.fn();
    const result = await getTonightStatusesForRoster([], { date: '2026-08-22' });
    expect(result.statuses).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps roster players onto the NHL score slate', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/v1/score/')) {
        return {
          ok: true,
          json: async () => ({ currentDate: '2026-08-22', nextDate: '2026-09-19', games: [game] }),
        };
      }
      return { ok: true, json: async () => ({ gameInfo: { homeTeam: { scratches: [] }, awayTeam: { scratches: [] } } }) };
    });

    const result = await getTonightStatusesForRoster([mcdavid], { date: '2026-08-22' });
    expect(result.date).toBe('2026-08-22');
    expect(result.statuses[0].opponentAbbrev).toBe('CGY');
    expect(result.statuses[0].recommendation).toBe('START');
  });
});

describe('sortTonightStatuses', () => {
  it('puts scratches and outs before healthy games, then off-night', () => {
    const healthy = buildTonightStatus(mcdavid, game, new Set());
    const off = buildTonightStatus({ ...mcdavid, playerId: 2, playerName: 'Zach Hyman' }, null, new Set());
    const scratch = buildTonightStatus({ ...mcdavid, playerId: 3, playerName: 'Leon Draisaitl' }, game, new Set([3]));
    const sorted = sortTonightStatuses([off, healthy, scratch]);
    expect(sorted.map((r) => r.playerName)).toEqual([
      'Leon Draisaitl',
      'Connor McDavid',
      'Zach Hyman',
    ]);
  });
});
