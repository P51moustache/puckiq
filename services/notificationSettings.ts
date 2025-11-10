import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationSettings {
  enabled: boolean;
  time: string; // Format: "09:00" (24-hour format)
  notifyLockResults: boolean;
  notifySmartPickResults: boolean;
  notifyUserPickResults: boolean;
}

const STORAGE_KEY = 'puckiq_notification_settings';

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  time: '09:00',
  notifyLockResults: true,
  notifySmartPickResults: true,
  notifyUserPickResults: true,
};

// Get notification settings from storage
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (json) {
      const settings = JSON.parse(json);
      // Merge with defaults in case new settings were added
      return { ...DEFAULT_SETTINGS, ...settings };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error loading notification settings:', error);
    return DEFAULT_SETTINGS;
  }
}

// Save notification settings to storage
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving notification settings:', error);
    throw error;
  }
}

// Update notification time
export async function updateNotificationTime(time: string): Promise<void> {
  const settings = await getNotificationSettings();
  settings.time = time;
  await saveNotificationSettings(settings);
}

// Toggle notifications on/off
export async function toggleNotifications(enabled: boolean): Promise<void> {
  const settings = await getNotificationSettings();
  settings.enabled = enabled;
  await saveNotificationSettings(settings);
}

// Update which pick types to include in notifications
export async function updateNotificationTypes(
  lock: boolean,
  smartPicks: boolean,
  userPicks: boolean
): Promise<void> {
  const settings = await getNotificationSettings();
  settings.notifyLockResults = lock;
  settings.notifySmartPickResults = smartPicks;
  settings.notifyUserPickResults = userPicks;
  await saveNotificationSettings(settings);
}
