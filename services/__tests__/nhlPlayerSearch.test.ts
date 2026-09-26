import { mapNhlSearchRow, rankSearchResults, searchNhlPlayers } from '../nhlPlayerSearch';

describe('mapNhlSearchRow', () => {
  it('maps an official NHL search hit', () => {
    expect(mapNhlSearchRow({
      playerId: '8478402',
      name: 'Connor McDavid',
      positionCode: 'C',
      teamAbbrev: 'EDM',
      active: true,
    })).toEqual({
      playerId: 8478402,
      name: 'Connor McDavid',
      teamAbbrev: 'EDM',
      position: 'C',
      active: true,
    });
  });

  it('falls back to last team and drops bad rows', () => {
    expect(mapNhlSearchRow({
      playerId: '1',
      name: 'Brian McDavid',
      lastTeamAbbrev: 'EDM',
      active: false,
    })?.teamAbbrev).toBe('EDM');
    expect(mapNhlSearchRow({ playerId: 'x', name: 'Nope' })).toBeNull();
    expect(mapNhlSearchRow({ playerId: 1, name: '  ' })).toBeNull();
  });
});

describe('rankSearchResults', () => {
  it('puts active and prefix matches first', () => {
    const ranked = rankSearchResults([
      { playerId: 1, name: 'Brian McDavid', teamAbbrev: '', position: 'D', active: false },
      { playerId: 2, name: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', active: true },
    ], 'mcdavid');
    expect(ranked[0].playerId).toBe(2);
  });
});

describe('searchNhlPlayers', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns [] for short queries', async () => {
    expect(await searchNhlPlayers('m')).toEqual([]);
  });

  it('requests the official NHL search URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { playerId: '8478402', name: 'Connor McDavid', positionCode: 'C', teamAbbrev: 'EDM', active: true },
      ]),
    });

    const results = await searchNhlPlayers('mcdavid');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('search.d3.nhle.com/api/v1/search/player'),
    );
    expect(results[0].playerId).toBe(8478402);
  });

  it('throws when the search endpoint fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(searchNhlPlayers('mcdavid')).rejects.toThrow('NHL player search failed');
  });
});

describe('matchScore / ranking full names', () => {
  const jakes = [
    { playerId: 1, name: 'Jake Fisher', teamAbbrev: 'COL', position: 'C', active: true },
    { playerId: 2, name: 'Jake Johnson', teamAbbrev: '', position: 'D', active: false },
    { playerId: 3, name: 'Jake Oettinger', teamAbbrev: 'DAL', position: 'G', active: true },
  ];

  it('puts the exact full-name match first even when the API buries it', () => {
    expect(rankSearchResults(jakes, 'Jake Oettinger')[0].playerId).toBe(3);
    expect(rankSearchResults(jakes, 'jake oett')[0].playerId).toBe(3);
  });

  it('ignores accents and case', () => {
    const ranked = rankSearchResults([
      { playerId: 9, name: 'Tim Stützle', teamAbbrev: 'OTT', position: 'C', active: true },
      { playerId: 8, name: 'Tim Stone', teamAbbrev: '', position: 'D', active: false },
    ], 'tim stutzle');
    expect(ranked[0].playerId).toBe(9);
  });
});
