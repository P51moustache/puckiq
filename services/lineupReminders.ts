/**
 * Local game-night reminders: "set your lineup" before the first puck drop among MY players,
 * naming the moves to make, and (optionally) "your night is live" at that puck drop, which opens
 * Tonight's live points. Schedule-based, so they fire on time with no server. Asked for only when
 * the user turns them on — never at launch. Settings, permission and scheduling live here; which
 * nights and what they say is the pure planner in services/reminders/planner.ts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { FantasyTeam } from '../types/fantasy';
import type { WeekSchedule } from './nhl/schedule';
import { planReminders, type ReminderLineups } from './reminders/planner';

export {
  MAX_SCHEDULED_REMINDERS,
  planReminders,
  type PlannedReminder,
  type ReminderKind,
  type ReminderLineups,
  type ReminderPlanOptions,
} from './reminders/planner';

export const REMINDER_SETTINGS_KEY = 'puckiq_lineup_reminders';
const SCHEDULED_IDS_KEY = 'puckiq_lineup_reminder_ids';
const LEGACY_CLEANUP_KEY = 'puckiq_notifications_v3_migrated';
const CHANNEL_ID = 'lineup-reminders';
export const REMINDER_OPTIONS = [30, 60, 90] as const;
export type ReminderMinutes = typeof REMINDER_OPTIONS[number];

export interface ReminderSettings {
  enabled: boolean;
  minutesBefore: ReminderMinutes;
  /** Also notify at the first puck drop ("your night is live"). Off for settings saved before 3.2. */
  liveStart: boolean;
  /**
   * Skip the lineup reminder on nights the lineup carried from the night before already works.
   * On by default, including for settings saved before it existed.
   */
  onlyWhenNeeded: boolean;
}

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, minutesBefore: 60, liveStart: false, onlyWhenNeeded: true };

// Foreground: show the banner — a reminder you can't see is useless.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_SETTINGS_KEY);
    if (!raw) return DEFAULT_REMINDERS;
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      enabled: parsed.enabled === true,
      minutesBefore: REMINDER_OPTIONS.includes(parsed.minutesBefore as ReminderMinutes)
        ? (parsed.minutesBefore as ReminderMinutes)
        : DEFAULT_REMINDERS.minutesBefore,
      liveStart: parsed.liveStart === true,
      onlyWhenNeeded: parsed.onlyWhenNeeded !== false,
    };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

export async function requestReminderPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

async function cancelScheduled(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  } finally {
    await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify([]));
  }
}

/**
 * PuckIQ 1.x–2.x scheduled a repeating 9 AM "Your Pick Results" notification for a
 * picks feature that no longer exists. Clear anything left from those versions once.
 */
export async function clearLegacyNotifications(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(LEGACY_CLEANUP_KEY)) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.setItem(LEGACY_CLEANUP_KEY, new Date().toISOString());
  } catch {
    // Try again next launch.
  }
}

/**
 * Replaces every pending reminder with a fresh plan. `lineups` (services/reminders/reminderInputs.ts)
 * names each night's moves; teams it leaves out get the player count.
 */
export async function syncLineupReminders(
  teams: FantasyTeam[],
  schedules: WeekSchedule[],
  settings: ReminderSettings,
  lineups?: ReminderLineups,
): Promise<number> {
  await cancelScheduled();
  if (!settings.enabled) return 0;
  if ((await getPermissionState()) !== 'granted') return 0;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Lineup reminders',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => undefined);
  }

  const planned = planReminders(teams, schedules, settings, new Date(), lineups);
  const ids: string[] = [];
  for (const reminder of planned) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { screen: 'tonight', date: reminder.date, kind: reminder.kind },
          sound: 'default',
          ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.fireAt },
      });
      ids.push(id);
    } catch (error) {
      console.warn('[REMINDERS] Could not schedule:', error);
    }
  }
  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
  return ids.length;
}
