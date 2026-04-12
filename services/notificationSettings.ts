import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationSettings {
  enabled: boolean;
  time: string; // Format: "09:00" (24-hour format)
  notifyLockResults: boolean;
  notifySmartPickResults: boolean;
  notifyUserPickResults: boolean;
  // Game start alerts
  notifyGameStart: boolean;
  gameStartMinutesBefore: number; // 15, 30, or 60 minutes before
}

const STORAGE_KEY = 'puckiq_notification_settings';

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  time: '09:00',
  notifyLockResults: true,
  notifySmartPickResults: true,
  notifyUserPickResults: true,
  notifyGameStart: true,
  gameStartMinutesBefore: 30,
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

// Update game start notification settings
export async function updateGameStartSettings(
  enabled: boolean,
  minutesBefore?: number
): Promise<void> {
  const settings = await getNotificationSettings();
  settings.notifyGameStart = enabled;
  if (minutesBefore !== undefined) {
    settings.gameStartMinutesBefore = minutesBefore;
  }
  await saveNotificationSettings(settings);
}

// Fantasy notification preferences
export interface FantasyNotificationPreferences {
  morningBrief: boolean;      // 9am daily lineup brief
  goalieConfirmed: boolean;   // When goalie starters announced
  injuryAlerts: boolean;      // Roster player injury updates
  gameReminder: boolean;      // 30min before puck drop
  waiverAlerts: boolean;      // Morning after big performances
}

export const DEFAULT_FANTASY_PREFS: FantasyNotificationPreferences = {
  morningBrief: true,
  goalieConfirmed: true,
  injuryAlerts: true,
  gameReminder: false,
  waiverAlerts: false,
};

// Save fantasy notification preferences to Supabase
export async function saveFantasyNotificationPrefs(
  userId: string,
  prefs: FantasyNotificationPreferences
): Promise<void> {
  try {
    const { supabase } = await import('../lib/supabase');
    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          fantasy_prefs: prefs,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[Fantasy Prefs] Error saving to Supabase:', error.message);
      throw error;
    }
  } catch (error) {
    console.error('[Fantasy Prefs] Error saving preferences:', error);
    throw error;
  }
}

// Load fantasy notification preferences from Supabase
export async function loadFantasyNotificationPrefs(
  userId: string
): Promise<FantasyNotificationPreferences> {
  try {
    const { supabase } = await import('../lib/supabase');
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('fantasy_prefs')
      .eq('user_id', userId)
      .single();

    if (error || !data?.fantasy_prefs) {
      return { ...DEFAULT_FANTASY_PREFS };
    }

    // Merge with defaults in case new prefs were added
    return { ...DEFAULT_FANTASY_PREFS, ...data.fantasy_prefs };
  } catch (error) {
    console.error('[Fantasy Prefs] Error loading preferences:', error);
    return { ...DEFAULT_FANTASY_PREFS };
  }
}
