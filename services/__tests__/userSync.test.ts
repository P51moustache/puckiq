import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

// Import after mocks are set up (jest.setup.js handles supabase + AsyncStorage mocks)
import {
  syncLocalDataToSupabase,
  hasCompletedInitialSync,
  markInitialSyncComplete,
  SYNC_STORAGE_KEY,
} from '../userSync';

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('userSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
  });

  describe('hasCompletedInitialSync', () => {
    it('should return false when no sync record exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      const result = await hasCompletedInitialSync('user-123');
      expect(result).toBe(false);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(SYNC_STORAGE_KEY);
    });

    it('should return true when user has a sync record', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ 'user-123': '2026-04-01T00:00:00.000Z' })
      );
      const result = await hasCompletedInitialSync('user-123');
      expect(result).toBe(true);
    });

    it('should return false for a different user', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ 'user-456': '2026-04-01T00:00:00.000Z' })
      );
      const result = await hasCompletedInitialSync('user-123');
      expect(result).toBe(false);
    });
  });

  describe('markInitialSyncComplete', () => {
    it('should save sync record for the user', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      await markInitialSyncComplete('user-123');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        SYNC_STORAGE_KEY,
        expect.stringContaining('user-123')
      );
    });

    it('should preserve existing sync records for other users', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ 'user-456': '2026-03-01T00:00:00.000Z' })
      );
      await markInitialSyncComplete('user-123');

      const savedValue = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedValue['user-456']).toBe('2026-03-01T00:00:00.000Z');
      expect(savedValue['user-123']).toBeDefined();
    });
  });

  describe('syncLocalDataToSupabase', () => {
    it('should skip sync if already completed for user', async () => {
      mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
        if (key === SYNC_STORAGE_KEY) {
          return JSON.stringify({ 'user-123': '2026-04-01T00:00:00.000Z' });
        }
        return null;
      });

      const result = await syncLocalDataToSupabase('user-123');
      expect(result).toEqual({ synced: false, reason: 'already_synced' });
      // Should not have called supabase.from
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should sync picks data to Supabase', async () => {
      const mockPicks = {
        '2026-04-01': {
          date: '2026-04-01',
          smartPicks: [{ gameId: 1, teamPicked: 'TOR', confidence: 0.75 }],
          userPicks: [],
          lockOfTheDay: null,
        },
      };

      mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
        if (key === SYNC_STORAGE_KEY) return null;
        if (key === 'puckiq_daily_picks') return JSON.stringify(mockPicks);
        if (key === 'puckiq_favorite_teams') return null;
        if (key === 'puckiq_prediction_models') return null;
        return null;
      });

      const result = await syncLocalDataToSupabase('user-123');
      expect(result.synced).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_data');
    });

    it('should sync favorite teams to Supabase', async () => {
      const mockTeams = ['TOR', 'MTL', 'BOS'];

      mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
        if (key === SYNC_STORAGE_KEY) return null;
        if (key === 'puckiq_daily_picks') return null;
        if (key === 'puckiq_favorite_teams') return JSON.stringify(mockTeams);
        if (key === 'puckiq_prediction_models') return null;
        return null;
      });

      const result = await syncLocalDataToSupabase('user-123');
      expect(result.synced).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_data');
    });

    it('should sync prediction models to Supabase', async () => {
      const mockModels = [
        { id: 'classic', name: 'PuckIQ Classic', isActive: true },
      ];

      mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
        if (key === SYNC_STORAGE_KEY) return null;
        if (key === 'puckiq_daily_picks') return null;
        if (key === 'puckiq_favorite_teams') return null;
        if (key === 'puckiq_prediction_models') return JSON.stringify(mockModels);
        return null;
      });

      const result = await syncLocalDataToSupabase('user-123');
      expect(result.synced).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_data');
    });

    it('should mark sync complete after successful sync', async () => {
      mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
        if (key === SYNC_STORAGE_KEY) return null;
        return null;
      });

      await syncLocalDataToSupabase('user-123');

      // Should have called setItem for the sync record
      const setItemCalls = (mockAsyncStorage.setItem as jest.Mock).mock.calls;
      const syncCall = setItemCalls.find(
        (call: string[]) => call[0] === SYNC_STORAGE_KEY
      );
      expect(syncCall).toBeDefined();
    });

    it('should handle Supabase errors gracefully', async () => {
      mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
        if (key === SYNC_STORAGE_KEY) return null;
        if (key === 'puckiq_daily_picks') return JSON.stringify({ test: 'data' });
        return null;
      });

      // Override the mock to return an error
      (mockSupabase.from as jest.Mock).mockReturnValueOnce({
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (resolve: any) =>
          Promise.resolve({ data: null, error: { message: 'DB error' } }).then(resolve),
      });

      const result = await syncLocalDataToSupabase('user-123');
      expect(result.synced).toBe(false);
      expect(result.reason).toBe('error');
    });

    it('should handle empty local data gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await syncLocalDataToSupabase('user-123');
      // Even with no data, sync should succeed and mark complete
      expect(result.synced).toBe(true);
    });

    it('should not sync if userId is empty', async () => {
      const result = await syncLocalDataToSupabase('');
      expect(result).toEqual({ synced: false, reason: 'no_user' });
    });
  });
});
