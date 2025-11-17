import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
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
      // Get yesterday's user picks
      const allPicks = await getAllPicks();
      const yesterdaysPicks = allPicks.filter(
        p => p.type === 'user-pick' && p.date === yesterdayResults.lock?.date
      );
      picksToInclude.push(...yesterdaysPicks);
    }

    // Filter to only completed picks
    const completedPicks = picksToInclude.filter(p => p.outcome);

    // Skip if no picks were made or no games finished
    if (completedPicks.length === 0) {
      return null;
    }

    // Calculate results
    const wins = completedPicks.filter(p => p.outcome === 'win').length;
    const losses = completedPicks.filter(p => p.outcome === 'loss').length;
    const pushes = completedPicks.filter(p => p.outcome === 'push').length;

    const total = wins + losses;
    const accuracy = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Format body text
    let body: string;
    if (pushes > 0) {
      body = `Yesterday: ${wins}-${losses}-${pushes} (${accuracy}%) 🏒`;
    } else {
      body = `Yesterday: ${wins}-${losses} (${accuracy}%) 🏒`;
    }

    // Add emoji for perfect or terrible days
    if (accuracy === 100 && total > 0) {
      body = body.replace('🏒', '🔥');
    } else if (accuracy === 0 && total > 0) {
      body = body.replace('🏒', '❄️');
    }

    return {
      title: 'Your Pick Results 🏒',
      body,
      data: { screen: 'pickHistory' },
    };
  } catch (error) {
    console.error('Error creating notification content:', error);
    return null;
  }
}

// Schedule daily notification at specified time
export async function scheduleDailyNotification(time: string = '09:00'): Promise<void> {
  try {
    // Cancel any existing notifications
    await cancelAllNotifications();

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

    // Only schedule if we have content to show
    // Note: For daily notifications, we'll create content dynamically each day
    // So we schedule a repeating notification and generate content on trigger
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your Pick Results 🏒',
        body: 'Check how you did yesterday!',
        data: { screen: 'pickHistory' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });

    console.log(`Notification scheduled for ${time} daily`);
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
          title: 'Test Notification 🏒',
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
