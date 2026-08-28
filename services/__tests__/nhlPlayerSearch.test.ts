import {
  mapNhlSearchRow,
  preferActiveHits,
  rankSearchResults,
  searchNhlPlayers,
  suggestedLineGroup,
} from '../nhlPlayerSearch';

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

describe('suggestedLineGroup', () => {
  it('maps official NHL positions to F / D / G', () => {
    expect(suggestedLineGroup('C')).toBe('F');
    expect(suggestedLineGroup('LW')).toBe('F');
    expect(suggestedLineGroup('D')).toBe('D');
    expect(suggestedLineGroup('G')).toBe('G');
  });
});

describe('preferActiveHits', () => {
  it('hides inactive when an active hit exists', () => {
    const kept = preferActiveHits([
      { playerId: 1, name: 'Old', teamAbbrev: '', position: 'D', active: false },
      { playerId: 2, name: 'Now', teamAbbrev: 'COL', position: 'D', active: true },
    ]);
    expect(kept.map((row) => row.playerId)).toEqual([2]);
  });

  it('keeps inactive when that is the only match', () => {
    const only = [{ playerId: 1, name: 'Retired', teamAbbrev: '', position: 'C', active: false }];
    expect(preferActiveHits(only)).toEqual(only);
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

  it('returns only active NHL hits when any are active', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { playerId: '1', name: 'Brian McDavid', positionCode: 'D', active: false },
        { playerId: '8478402', name: 'Connor McDavid', positionCode: 'C', teamAbbrev: 'EDM', active: true },
      ]),
    });
    const results = await searchNhlPlayers('mcdavid');
    expect(results.map((row) => row.playerId)).toEqual([8478402]);
  });

  it('throws when the search endpoint fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(searchNhlPlayers('mcdavid')).rejects.toThrow('NHL player search failed');
  });
});
