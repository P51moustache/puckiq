const query = {
  select: jest.fn(),
  or: jest.fn(),
  eq: jest.fn(),
  limit: jest.fn(),
};

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn(() => query) },
}));

import { searchRosterPlayers } from '../rosterPlayerSearch';

describe('searchRosterPlayers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.select.mockReturnValue(query);
    query.or.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.limit.mockResolvedValue({
      data: [{ id: 97, first_name: 'Connor', last_name: 'McDavid', full_name: 'Connor McDavid', current_team_abbrev: 'EDM', position: 'C' }],
      error: null,
    });
  });

  it('searches first, last, and full name fields while limiting active results', async () => {
    await expect(searchRosterPlayers('  Connor McDavid  ')).resolves.toEqual([
      { id: 97, firstName: 'Connor', lastName: 'McDavid', fullName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C' },
    ]);
    expect(query.or).toHaveBeenCalledWith('first_name.ilike.%Connor McDavid%,last_name.ilike.%Connor McDavid%,full_name.ilike.%Connor McDavid%');
    expect(query.eq).toHaveBeenCalledWith('is_active', true);
    expect(query.limit).toHaveBeenCalledWith(20);
  });

  it('rejects database failures instead of presenting them as no matches', async () => {
    query.limit.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    await expect(searchRosterPlayers('Connor')).rejects.toThrow('offline');
  });
});
