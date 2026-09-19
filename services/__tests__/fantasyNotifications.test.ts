import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: 'b8956511-618d-4670-90a8-035892a7d4c0',
        },
      },
    },
    easConfig: null,
  },
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
const mockDeleteUserEq = jest.fn();
const mockDeleteTokenEq = jest.fn();
const mockSingle = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'push_tokens') {
        return {
          upsert: mockUpsert,
          delete: () => ({
            eq: mockDeleteUserEq,
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
const mutableConstants = Constants as unknown as {
  expoConfig: { extra?: { eas?: { projectId?: string } } } | null;
  easConfig: { projectId?: string } | null;
};

describe('Push Token Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteUserEq.mockReturnValue({ eq: mockDeleteTokenEq });
    mockDeleteTokenEq.mockResolvedValue({ error: null });
    (mockNotifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (mockNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (mockNotifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[test-token-123]',
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
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
      expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
        projectId: 'b8956511-618d-4670-90a8-035892a7d4c0',
      });
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          user_id: 'user-123',
          token: 'ExponentPushToken[test-token-123]',
          platform: 'ios',
        },
        { onConflict: 'user_id,token' }
      );
    });

    it('should return null when permissions are not granted', async () => {
      (mockNotifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (mockNotifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      const token = await registerPushToken('user-123');

      expect(token).toBeNull();
      expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalledWith('[Push Token] Registered successfully');
    });

    it('should return null when Supabase upsert fails', async () => {
      (mockNotifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (mockNotifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: 'ExponentPushToken[test-token-123]',
      });
      mockUpsert.mockResolvedValue({ error: { message: 'DB error' } });

      const token = await registerPushToken('user-123');

      expect(token).toBeNull();
      expect(console.log).not.toHaveBeenCalledWith('[Push Token] Registered successfully');
    });

    it('should return null when getExpoPushTokenAsync throws', async () => {
      (mockNotifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (mockNotifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(new Error('Token error'));

      const token = await registerPushToken('user-123');

      expect(token).toBeNull();
    });

    it('should return null and avoid registration when the project ID is missing', async () => {
      const originalExpoConfig = mutableConstants.expoConfig;
      const originalEasConfig = mutableConstants.easConfig;
      mutableConstants.expoConfig = null;
      mutableConstants.easConfig = null;

      const token = await registerPushToken('user-123');

      mutableConstants.expoConfig = originalExpoConfig;
      mutableConstants.easConfig = originalEasConfig;
      expect(token).toBeNull();
      expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('should return null when Expo returns an empty token', async () => {
      (mockNotifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: '' });

      const token = await registerPushToken('user-123');

      expect(token).toBeNull();
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalledWith('[Push Token] Registered successfully');
    });

    it('should not register when the ownership journal cannot be written', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Disk full'));

      const token = await registerPushToken('user-123');

      expect(token).toBeNull();
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalledWith('[Push Token] Registered successfully');
    });

    it('should roll back only the new token when local tracking fails', async () => {
      mockUpsert.mockResolvedValue({ error: null });
      (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) =>
        key === 'puckiq_push_token_user-123' ? 'ExponentPushToken[old-token]' : null
      );
      (AsyncStorage.setItem as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Disk full'));

      const token = await registerPushToken('user-123');

      expect(token).toBeNull();
      expect(mockDeleteUserEq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockDeleteTokenEq).toHaveBeenCalledWith(
        'token',
        'ExponentPushToken[test-token-123]'
      );
      expect(mockDeleteTokenEq).not.toHaveBeenCalledWith(
        'token',
        'ExponentPushToken[old-token]'
      );
      expect(console.log).not.toHaveBeenCalledWith('[Push Token] Registered successfully');
    });

    it('should preserve an existing token when same-token local tracking fails', async () => {
      mockUpsert.mockResolvedValue({ error: null });
      (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) =>
        key === 'puckiq_push_token_user-123'
          ? 'ExponentPushToken[test-token-123]'
          : null
      );
      (AsyncStorage.setItem as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Disk full'));

      const token = await registerPushToken('user-123');

      expect(token).toBeNull();
      expect(mockDeleteTokenEq).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalledWith('[Push Token] Registered successfully');
    });

    it('should retain a rotated token for exact cleanup during later unregister', async () => {
      let phase: 'register' | 'unregister' = 'register';
      (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
        if (key === 'puckiq_push_token_user-123') {
          return phase === 'register'
            ? 'ExponentPushToken[old-token]'
            : 'ExponentPushToken[new-token]';
        }
        if (key === 'puckiq_pending_push_tokens_user-123') {
          return phase === 'register'
            ? null
            : JSON.stringify(['ExponentPushToken[old-token]']);
        }
        return null;
      });
      (mockNotifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: 'ExponentPushToken[new-token]',
      });
      mockUpsert.mockResolvedValue({ error: null });
      mockDeleteTokenEq.mockImplementation(async (_column: string, token: string) => {
        if (phase === 'register' && token === 'ExponentPushToken[old-token]') {
          return { error: { message: 'Cleanup failed' } };
        }
        return { error: null };
      });

      const registeredToken = await registerPushToken('user-123');
      const journalCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        ([key]) => key === 'puckiq_pending_push_tokens_user-123'
      );
      expect(journalCall).toEqual([
        'puckiq_pending_push_tokens_user-123',
        JSON.stringify(['ExponentPushToken[new-token]', 'ExponentPushToken[old-token]']),
      ]);
      expect(
        (AsyncStorage.setItem as jest.Mock).mock.invocationCallOrder[
          (AsyncStorage.setItem as jest.Mock).mock.calls.indexOf(journalCall ?? [])
        ]
      ).toBeLessThan(mockUpsert.mock.invocationCallOrder[0]);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'puckiq_pending_push_tokens_user-123',
        JSON.stringify(['ExponentPushToken[new-token]', 'ExponentPushToken[old-token]'])
      );
      phase = 'unregister';
      await unregisterPushToken('user-123');

      expect(registeredToken).toBe('ExponentPushToken[new-token]');
      expect(mockDeleteTokenEq).toHaveBeenCalledWith(
        'token',
        'ExponentPushToken[new-token]'
      );
      expect(mockDeleteTokenEq).toHaveBeenCalledWith(
        'token',
        'ExponentPushToken[old-token]'
      );
      expect(mockDeleteTokenEq).not.toHaveBeenCalledWith(
        'token',
        'ExponentPushToken[other-device-token]'
      );
    });

    it('should report rollback failure without claiming registration succeeded', async () => {
      mockUpsert.mockResolvedValue({ error: null });
      (AsyncStorage.setItem as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Disk full'));
      mockDeleteTokenEq.mockResolvedValue({ error: { message: 'Cleanup failed' } });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const token = await registerPushToken('user-123');

      expect(token).toBeNull();
      expect(console.log).not.toHaveBeenCalledWith('[Push Token] Registered successfully');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Push Token] Error removing token after local tracking failure:',
        'Cleanup failed'
      );
      consoleErrorSpy.mockRestore();
    });

    it('should remove the previous device token when the token rotates', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) =>
        key === 'puckiq_push_token_user-123' ? 'ExponentPushToken[old-token]' : null
      );
      mockUpsert.mockResolvedValue({ error: null });

      const token = await registerPushToken('user-123');

      expect(token).toBe('ExponentPushToken[test-token-123]');
      expect(mockDeleteUserEq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockDeleteTokenEq).toHaveBeenCalledWith(
        'token',
        'ExponentPushToken[old-token]'
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'puckiq_push_token_user-123',
        'ExponentPushToken[test-token-123]'
      );
    });
  });

  describe('unregisterPushToken', () => {
    it('should remove token from Supabase', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) =>
        key === 'puckiq_push_token_user-123' ? 'ExponentPushToken[device-token]' : null
      );

      await unregisterPushToken('user-123');

      expect(mockDeleteUserEq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockDeleteTokenEq).toHaveBeenCalledWith(
        'token',
        'ExponentPushToken[device-token]'
      );
    });

    it('should delete an explicitly supplied device token only', async () => {
      await unregisterPushToken('user-123', 'ExponentPushToken[device-token]');

      expect(mockDeleteUserEq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockDeleteTokenEq).toHaveBeenCalledWith(
        'token',
        'ExponentPushToken[device-token]'
      );
    });

    it('should not delete every device when no device token is known', async () => {
      await unregisterPushToken('user-123');

      expect(mockDeleteUserEq).not.toHaveBeenCalled();
      expect(mockDeleteTokenEq).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalledWith('[Push Token] Unregistered successfully');
    });

    it('should handle Supabase delete errors gracefully', async () => {
      mockDeleteTokenEq.mockResolvedValue({ error: { message: 'Delete failed' } });

      await expect(
        unregisterPushToken('user-123', 'ExponentPushToken[device-token]')
      ).resolves.toBeUndefined();
      expect(console.log).not.toHaveBeenCalledWith('[Push Token] Unregistered successfully');
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
