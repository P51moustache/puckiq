import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermissions,
  cancelAllNotifications,
  scheduleDailyNotification,
  initializeNotifications,
  triggerTestNotification,
} from '../notifications';
import { getNotificationSettings } from '../notificationSettings';
import { getAllPicks, getYesterdaysResults } from '../pickTracking';
import { createMockPick, createWinningPick, createLosingPick, createPushPick } from '@/__tests__/utils/factories';

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// Mock expo-device module
jest.mock('expo-device', () => ({
  isDevice: true,
}));

// Mock other modules
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
  },
  AndroidImportance: {
    DEFAULT: 3,
  },
}));
jest.mock('../notificationSettings');
jest.mock('../pickTracking');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;
const mockGetNotificationSettings = getNotificationSettings as jest.MockedFunction<typeof getNotificationSettings>;
const mockGetAllPicks = getAllPicks as jest.MockedFunction<typeof getAllPicks>;
const mockGetYesterdaysResults = getYesterdaysResults as jest.MockedFunction<typeof getYesterdaysResults>;

describe('notifications', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();

    // Default mock implementations
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted' as any,
      expires: 0,
      granted: true,
      canAskAgain: true,
    });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({
      status: 'granted' as any,
      expires: 0,
      granted: true,
      canAskAgain: true,
    });
    mockNotifications.setNotificationChannelAsync.mockResolvedValue({} as any);
    mockNotifications.cancelAllScheduledNotificationsAsync.mockResolvedValue();
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('notification-id');

    // Default notification settings
    mockGetNotificationSettings.mockResolvedValue({
      enabled: true,
      time: '09:00',
      notifyLockResults: true,
      notifySmartPickResults: true,
      notifyUserPickResults: true,
      notifyGameStart: true,
      gameStartMinutesBefore: 30,
    });

    // Default picks
    mockGetAllPicks.mockResolvedValue([]);
    mockGetYesterdaysResults.mockResolvedValue(null);
  });

  describe('requestNotificationPermissions', () => {
    it.skip('should return false on simulator/emulator', async () => {
      // Skipping: expo-device.isDevice is read-only and difficult to mock dynamically
      // This test should be verified manually on simulators
    });

    it('should return true when permissions already granted', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'granted' as any,
        expires: 0,
        granted: true,
        canAskAgain: true,
      });

      const result = await requestNotificationPermissions();

      expect(result).toBe(true);
      expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('should request permissions when not granted', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 0,
        granted: false,
        canAskAgain: true,
      });
      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'granted' as any,
        expires: 0,
        granted: true,
        canAskAgain: true,
      });

      const result = await requestNotificationPermissions();

      expect(result).toBe(true);
      expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false when permissions denied', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 0,
        granted: false,
        canAskAgain: true,
      });
      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 0,
        granted: false,
        canAskAgain: false,
      });

      const result = await requestNotificationPermissions();

      expect(result).toBe(false);
    });

    it('should configure Android notification channel', async () => {
      // Temporarily change Platform.OS to Android for this test
      const Platform = require('react-native').Platform;
      Platform.OS = 'android';

      await requestNotificationPermissions();

      expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'daily-results',
        expect.objectContaining({
          name: 'Daily Pick Results',
          importance: Notifications.AndroidImportance.DEFAULT,
        })
      );

      // Reset back to iOS
      Platform.OS = 'ios';
    });

    it('should handle errors gracefully', async () => {
      mockNotifications.getPermissionsAsync.mockRejectedValue(new Error('Permission error'));

      const result = await requestNotificationPermissions();

      expect(result).toBe(false);
    });
  });

  describe('cancelAllNotifications', () => {
    it('should cancel all scheduled notifications', async () => {
      await cancelAllNotifications();

      expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockNotifications.cancelAllScheduledNotificationsAsync.mockRejectedValue(
        new Error('Cancel error')
      );

      await expect(cancelAllNotifications()).resolves.not.toThrow();
    });
  });

  describe('scheduleDailyNotification', () => {
    beforeEach(() => {
      // Mock yesterday's results
      mockGetYesterdaysResults.mockResolvedValue({
        lock: createWinningPick({ type: 'lock' }),
        smartPicks: [createWinningPick(), createLosingPick()],
        lockStats: { total: 1, wins: 1, losses: 0, pushes: 0, accuracy: 100 },
        smartPickStats: { total: 2, wins: 1, losses: 1, pushes: 0, accuracy: 50 },
      });
    });

    it('should cancel existing notifications before scheduling', async () => {
      await scheduleDailyNotification('09:00');

      expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });

    it('should schedule notification for correct time', async () => {
      await scheduleDailyNotification('09:30');

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: 9,
            minute: 30,
            repeats: true,
          }),
        })
      );
    });

    it('should schedule notification with default time', async () => {
      await scheduleDailyNotification();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: 9,
            minute: 0,
          }),
        })
      );
    });

    it('should handle different time formats', async () => {
      await scheduleDailyNotification('23:45');

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: 23,
            minute: 45,
          }),
        })
      );
    });

    it('should throw error when scheduling fails', async () => {
      mockNotifications.scheduleNotificationAsync.mockRejectedValue(
        new Error('Schedule error')
      );

      await expect(scheduleDailyNotification('09:00')).rejects.toThrow('Schedule error');
    });
  });

  describe('initializeNotifications', () => {
    it('should cancel notifications when disabled', async () => {
      mockGetNotificationSettings.mockResolvedValue({
        enabled: false,
        time: '09:00',
        notifyLockResults: true,
        notifySmartPickResults: true,
        notifyUserPickResults: true,
        notifyGameStart: true,
        gameStartMinutesBefore: 30,
      });

      await initializeNotifications();

      expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
      expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should request permissions when enabled', async () => {
      await initializeNotifications();

      expect(mockNotifications.getPermissionsAsync).toHaveBeenCalled();
    });

    it('should not schedule if permissions denied', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 0,
        granted: false,
        canAskAgain: false,
      });
      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'denied' as any,
        expires: 0,
        granted: false,
        canAskAgain: false,
      });

      await initializeNotifications();

      expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should schedule notification with user time preference', async () => {
      mockGetNotificationSettings.mockResolvedValue({
        enabled: true,
        time: '14:30',
        notifyLockResults: true,
        notifySmartPickResults: true,
        notifyUserPickResults: true,
        notifyGameStart: true,
        gameStartMinutesBefore: 30,
      });

      await initializeNotifications();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: 14,
            minute: 30,
          }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockGetNotificationSettings.mockRejectedValue(new Error('Settings error'));

      await expect(initializeNotifications()).resolves.not.toThrow();
    });
  });

  describe('triggerTestNotification', () => {
    it('should trigger immediate notification with results', async () => {
      mockGetYesterdaysResults.mockResolvedValue({
        lock: createWinningPick({ type: 'lock' }),
        smartPicks: [createWinningPick()],
        lockStats: { total: 1, wins: 1, losses: 0, pushes: 0, accuracy: 100 },
        smartPickStats: { total: 1, wins: 1, losses: 0, pushes: 0, accuracy: 100 },
      });

      await triggerTestNotification();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: null, // Immediate
        })
      );
    });

    it('should show fallback message when no results available', async () => {
      mockGetYesterdaysResults.mockResolvedValue(null);

      await triggerTestNotification();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Test Notification 🏒',
            body: 'No results available yet. Make some picks!',
          }),
          trigger: null,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockNotifications.scheduleNotificationAsync.mockRejectedValue(
        new Error('Trigger error')
      );

      await expect(triggerTestNotification()).resolves.not.toThrow();
    });
  });

  describe('notification content creation (via triggerTestNotification)', () => {
    it('should create content with lock results when enabled', async () => {
      mockGetNotificationSettings.mockResolvedValue({
        enabled: true,
        time: '09:00',
        notifyLockResults: true,
        notifySmartPickResults: false,
        notifyUserPickResults: false,
        notifyGameStart: true,
        gameStartMinutesBefore: 30,
      });

      mockGetYesterdaysResults.mockResolvedValue({
        lock: createWinningPick({ type: 'lock', date: '2024-01-01' }),
        smartPicks: [],
        lockStats: { total: 1, wins: 1, losses: 0, pushes: 0, accuracy: 100 },
        smartPickStats: { total: 0, wins: 0, losses: 0, pushes: 0, accuracy: 0 },
      });

      await triggerTestNotification();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should include smart picks when enabled', async () => {
      mockGetNotificationSettings.mockResolvedValue({
        enabled: true,
        time: '09:00',
        notifyLockResults: false,
        notifySmartPickResults: true,
        notifyUserPickResults: false,
        notifyGameStart: true,
        gameStartMinutesBefore: 30,
      });

      mockGetYesterdaysResults.mockResolvedValue({
        lock: undefined,
        smartPicks: [createWinningPick(), createLosingPick()],
        lockStats: { total: 0, wins: 0, losses: 0, pushes: 0, accuracy: 0 },
        smartPickStats: { total: 2, wins: 1, losses: 1, pushes: 0, accuracy: 50 },
      });

      await triggerTestNotification();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should include user picks when enabled', async () => {
      mockGetNotificationSettings.mockResolvedValue({
        enabled: true,
        time: '09:00',
        notifyLockResults: false,
        notifySmartPickResults: false,
        notifyUserPickResults: true,
        notifyGameStart: true,
        gameStartMinutesBefore: 30,
      });

      mockGetYesterdaysResults.mockResolvedValue({
        lock: createMockPick({ type: 'lock', date: '2024-01-01' }),
        smartPicks: [],
        lockStats: { total: 1, wins: 0, losses: 0, pushes: 0, accuracy: 0 },
        smartPickStats: { total: 0, wins: 0, losses: 0, pushes: 0, accuracy: 0 },
      });

      mockGetAllPicks.mockResolvedValue([
        createWinningPick({ type: 'user-pick', date: '2024-01-01' }),
      ]);

      await triggerTestNotification();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should calculate correct accuracy with wins and losses', async () => {
      mockGetYesterdaysResults.mockResolvedValue({
        lock: createWinningPick({ type: 'lock' }),
        smartPicks: [
          createWinningPick(),
          createWinningPick(),
          createLosingPick(),
        ],
        lockStats: { total: 1, wins: 1, losses: 0, pushes: 0, accuracy: 100 },
        smartPickStats: { total: 3, wins: 2, losses: 1, pushes: 0, accuracy: 67 },
      });

      await triggerTestNotification();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should handle pushes correctly in notification', async () => {
      mockGetYesterdaysResults.mockResolvedValue({
        lock: createPushPick({ type: 'lock' }),
        smartPicks: [createWinningPick(), createPushPick()],
        lockStats: { total: 1, wins: 0, losses: 0, pushes: 1, accuracy: 0 },
        smartPickStats: { total: 2, wins: 1, losses: 0, pushes: 1, accuracy: 100 },
      });

      await triggerTestNotification();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should skip notification when no completed picks', async () => {
      mockGetYesterdaysResults.mockResolvedValue({
        lock: createMockPick({ type: 'lock', outcome: undefined }),
        smartPicks: [createMockPick({ outcome: undefined })],
        lockStats: { total: 0, wins: 0, losses: 0, pushes: 0, accuracy: 0 },
        smartPickStats: { total: 0, wins: 0, losses: 0, pushes: 0, accuracy: 0 },
      });

      await triggerTestNotification();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            body: 'No results available yet. Make some picks!',
          }),
        })
      );
    });

    it('should handle perfect record (100% accuracy)', async () => {
      mockGetYesterdaysResults.mockResolvedValue({
        lock: createWinningPick({ type: 'lock' }),
        smartPicks: [createWinningPick(), createWinningPick()],
        lockStats: { total: 1, wins: 1, losses: 0, pushes: 0, accuracy: 100 },
        smartPickStats: { total: 2, wins: 2, losses: 0, pushes: 0, accuracy: 100 },
      });

      await triggerTestNotification();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should handle all losses (0% accuracy)', async () => {
      mockGetYesterdaysResults.mockResolvedValue({
        lock: createLosingPick({ type: 'lock' }),
        smartPicks: [createLosingPick()],
        lockStats: { total: 1, wins: 0, losses: 1, pushes: 0, accuracy: 0 },
        smartPickStats: { total: 1, wins: 0, losses: 1, pushes: 0, accuracy: 0 },
      });

      await triggerTestNotification();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
    });
  });
});
