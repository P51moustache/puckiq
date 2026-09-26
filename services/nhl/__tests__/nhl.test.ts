import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearNhlMemoryCache, fetchJson, pruneNhlDiskCache, withQuery } from '../client';
import { addDays, daysBetween, mondayOf, previousSeasonId, seasonIdFor, seasonLabel, weekRangeLabel, weekdayAbbrev } from '../dates';
import { extractGameLines, extractScratchIds } from '../gamecenter';
import { mapGameLog, mapLanding } from '../player';
import { isFantasyGame, isOffNight, mapWeekPayload, normalizeGame } from '../schedule';
import { mapGoalieRows, mapSkaterRows } from '../stats';
import { blendTeamStrength } from '../teams';

describe('dates', () => {
  it('finds the fantasy Monday and walks the week in UTC', () => {
    expect(mondayOf('2026-10-15')).toBe('2026-10-12');
    expect(mondayOf('2026-10-18')).toBe('2026-10-12'); // Sunday belongs to the prior Monday
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-10-12', '2026-10-15')).toBe(3);
    expect(weekdayAbbrev('2026-10-12')).toBe('MON');
    expect(weekRangeLabel('2026-10-12')).toBe('Oct 12 – Oct 18');
  });

  it('rolls the season id over in September', () => {
    expect(seasonIdFor('2026-08-31')).toBe(20252026);
    expect(seasonIdFor('2026-09-01')).toBe(20262027);
    expect(seasonIdFor('2027-03-01')).toBe(20262027);
    expect(previousSeasonId(20262027)).toBe(20252026);
    expect(seasonLabel(20252026)).toBe('2025-26');
  });
});

describe('schedule', () => {
  const payload = {
    gameWeek: [
      {
        date: '2026-10-12',
        games: [
          { id: 1, gameType: 2, gameState: 'FUT', gameScheduleState: 'OK', startTimeUTC: '2026-10-12T23:00:00Z', homeTeam: { abbrev: 'tor' }, awayTeam: { abbrev: 'EDM' } },
          { id: 2, gameType: 1, homeTeam: { abbrev: 'BOS' }, awayTeam: { abbrev: 'NYR' } },
          { id: 3, gameType: 2, gameScheduleState: 'PPD', homeTeam: { abbrev: 'CHI' }, awayTeam: { abbrev: 'DAL' } },
          { homeTeam: { abbrev: 'X' } },
        ],
      },
    ],
  };

  it('normalizes seven days and drops malformed games', () => {
    const week = mapWeekPayload(payload, '2026-10-12');
    expect(week.days).toHaveLength(7);
    expect(week.days[0].games).toHaveLength(3);
    expect(week.days[0].games[0]).toMatchObject({ home: 'TOR', away: 'EDM', state: 'FUT' });
    expect(week.days[6].games).toEqual([]);
  });

  it('only counts regular-season, non-postponed games for fantasy', () => {
    const [regular, preseason, postponed] = mapWeekPayload(payload, '2026-10-12').days[0].games;
    expect(isFantasyGame(regular)).toBe(true);
    expect(isFantasyGame(preseason)).toBe(false);
    expect(isFantasyGame(postponed)).toBe(false);
  });

  it('marks nights with seven or fewer games as off-nights', () => {
    const games = Array.from({ length: 7 }, (_, i) => normalizeGame({ id: i + 1, gameType: 2, homeTeam: { abbrev: `H${i}` }, awayTeam: { abbrev: `A${i}` } }, '2026-10-13')!);
    expect(isOffNight({ date: '2026-10-13', dayAbbrev: 'TUE', games })).toBe(true);
    const busy = [...games, normalizeGame({ id: 99, gameType: 2, homeTeam: { abbrev: 'ZZ' }, awayTeam: { abbrev: 'YY' } }, '2026-10-13')!];
    expect(isOffNight({ date: '2026-10-13', dayAbbrev: 'TUE', games: busy })).toBe(false);
    expect(isOffNight({ date: '2026-10-13', dayAbbrev: 'TUE', games: [] })).toBe(false);
  });
});

describe('gamecenter', () => {
  it('reads official scratches from both teams', () => {
    const ids = extractScratchIds({ gameInfo: { awayTeam: { scratches: [{ id: 1 }] }, homeTeam: { scratches: [{ id: '2' }, {}] } } });
    expect([...ids].sort()).toEqual([1, 2]);
  });

  it('builds live lines and ignores a dressed backup goalie', () => {
    const lines = extractGameLines({
      playerByGameStats: {
        homeTeam: {
          forwards: [{ playerId: 10, goals: 1, assists: 2, sog: 4, hits: 1, blockedShots: 0, toi: '18:00' }],
          goalies: [
            { playerId: 30, saves: 28, shotsAgainst: 30, goalsAgainst: 2, toi: '60:00' },
            { playerId: 31, saves: 0, shotsAgainst: 0, goalsAgainst: 0, toi: '00:00' },
          ],
        },
      },
    });
    expect(lines.get(10)).toMatchObject({ points: 3, shots: 4 });
    expect(lines.get(30)).toMatchObject({ isGoalie: true, saves: 28 });
    expect(lines.has(31)).toBe(false);
  });
});

describe('stats + player mapping', () => {
  it('merges hits/blocks and takes the current team for traded players', () => {
    const [line] = mapSkaterRows(
      [{ playerId: 5, skaterFullName: 'Traded Guy', positionCode: 'L', teamAbbrevs: 'NYR,LAK', gamesPlayed: 10, goals: 2, assists: 3, points: 5, ppPoints: 1, shots: 20 }],
      [{ playerId: 5, hits: 12, blockedShots: 4 }],
    );
    expect(line).toMatchObject({ team: 'LAK', hits: 12, blocks: 4, ppp: 1 });
    const [goalie] = mapGoalieRows([{ playerId: 7, goalieFullName: 'G', teamAbbrevs: 'BOS', gamesStarted: 3, wins: 2 }]);
    expect(goalie).toMatchObject({ gs: 3, wins: 2, team: 'BOS' });
  });

  it('maps the landing and sorts the game log newest first', () => {
    const profile = mapLanding({ playerId: 1, firstName: { default: 'Connor' }, lastName: { default: 'McDavid' }, currentTeamAbbrev: 'edm', birthDate: '1997-01-13' }, new Date('2026-10-01'));
    expect(profile).toMatchObject({ name: 'Connor McDavid', team: 'EDM', age: 29 });
    const log = mapGameLog({ gameLog: [
      { gameId: 1, gameDate: '2026-10-08', goals: 1, powerPlayPoints: 1, homeRoadFlag: 'H' },
      { gameId: 2, gameDate: '2026-10-10', shotsAgainst: 30, goalsAgainst: 2, gamesStarted: 1, decision: 'W' },
    ] }, 20262027);
    expect(log.games.map((game) => game.gameId)).toEqual([2, 1]);
    expect(log.games[0]).toMatchObject({ saves: 28, started: true, decision: 'W' });
    expect(log.games[1]).toMatchObject({ ppp: 1, isHome: true });
  });

  it('blends a thin current table with last season', () => {
    const rows = blendTeamStrength(
      [{ teamAbbrev: { default: 'AAA' }, gamesPlayed: 1, goalAgainst: 9, goalFor: 0 }, { teamAbbrev: { default: 'BBB' }, gamesPlayed: 1, goalAgainst: 1, goalFor: 5 }],
      [{ teamAbbrev: { default: 'AAA' }, gamesPlayed: 82, goalAgainst: 205, goalFor: 250 }, { teamAbbrev: { default: 'BBB' }, gamesPlayed: 82, goalAgainst: 287, goalFor: 200 }],
    );
    const aaa = rows.find((row) => row.team === 'AAA')!;
    const bbb = rows.find((row) => row.team === 'BBB')!;
    // One 9-goal game should not outweigh last season's 3.5 GA/G for BBB.
    expect(bbb.matchupRank).toBe(1);
    expect(aaa.goalsAgainstPerGame).toBeCloseTo((9 + (205 / 82) * 10) / 11);
  });
});

describe('client', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    clearNhlMemoryCache();
  });

  it('dedupes identical in-flight requests and serves fresh cache', async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ n: 1 }) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const [a, b] = await Promise.all([
      fetchJson<{ n: number }>('https://x.test/a', { ttlMs: 60_000 }),
      fetchJson<{ n: number }>('https://x.test/a', { ttlMs: 60_000 }),
    ]);
    await fetchJson('https://x.test/a', { ttlMs: 60_000 });
    expect(a.n).toBe(1);
    expect(b.n).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the last good copy when the network fails', async () => {
    let online = true;
    global.fetch = jest.fn(async () => {
      if (!online) throw new Error('offline');
      return { ok: true, status: 200, json: async () => ({ n: 2 }) };
    }) as unknown as typeof fetch;
    await fetchJson('https://x.test/b', { ttlMs: 60_000 });
    online = false;
    const stale = await fetchJson<{ n: number }>('https://x.test/b', { ttlMs: 60_000, force: true });
    expect(stale.n).toBe(2);
  });

  it('retries once on a 5xx, not on a 4xx', async () => {
    const fetchMock = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(fetchJson('https://x.test/c', { ttlMs: 1 })).rejects.toThrow('503');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const notFound = jest.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    global.fetch = notFound as unknown as typeof fetch;
    await expect(fetchJson('https://x.test/d', { ttlMs: 1 })).rejects.toThrow('404');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('builds encoded query strings and prunes old disk entries', async () => {
    expect(withQuery('https://x.test', { q: 'a b', n: 1 })).toBe('https://x.test?q=a%20b&n=1');
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValueOnce(['nhlcache:old', 'nhlcache:new', 'other']);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce([
      ['nhlcache:old', JSON.stringify({ data: 1, fetchedAt: 0 })],
      ['nhlcache:new', JSON.stringify({ data: 1, fetchedAt: Date.now() })],
    ]);
    (AsyncStorage as unknown as { multiRemove: jest.Mock }).multiRemove = jest.fn(async () => undefined);
    expect(await pruneNhlDiskCache()).toBe(1);
  });
});

describe('client politeness', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    clearNhlMemoryCache();
    jest.useRealTimers();
  });

  it('caps concurrent requests per host at four', async () => {
    let inFlight = 0;
    let peak = 0;
    global.fetch = jest.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { ok: true, status: 200, json: async () => ({}) };
    }) as unknown as typeof fetch;
    await Promise.all(Array.from({ length: 10 }, (_, i) => fetchJson(`https://stats.test/r${i}`, { ttlMs: 1 })));
    expect(peak).toBe(4);
    expect(global.fetch).toHaveBeenCalledTimes(10);
  });

  it('backs off and retries on 429', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, status: 429, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ ok: 1 }) };
    }) as unknown as typeof fetch;
    const result = await fetchJson<{ ok: number }>('https://stats.test/limited', { ttlMs: 1 });
    expect(result.ok).toBe(1);
    expect(calls).toBe(2);
  });
});

describe('team offense rank', () => {
  it('ranks the highest-scoring team first for goalie matchups', () => {
    const rows = blendTeamStrength([], [
      { teamAbbrev: { default: 'LOW' }, gamesPlayed: 82, goalAgainst: 250, goalFor: 200 },
      { teamAbbrev: { default: 'HIGH' }, gamesPlayed: 82, goalAgainst: 250, goalFor: 300 },
    ]);
    expect(rows.find((row) => row.team === 'HIGH')!.offenseRank).toBe(1);
    expect(rows.find((row) => row.team === 'LOW')!.offenseRank).toBe(2);
  });
});
