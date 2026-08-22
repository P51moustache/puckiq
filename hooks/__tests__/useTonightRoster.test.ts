import { loadRoster } from '../../services/fantasyRoster';
import { fetchRosterNews } from '../../services/rosterNews';
import { getTonightStatusesForRoster } from '../../services/tonightRoster';

jest.mock('../../services/fantasyRoster', () => ({
  loadRoster: jest.fn(),
}));
jest.mock('../../services/rosterNews', () => ({
  fetchRosterNews: jest.fn(),
}));
jest.mock('../../services/tonightRoster', () => ({
  getTonightStatusesForRoster: jest.fn(),
}));

describe('useTonightRoster data path', () => {
  const roster = {
    id: '1',
    name: 'My Team',
    scoringFormat: 'yahoo',
    players: [{
      playerId: 8478402,
      playerName: 'Connor McDavid',
      teamAbbrev: 'EDM',
      position: 'C',
      rosterPosition: 'C',
    }],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads roster, news, then tonight status', async () => {
    (loadRoster as jest.Mock).mockResolvedValue(roster);
    (fetchRosterNews as jest.Mock).mockResolvedValue([]);
    (getTonightStatusesForRoster as jest.Mock).mockResolvedValue({
      date: '2026-08-22',
      statuses: [{ playerId: 8478402, playerName: 'Connor McDavid' }],
    });

    const saved = await loadRoster();
    const news = await fetchRosterNews(saved.players);
    const tonight = await getTonightStatusesForRoster(saved.players, { news });

    expect(tonight.statuses).toHaveLength(1);
    expect(getTonightStatusesForRoster).toHaveBeenCalledWith(roster.players, { news: [] });
  });

  it('skips NHL fetches when the roster is empty', async () => {
    (loadRoster as jest.Mock).mockResolvedValue(null);
    const saved = await loadRoster();
    expect(saved).toBeNull();
    expect(fetchRosterNews).not.toHaveBeenCalled();
  });
});
