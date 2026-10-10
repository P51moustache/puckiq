/**
 * Local game-night reminders: "set your lineup" before the first puck drop among MY players,
 * and (optionally) "your night is live" at that puck drop, which opens Tonight's live points.
 * Schedule-based, so they fire on time with no server. Asked for only when the user turns
 * them on — never at launch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { FantasyTeam } from '../types/fantasy';
import { formatPuckDrop } from './nhl/dates';
import { fantasyGamesOn, gameForTeam, type WeekSchedule } from './nhl/schedule';
import { isNhlLinked } from './fantasy/positions';

export const REMINDER_SETTINGS_KEY = 'puckiq_lineup_reminders';
const SCHEDULED_IDS_KEY = 'puckiq_lineup_reminder_ids';
const LEGACY_CLEANUP_KEY = 'puckiq_notifications_v3_migrated';
const CHANNEL_ID = 'lineup-reminders';
export const REMINDER_OPTIONS = [30, 60, 90] as const;
export type ReminderMinutes = typeof REMINDER_OPTIONS[number];
/**
 * Pending notifications kept scheduled: one week of nights with both kinds. Re-planned on
 * every launch and foreground, and well under iOS's limit of 64 pending local notifications.
 */
export const MAX_SCHEDULED_REMINDERS = 14;

export interface ReminderSettings {
  enabled: boolean;
  minutesBefore: ReminderMinutes;
  /** Also notify at the first puck drop ("your night is live"). Off for settings saved before 3.2. */
  liveStart: boolean;
}

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, minutesBefore: 60, liveStart: false };

export type ReminderKind = 'lineup' | 'live';

export interface PlannedReminder {
  kind: ReminderKind;
  date: string;
  fireAt: Date;
  title: string;
  body: string;
}

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

/**
 * Per night: a lineup reminder `minutesBefore` the earliest puck drop among players on any of
 * my teams (per-team counts in the body), and with `liveStart` a second one at that puck drop.
 */
export function planReminders(
  teams: FantasyTeam[],
  schedules: WeekSchedule[],
  options: Pick<ReminderSettings, 'minutesBefore' | 'liveStart'>,
  now: Date = new Date(),
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  const days = schedules.flatMap((schedule) => schedule.days);
  const seen = new Set<string>();

  for (const day of days) {
    if (seen.has(day.date)) continue;
    seen.add(day.date);
    const games = fantasyGamesOn(day);
    if (games.length === 0) continue;

    let first: number | null = null;
    const counts: { name: string; count: number }[] = [];
    for (const team of teams) {
      let count = 0;
      for (const player of team.players) {
        if (!isNhlLinked(player) || player.injuredReserve) continue;
        const game = gameForTeam(games, player.teamAbbrev);
        if (!game?.startTimeUTC) continue;
        count += 1;
        const start = Date.parse(game.startTimeUTC);
        if (Number.isFinite(start) && (first === null || start < first)) first = start;
      }
      if (count > 0) counts.push({ name: team.name, count });
    }
    if (first === null || counts.length === 0) continue;

    const playing = counts.length === 1 ? `${counts[0].count} of your players play tonight` : counts.map((row) => `${row.name}: ${row.count}`).join(' · ');
    const lineupAt = new Date(first - options.minutesBefore * 60 * 1000);
    if (lineupAt.getTime() > now.getTime()) {
      const firstPuck = formatPuckDrop(new Date(first).toISOString());
      planned.push({ kind: 'lineup', date: day.date, fireAt: lineupAt, title: 'Set your lineup', body: `${playing}. First puck ${firstPuck}.` });
    }
    if (options.liveStart && first > now.getTime()) {
      planned.push({ kind: 'live', date: day.date, fireAt: new Date(first), title: 'Your night is live', body: `${playing}. Follow your points live.` });
    }
  }
  return planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, MAX_SCHEDULED_REMINDERS);
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

export async function syncLineupReminders(
  teams: FantasyTeam[],
  schedules: WeekSchedule[],
  settings: ReminderSettings,
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

  const planned = planReminders(teams, schedules, settings);
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
