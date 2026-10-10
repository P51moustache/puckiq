const mockSearch = jest.fn();
jest.mock('../../nhlPlayerSearch', () => ({ searchNhlPlayers: (...args: unknown[]) => mockSearch(...args) }));

import { MAX_SEARCHED_LEFTOVERS, rosterPlayerFromSearch, searchLeftovers } from '../searchFallback';

const result = (playerId: number, name: string, teamAbbrev = 'TBL', position = 'R') => ({ playerId, name, teamAbbrev, position, active: true });

describe('search fallback', () => {
  beforeEach(() => mockSearch.mockReset());

  it('keeps only exact names, so a league or team name never becomes a player', async () => {
    mockSearch.mockImplementation(async (query: string) => {
      if (query === 'Nikita Kucherov') return [result(8476453, 'Nikita Kucherov')];
      if (query === 'Hockey Gods League') return [result(1, 'Gods Hockey')];
      throw new Error('offline');
    });
    const found = await searchLeftovers(['Nikita Kucherov', 'Hockey Gods League', 'Bobby Unknown']);
    expect([...found.entries()]).toEqual([
      ['Nikita Kucherov', { playerId: 8476453, firstName: 'Nikita', lastName: 'Kucherov', team: 'TBL', position: 'R' }],
    ]);
  });

  it(`looks up at most ${MAX_SEARCHED_LEFTOVERS} names`, async () => {
    mockSearch.mockResolvedValue([]);
    await searchLeftovers(Array.from({ length: 12 }, (_, i) => `Player Number${i}`));
    expect(mockSearch).toHaveBeenCalledTimes(MAX_SEARCHED_LEFTOVERS);
  });

  it('splits multi-word last names after the first name', () => {
    expect(rosterPlayerFromSearch(result(2, 'Trevor van Riemsdyk', 'WSH', 'D'))).toMatchObject({ firstName: 'Trevor', lastName: 'van Riemsdyk' });
  });
});
