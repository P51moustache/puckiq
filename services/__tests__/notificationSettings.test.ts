import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getNotificationSettings,
  saveNotificationSettings,
  updateNotificationTime,
  toggleNotifications,
  updateNotificationTypes,
  updateGameStartSettings,
  NotificationSettings,
} from '../notificationSettings';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  time: '09:00',
  notifyLockResults: true,
  notifySmartPickResults: true,
  notifyUserPickResults: true,
  notifyGameStart: true,
  gameStartMinutesBefore: 30,
};

describe('notificationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
  });

  describe('getNotificationSettings', () => {
    it('should return default settings when no settings are stored', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const settings = await getNotificationSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should return stored settings when available', async () => {
      const storedSettings: NotificationSettings = {
        enabled: false,
        time: '10:00',
        notifyLockResults: false,
        notifySmartPickResults: true,
        notifyUserPickResults: false,
        notifyGameStart: false,
        gameStartMinutesBefore: 15,
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(storedSettings));

      const settings = await getNotificationSettings();

      expect(settings).toEqual(storedSettings);
    });

    it('should merge stored settings with defaults for new properties', async () => {
      // Simulate old settings without gameStartMinutesBefore
      const oldSettings = {
        enabled: false,
        time: '10:00',
        notifyLockResults: true,
        notifySmartPickResults: true,
        notifyUserPickResults: true,
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(oldSettings));

      const settings = await getNotificationSettings();

      expect(settings.gameStartMinutesBefore).toBe(30); // Default value
      expect(settings.notifyGameStart).toBe(true); // Default value
      expect(settings.enabled).toBe(false); // Stored value
    });

    it('should return default settings on error', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const settings = await getNotificationSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('saveNotificationSettings', () => {
    it('should save settings to AsyncStorage', async () => {
      const settings: NotificationSettings = {
        enabled: true,
        time: '08:00',
        notifyLockResults: true,
        notifySmartPickResults: false,
        notifyUserPickResults: true,
        notifyGameStart: true,
        gameStartMinutesBefore: 60,
      };

      await saveNotificationSettings(settings);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'puckiq_notification_settings',
        JSON.stringify(settings)
      );
    });

    it('should throw error when save fails', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Save error'));

      const settings: NotificationSettings = { ...DEFAULT_SETTINGS };

      await expect(saveNotificationSettings(settings)).rejects.toThrow('Save error');
    });
  });

  describe('updateNotificationTime', () => {
    it('should update the notification time', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));

      await updateNotificationTime('07:30');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'puckiq_notification_settings',
        expect.stringContaining('"time":"07:30"')
      );
    });

    it('should preserve other settings when updating time', async () => {
      const currentSettings: NotificationSettings = {
        ...DEFAULT_SETTINGS,
        enabled: false,
        notifyLockResults: false,
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(currentSettings));

      await updateNotificationTime('11:00');

      const savedSettings = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1]
      ) as NotificationSettings;

      expect(savedSettings.time).toBe('11:00');
      expect(savedSettings.enabled).toBe(false);
      expect(savedSettings.notifyLockResults).toBe(false);
    });
  });

  describe('toggleNotifications', () => {
    it('should enable notifications', async () => {
      const currentSettings = { ...DEFAULT_SETTINGS, enabled: false };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(currentSettings));

      await toggleNotifications(true);

      const savedSettings = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1]
      ) as NotificationSettings;

      expect(savedSettings.enabled).toBe(true);
    });

    it('should disable notifications', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));

      await toggleNotifications(false);

      const savedSettings = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1]
      ) as NotificationSettings;

      expect(savedSettings.enabled).toBe(false);
    });
  });

  describe('updateNotificationTypes', () => {
    it('should update all notification types', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));

      await updateNotificationTypes(false, true, false);

      const savedSettings = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1]
      ) as NotificationSettings;

      expect(savedSettings.notifyLockResults).toBe(false);
      expect(savedSettings.notifySmartPickResults).toBe(true);
      expect(savedSettings.notifyUserPickResults).toBe(false);
    });

    it('should preserve other settings when updating types', async () => {
      const currentSettings: NotificationSettings = {
        ...DEFAULT_SETTINGS,
        time: '06:00',
        gameStartMinutesBefore: 15,
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(currentSettings));

      await updateNotificationTypes(true, false, true);

      const savedSettings = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1]
      ) as NotificationSettings;

      expect(savedSettings.time).toBe('06:00');
      expect(savedSettings.gameStartMinutesBefore).toBe(15);
    });
  });

  describe('updateGameStartSettings', () => {
    it('should enable game start notifications', async () => {
      const currentSettings = { ...DEFAULT_SETTINGS, notifyGameStart: false };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(currentSettings));

      await updateGameStartSettings(true);

      const savedSettings = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1]
      ) as NotificationSettings;

      expect(savedSettings.notifyGameStart).toBe(true);
    });

    it('should disable game start notifications', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));

      await updateGameStartSettings(false);

      const savedSettings = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1]
      ) as NotificationSettings;

      expect(savedSettings.notifyGameStart).toBe(false);
    });

    it('should update minutes before when provided', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));

      await updateGameStartSettings(true, 60);

      const savedSettings = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1]
      ) as NotificationSettings;

      expect(savedSettings.notifyGameStart).toBe(true);
      expect(savedSettings.gameStartMinutesBefore).toBe(60);
    });

    it('should not change minutes when not provided', async () => {
      const currentSettings = { ...DEFAULT_SETTINGS, gameStartMinutesBefore: 15 };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(currentSettings));

      await updateGameStartSettings(false);

      const savedSettings = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1]
      ) as NotificationSettings;

      expect(savedSettings.gameStartMinutesBefore).toBe(15);
    });
  });
});
