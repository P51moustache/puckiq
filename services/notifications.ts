import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getNotificationSettings } from './notificationSettings';
import { getAllPicks, getYesterdaysResults, Pick } from './pickTracking';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Don't show alerts when app is in foreground
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  // Check if physical device (notifications don't work on all simulators)
  if (!Device.isDevice) {
    console.log('Notifications only work on physical devices');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get notification permissions');
      return false;
    }

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-results', {
        name: 'Daily Pick Results',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#60a5fa',
      });
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

// Cancel all scheduled notifications
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
}

// Create notification content from yesterday's results
async function createNotificationContent(): Promise<{
  title: string;
  body: string;
  data: any;
} | null> {
  try {
    const settings = await getNotificationSettings();
    const yesterdayResults = await getYesterdaysResults();

    // Skip if no results available
    if (!yesterdayResults) {
      return null;
    }

    // Collect picks based on user settings
    const picksToInclude: Pick[] = [];

    if (settings.notifyLockResults && yesterdayResults.lock) {
      picksToInclude.push(yesterdayResults.lock);
    }

    if (settings.notifySmartPickResults) {
      picksToInclude.push(...yesterdayResults.smartPicks);
    }

    if (settings.notifyUserPickResults) {
      const allPicks = await getAllPicks();
      const resultsDate =
        yesterdayResults.lock?.date ??
        yesterdayResults.smartPicks[0]?.date ??
        yesterdayResults.userPicks[0]?.date;
      const yesterdaysPicks = allPicks.filter(
        p => p.type === 'user-pick' && p.date === resultsDate
      );
      picksToInclude.push(...yesterdaysPicks);
    }

    // Filter to only completed picks
    const completedPicks = picksToInclude.filter(p => p.outcome);

    // Skip if no picks were made or no games finished
    if (completedPicks.length === 0) {
      return null;
    }

    const resultsDate = completedPicks[0].date;

    // Calculate results
    const wins = completedPicks.filter(p => p.outcome === 'win').length;
    const losses = completedPicks.filter(p => p.outcome === 'loss').length;
    const pushes = completedPicks.filter(p => p.outcome === 'push').length;

    const total = wins + losses;
    const accuracy = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Format body text
    let body: string;
    if (pushes > 0) {
      body = `Results for ${resultsDate}: ${wins}-${losses}-${pushes} (${accuracy}%)`;
    } else {
      body = `Results for ${resultsDate}: ${wins}-${losses} (${accuracy}%)`;
    }

    // Add suffix for perfect or terrible days
    if (accuracy === 100 && total > 0) {
      body += ' - On fire!';
    } else if (accuracy === 0 && total > 0) {
      body += ' - Ice cold';
    }

    return {
      title: `Your Pick Results — ${resultsDate}`,
      body,
      data: { screen: 'pickHistory', resultsDate },
    };
  } catch (error) {
    console.error('Error creating notification content:', error);
    return null;
  }
}

const PUSH_TOKEN_STORAGE_KEY_PREFIX = 'puckiq_push_token_';
const PENDING_PUSH_TOKEN_STORAGE_KEY_PREFIX = 'puckiq_pending_push_tokens_';
const DAILY_NOTIFICATION_STORAGE_KEY = 'puckiq_daily_notification_id';

function getPushTokenStorageKey(userId: string): string {
  return `${PUSH_TOKEN_STORAGE_KEY_PREFIX}${userId}`;
}

function getPendingPushTokenStorageKey(userId: string): string {
  return `${PENDING_PUSH_TOKEN_STORAGE_KEY_PREFIX}${userId}`;
}

async function getStoredPushToken(userId: string): Promise<string | null> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  return await AsyncStorage.getItem(getPushTokenStorageKey(userId));
}

async function storePushToken(userId: string, token: string): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(getPushTokenStorageKey(userId), token);
}

async function getPendingPushTokens(userId: string): Promise<string[]> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const json = await AsyncStorage.getItem(getPendingPushTokenStorageKey(userId));
  if (!json) {
    return [];
  }

  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || parsed.some(token => typeof token !== 'string')) {
    throw new Error('Invalid pending push token record');
  }
  return parsed;
}

async function addPendingPushTokens(userId: string, tokens: string[]): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const pendingTokens = await getPendingPushTokens(userId);
  const nextPendingTokens = Array.from(new Set([...pendingTokens, ...tokens]));
  if (nextPendingTokens.length !== pendingTokens.length) {
    await AsyncStorage.setItem(
      getPendingPushTokenStorageKey(userId),
      JSON.stringify(nextPendingTokens)
    );
  }
}

async function removePendingPushToken(userId: string, token: string): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const remainingTokens = (await getPendingPushTokens(userId)).filter(
    pendingToken => pendingToken !== token
  );
  if (remainingTokens.length === 0) {
    await AsyncStorage.removeItem(getPendingPushTokenStorageKey(userId));
  } else {
    await AsyncStorage.setItem(
      getPendingPushTokenStorageKey(userId),
      JSON.stringify(remainingTokens)
    );
  }
}

async function clearStoredPushToken(userId: string, token: string): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const storedToken = await AsyncStorage.getItem(getPushTokenStorageKey(userId));
    if (storedToken === token) {
      await AsyncStorage.removeItem(getPushTokenStorageKey(userId));
    }
  } catch (error) {
    console.error('[Push Token] Error clearing local token:', error);
  }
}

async function getStoredDailyNotificationId(): Promise<string | null> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  return await AsyncStorage.getItem(DAILY_NOTIFICATION_STORAGE_KEY);
}

async function storeDailyNotificationId(notificationId: string): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(DAILY_NOTIFICATION_STORAGE_KEY, notificationId);
}

async function cancelScheduledDailyNotification(): Promise<void> {
  const notificationId = await getStoredDailyNotificationId();
  if (!notificationId) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId);
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.removeItem(DAILY_NOTIFICATION_STORAGE_KEY);
}

async function deletePushToken(userId: string, token: string): Promise<{ message?: string } | null> {
  const { supabase } = await import('../lib/supabase');
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);
  return error;
}

function getExpoProjectId(): string | null {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof projectId === 'string' && projectId.length > 0 ? projectId : null;
}

// Schedule daily notification at specified time
export async function scheduleDailyNotification(time: string = '09:00'): Promise<void> {
  try {
    await cancelScheduledDailyNotification();

    // Parse time (format: "HH:MM")
    const [hours, minutes] = time.split(':').map(Number);

    // Calculate next trigger time
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    // Create notification content
    const content = await createNotificationContent();

    if (!content) {
      console.log('[Notification] No daily results content; skipping schedule');
      return;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: scheduledTime,
      },
    });

    try {
      await storeDailyNotificationId(notificationId);
    } catch (storageError) {
      console.error('[Notification] Error storing daily notification ID:', storageError);
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      } catch (cleanupError) {
        console.error('[Notification] Error cancelling unowned daily notification:', cleanupError);
      }
      throw storageError;
    }

    console.log(`Notification scheduled for ${scheduledTime.toISOString()}`);
  } catch (error) {
    console.error('Error scheduling notification:', error);
    throw error;
  }
}

// Initialize notification system
export async function initializeNotifications(): Promise<void> {
  try {
    const settings = await getNotificationSettings();

    if (!settings.enabled) {
      await cancelAllNotifications();
      return;
    }

    const hasPermission = await requestNotificationPermissions();

    if (!hasPermission) {
      console.log('Notification permissions not granted');
      return;
    }

    await scheduleDailyNotification(settings.time);
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
}

// Get notification response listener (for when user taps notification)
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

// Trigger immediate test notification (for testing purposes)
export async function triggerTestNotification(): Promise<void> {
  try {
    const content = await createNotificationContent();

    if (!content) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test Notification',
          body: 'No results available yet. Make some picks!',
          data: { screen: 'pickHistory' },
        },
        trigger: null, // Immediate
      });
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: null, // Immediate
    });
  } catch (error) {
    console.error('Error triggering test notification:', error);
  }
}

// Storage key for scheduled game notifications
const GAME_NOTIFICATIONS_KEY = 'puckiq_scheduled_game_notifications';

// Schedule a game start notification
export async function scheduleGameStartNotification(
  gameId: string,
  homeTeam: string,
  awayTeam: string,
  startTimeUTC: string,
  minutesBefore: number,
  predictedWinner: string
): Promise<string | null> {
  try {
    // Check if physical device
    if (!Device.isDevice) {
      console.log('[Game Notification] Skipping - not a physical device');
      return null;
    }

    const settings = await getNotificationSettings();
    if (!settings.enabled || !settings.notifyGameStart) {
      console.log('[Game Notification] Game start notifications disabled');
      return null;
    }

    const gameTime = new Date(startTimeUTC);
    const notificationTime = new Date(gameTime.getTime() - minutesBefore * 60 * 1000);

    // Don't schedule if notification time is in the past
    if (notificationTime <= new Date()) {
      console.log('[Game Notification] Notification time is in the past, skipping');
      return null;
    }

    // Cancel any existing notification for this game
    await cancelGameNotification(gameId);

    // Configure Android channel for game alerts
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('game-alerts', {
        name: 'Game Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10b981',
      });
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${awayTeam} @ ${homeTeam} starting soon!`,
        body: `Your pick: ${predictedWinner} - Game starts in ${minutesBefore} minutes`,
        data: {
          screen: 'home',
          gameId,
          type: 'game-start',
        },
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'game-alerts' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notificationTime,
      },
    });

    // Store the notification ID for later cancellation
    await storeGameNotification(gameId, notificationId);

    console.log(`[Game Notification] Scheduled for ${notificationTime.toLocaleString()}`);
    return notificationId;
  } catch (error) {
    console.error('[Game Notification] Error scheduling:', error);
    return null;
  }
}

// Cancel a game notification by game ID
export async function cancelGameNotification(gameId: string): Promise<void> {
  try {
    const notifications = await getStoredGameNotifications();
    const notificationId = notifications[gameId];

    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      delete notifications[gameId];
      await saveGameNotifications(notifications);
      console.log(`[Game Notification] Cancelled notification for game ${gameId}`);
    }
  } catch (error) {
    console.error('[Game Notification] Error cancelling:', error);
  }
}

// Helper functions for storing game notification IDs
async function getStoredGameNotifications(): Promise<Record<string, string>> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const json = await AsyncStorage.getItem(GAME_NOTIFICATIONS_KEY);
    return json ? JSON.parse(json) : {};
  } catch (error) {
    return {};
  }
}

async function storeGameNotification(gameId: string, notificationId: string): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const notifications = await getStoredGameNotifications();
    notifications[gameId] = notificationId;
    await AsyncStorage.setItem(GAME_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error('[Game Notification] Error storing notification ID:', error);
  }
}

async function saveGameNotifications(notifications: Record<string, string>): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(GAME_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error('[Game Notification] Error saving notifications:', error);
  }
}

// Register push token for a user and save to Supabase
export async function registerPushToken(userId: string): Promise<string | null> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[Push Token] Permission not granted');
      return null;
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      console.error('[Push Token] EAS project ID is not configured');
      return null;
    }

    const previousToken = await getStoredPushToken(userId);
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    if (!token) {
      console.error('[Push Token] Expo returned an empty token');
      return null;
    }

    await addPendingPushTokens(
      userId,
      previousToken && previousToken !== token ? [token, previousToken] : [token]
    );

    const { supabase } = await import('../lib/supabase');
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
        },
        { onConflict: 'user_id,token' }
      );

    if (error) {
      console.error('[Push Token] Error saving token to Supabase:', error.message);
      return null;
    }

    try {
      await storePushToken(userId, token);
    } catch (storageError) {
      console.error('[Push Token] Error storing local token:', storageError);
      if (previousToken === token) {
        console.error('[Push Token] Preserving existing server token after local tracking failure');
        return null;
      }
      try {
        const cleanupError = await deletePushToken(userId, token);
        if (cleanupError) {
          console.error(
            '[Push Token] Error removing token after local tracking failure:',
            cleanupError.message
          );
        }
      } catch (cleanupError) {
        console.error(
          '[Push Token] Error removing token after local tracking failure:',
          cleanupError
        );
      }
      return null;
    }

    try {
      await removePendingPushToken(userId, token);
    } catch (pendingStorageError) {
      console.error('[Push Token] Error clearing current token journal:', pendingStorageError);
    }

    let rotatedTokenCleanupFailed = false;
    if (previousToken && previousToken !== token) {
      try {
        const cleanupError = await deletePushToken(userId, previousToken);
        if (cleanupError) {
          rotatedTokenCleanupFailed = true;
          console.error(
            '[Push Token] Error removing rotated token from Supabase:',
            cleanupError.message
          );
        }
      } catch (cleanupError) {
        rotatedTokenCleanupFailed = true;
        console.error('[Push Token] Error removing rotated token from Supabase:', cleanupError);
      }

      if (!rotatedTokenCleanupFailed) {
        try {
          await removePendingPushToken(userId, previousToken);
        } catch (pendingStorageError) {
          console.error('[Push Token] Error clearing rotated token record:', pendingStorageError);
        }
      }
    }

    if (rotatedTokenCleanupFailed) {
      console.error('[Push Token] New token registered; previous token cleanup failed');
    } else {
      console.log('[Push Token] Registered successfully');
    }
    return token;
  } catch (error) {
    console.error('[Push Token] Error registering:', error);
    return null;
  }
}

// Unregister push token for a user
export async function unregisterPushToken(userId: string, token?: string): Promise<void> {
  try {
    const storedToken = token ?? await getStoredPushToken(userId);
    const pendingTokens = await getPendingPushTokens(userId);
    const deviceTokens = Array.from(
      new Set([storedToken, ...pendingTokens].filter((value): value is string => Boolean(value)))
    );
    if (deviceTokens.length === 0) {
      console.log('[Push Token] No device token found; skipping unregister');
      return;
    }

    let hasErrors = false;
    for (const deviceToken of deviceTokens) {
      const error = await deletePushToken(userId, deviceToken);
      if (error) {
        hasErrors = true;
        console.error('[Push Token] Error removing token from Supabase:', error.message);
        continue;
      }

      await clearStoredPushToken(userId, deviceToken);
      if (pendingTokens.includes(deviceToken)) {
        try {
          await removePendingPushToken(userId, deviceToken);
        } catch (pendingStorageError) {
          hasErrors = true;
          console.error('[Push Token] Error clearing pending token:', pendingStorageError);
        }
      }
    }

    if (!hasErrors) {
      console.log('[Push Token] Unregistered successfully');
    }
  } catch (error) {
    console.error('[Push Token] Error unregistering:', error);
  }
}
