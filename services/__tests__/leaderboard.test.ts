import { supabase } from '../../lib/supabase';
import { getTopPredictors, updateUserScore, setDisplayName } from '../leaderboard';

// The global jest.setup.js mocks supabase with a chainable query builder.
// We override supabase.from here to control return values per test.

function mockFromChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: (resolve: any) => Promise.resolve(resolvedValue).then(resolve),
  };
  (supabase.from as jest.Mock).mockReturnValue(chain);
  return chain;
}

describe('leaderboard service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getTopPredictors
  // ---------------------------------------------------------------------------
  describe('getTopPredictors', () => {
    it('returns mapped entries ordered by accuracy', async () => {
      const rows = [
        { user_id: 'u1', display_name: 'Alice', total_picks: 50, correct_picks: 30, accuracy: 0.6, streak: 7 },
        { user_id: 'u2', display_name: 'Bob', total_picks: 40, correct_picks: 20, accuracy: 0.5, streak: 2 },
      ];
      mockFromChain({ data: rows, error: null });

      const result = await getTopPredictors('week');

      expect(supabase.from).toHaveBeenCalledWith('leaderboard');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        userId: 'u1',
        displayName: 'Alice',
        totalPicks: 50,
        correctPicks: 30,
        accuracy: 0.6,
        streak: 7,
        rank: 1,
      });
      expect(result[1].rank).toBe(2);
    });

    it('returns empty array on error', async () => {
      mockFromChain({ data: null, error: { message: 'DB error' } });

      const result = await getTopPredictors('season');
      expect(result).toEqual([]);
    });

    it('returns empty array when data is null', async () => {
      mockFromChain({ data: null, error: null });

      const result = await getTopPredictors('week');
      expect(result).toEqual([]);
    });

    it('defaults streak to 0 when null', async () => {
      const rows = [
        { user_id: 'u1', display_name: 'Alice', total_picks: 20, correct_picks: 10, accuracy: 0.5, streak: null },
      ];
      mockFromChain({ data: rows, error: null });

      const result = await getTopPredictors('week');
      expect(result[0].streak).toBe(0);
    });

    it('respects custom limit parameter', async () => {
      const chain = mockFromChain({ data: [], error: null });

      await getTopPredictors('season', 10);

      expect(chain.limit).toHaveBeenCalledWith(10);
    });

    it('filters by period', async () => {
      const chain = mockFromChain({ data: [], error: null });

      await getTopPredictors('season');

      expect(chain.eq).toHaveBeenCalledWith('period', 'season');
    });

    it('filters by minimum picks', async () => {
      const chain = mockFromChain({ data: [], error: null });

      await getTopPredictors('week');

      expect(chain.gte).toHaveBeenCalledWith('total_picks', 10);
    });
  });

  // ---------------------------------------------------------------------------
  // updateUserScore
  // ---------------------------------------------------------------------------
  describe('updateUserScore', () => {
    it('upserts user score with calculated accuracy', async () => {
      const chain = mockFromChain({ data: null, error: null });

      await updateUserScore('user-1', 100, 60, 3);

      expect(supabase.from).toHaveBeenCalledWith('leaderboard');
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          total_picks: 100,
          correct_picks: 60,
          accuracy: 0.6,
          streak: 3,
        })
      );
    });

    it('handles zero total picks without division error', async () => {
      const chain = mockFromChain({ data: null, error: null });

      await updateUserScore('user-2', 0, 0, 0);

      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ accuracy: 0 })
      );
    });

    it('does not throw on Supabase error', async () => {
      mockFromChain({ data: null, error: { message: 'Upsert failed' } });

      await expect(updateUserScore('user-1', 10, 5, 1)).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // setDisplayName
  // ---------------------------------------------------------------------------
  describe('setDisplayName', () => {
    it('upserts trimmed display name', async () => {
      const chain = mockFromChain({ data: null, error: null });

      await setDisplayName('user-1', '  HockeyFan  ');

      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          display_name: 'HockeyFan',
        })
      );
    });

    it('does not upsert empty name', async () => {
      const chain = mockFromChain({ data: null, error: null });

      await setDisplayName('user-1', '   ');

      expect(chain.upsert).not.toHaveBeenCalled();
    });

    it('does not throw on Supabase error', async () => {
      mockFromChain({ data: null, error: { message: 'Update failed' } });

      await expect(setDisplayName('user-1', 'Test')).resolves.toBeUndefined();
    });
  });
});
