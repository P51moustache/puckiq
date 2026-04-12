import * as Notifications from 'expo-notifications';
import {
  registerPushToken,
  unregisterPushToken,
} from '../notifications';
import {
  FantasyNotificationPreferences,
  DEFAULT_FANTASY_PREFS,
  saveFantasyNotificationPrefs,
  loadFantasyNotificationPrefs,
} from '../notificationSettings';

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    DATE: 'date',
  },
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
  },
}));

// Mock notificationSettings (only the functions used by notifications.ts internally)
jest.mock('../notificationSettings', () => {
  const actual = jest.requireActual('../notificationSettings');
  return {
    ...actual,
    getNotificationSettings: jest.fn().mockResolvedValue({
      enabled: true,
      time: '09:00',
      notifyLockResults: true,
      notifySmartPickResults: true,
      notifyUserPickResults: true,
      notifyGameStart: true,
      gameStartMinutesBefore: 30,
    }),
  };
});

// Mock supabase
const mockUpsert = jest.fn();
const mockDelete = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'push_tokens') {
        return {
          upsert: mockUpsert,
          delete: () => ({
            eq: mockEq,
          }),
        };
      }
      if (table === 'notification_preferences') {
        return {
          upsert: mockUpsert,
          select: () => ({
            eq: () => ({
              single: mockSingle,
            }),
          }),
        };
      }
      return {};
    }),
  },
}));

// Mock pickTracking (imported by notifications.ts)
jest.mock('../pickTracking');

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe('Push Token Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerPushToken', () => {
    it('should register push token when permissions are granted', async () => {
      (mockNotifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (mockNotifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: 'ExponentPushToken[test-token-123]',
      });
      mockUpsert.mockResolvedValue({ error: null });

      const token = await registerPushToken('user-123');

      expect(token).toBe('ExponentPushToken[test-token-123]');
      expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalled();
    });

    it('should return null when permissions are not granted', async () => {
      (mockNotifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (mockNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      const token = await registerPushToken('user-123');

      expect(token).toBeNull();
      expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it('should return null when Supabase upsert fails', async () => {
      (mockNotifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (mockNotifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: 'ExponentPushToken[test-token-123]',
      });
      mockUpsert.mockResolvedValue({ error: { message: 'DB error' } });

      const token = await registerPushToken('user-123');

      expect(token).toBeNull();
    });

    it('should return null when getExpoPushTokenAsync throws', async () => {
      (mockNotifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (mockNotifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(new Error('Token error'));

      const token = await registerPushToken('user-123');

      expect(token).toBeNull();
    });
  });

  describe('unregisterPushToken', () => {
    it('should remove token from Supabase', async () => {
      mockEq.mockResolvedValue({ error: null });

      await unregisterPushToken('user-123');

      // Should not throw
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should handle Supabase delete errors gracefully', async () => {
      mockEq.mockResolvedValue({ error: { message: 'Delete failed' } });

      // Should not throw
      await expect(unregisterPushToken('user-123')).resolves.toBeUndefined();
    });
  });
});

describe('Fantasy Notification Preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DEFAULT_FANTASY_PREFS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_FANTASY_PREFS).toEqual({
        morningBrief: true,
        goalieConfirmed: true,
        injuryAlerts: true,
        gameReminder: false,
        waiverAlerts: false,
      });
    });
  });

  describe('saveFantasyNotificationPrefs', () => {
    it('should save preferences to Supabase', async () => {
      mockUpsert.mockResolvedValue({ error: null });

      const prefs: FantasyNotificationPreferences = {
        morningBrief: true,
        goalieConfirmed: false,
        injuryAlerts: true,
        gameReminder: true,
        waiverAlerts: false,
      };

      await saveFantasyNotificationPrefs('user-123', prefs);

      expect(mockUpsert).toHaveBeenCalledWith(
        {
          user_id: 'user-123',
          fantasy_prefs: prefs,
        },
        { onConflict: 'user_id' }
      );
    });

    it('should throw when Supabase upsert fails', async () => {
      mockUpsert.mockResolvedValue({ error: { message: 'DB error' } });

      await expect(
        saveFantasyNotificationPrefs('user-123', DEFAULT_FANTASY_PREFS)
      ).rejects.toEqual({ message: 'DB error' });
    });
  });

  describe('loadFantasyNotificationPrefs', () => {
    it('should load preferences from Supabase', async () => {
      const savedPrefs: FantasyNotificationPreferences = {
        morningBrief: false,
        goalieConfirmed: true,
        injuryAlerts: false,
        gameReminder: true,
        waiverAlerts: true,
      };
      mockSingle.mockResolvedValue({
        data: { fantasy_prefs: savedPrefs },
        error: null,
      });

      const result = await loadFantasyNotificationPrefs('user-123');

      expect(result).toEqual(savedPrefs);
    });

    it('should return defaults when no saved preferences exist', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const result = await loadFantasyNotificationPrefs('user-123');

      expect(result).toEqual(DEFAULT_FANTASY_PREFS);
    });

    it('should return defaults when fantasy_prefs is null', async () => {
      mockSingle.mockResolvedValue({
        data: { fantasy_prefs: null },
        error: null,
      });

      const result = await loadFantasyNotificationPrefs('user-123');

      expect(result).toEqual(DEFAULT_FANTASY_PREFS);
    });

    it('should merge with defaults when saved prefs are partial', async () => {
      // Simulate a case where only some fields were saved (e.g., new fields added later)
      mockSingle.mockResolvedValue({
        data: { fantasy_prefs: { morningBrief: false, goalieConfirmed: false } },
        error: null,
      });

      const result = await loadFantasyNotificationPrefs('user-123');

      expect(result).toEqual({
        morningBrief: false,
        goalieConfirmed: false,
        injuryAlerts: true,    // default
        gameReminder: false,   // default
        waiverAlerts: false,   // default
      });
    });

    it('should return defaults when Supabase throws', async () => {
      mockSingle.mockRejectedValue(new Error('Network error'));

      const result = await loadFantasyNotificationPrefs('user-123');

      expect(result).toEqual(DEFAULT_FANTASY_PREFS);
    });
  });
});
