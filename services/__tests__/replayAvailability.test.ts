jest.mock('../backtesting', () => ({ runBacktest: jest.fn() }));
jest.mock('../modelStorage', () => ({ createDefaultModel: jest.fn(() => ({ id: 'classic' })) }));

import { runBacktest } from '../backtesting';
import { checkReplayAvailability } from '../replayAvailability';

describe('checkReplayAvailability', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports only records retained by the actual replay engine', async () => {
    (runBacktest as jest.Mock).mockResolvedValue({
      totalGames: 2,
      results: [{ date: '2025-02-14' }, { date: '2025-02-18' }],
    });
    const range = { start: '2025-02-01', end: '2025-02-28' };

    await expect(checkReplayAvailability(range)).resolves.toEqual({
      available: true,
      gameCount: 2,
      latestGameDate: '2025-02-18',
      range,
    });
    expect(runBacktest).toHaveBeenCalledWith(expect.objectContaining({ id: 'classic' }), range, undefined, true);
  });

  it('does not promise availability when completed games lack pregame standings', async () => {
    (runBacktest as jest.Mock).mockResolvedValue({ totalGames: 0, results: [] });
    await expect(checkReplayAvailability({ start: '2024-10-01', end: '2025-04-18' }))
      .resolves.toMatchObject({ available: false, gameCount: 0, latestGameDate: null });
  });

  it('surfaces replay eligibility failures for retry', async () => {
    (runBacktest as jest.Mock).mockRejectedValue(new Error('offline'));
    await expect(checkReplayAvailability({ start: '2025-01-01', end: '2025-01-31' }))
      .rejects.toThrow('Unable to check replay data availability');
  });
});
