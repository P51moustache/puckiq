/** Where the count of days of real use is kept (this device only). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayNhl } from '../nhl/dates';
import { addForegroundTime, NO_ACTIVE_DAYS, parseActiveDays, type ActiveDays } from './activeDays';

export const ACTIVE_DAYS_KEY = 'puckiq_active_days';

export async function loadActiveDays(): Promise<ActiveDays> {
  try {
    return parseActiveDays(await AsyncStorage.getItem(ACTIVE_DAYS_KEY));
  } catch {
    return NO_ACTIVE_DAYS;
  }
}

/** Adds a stretch of foreground time to today (the NHL calendar day, like the rest of the app). */
export async function logForegroundTime(ms: number, now: Date = new Date()): Promise<void> {
  const next = addForegroundTime(await loadActiveDays(), todayNhl(now), ms);
  await AsyncStorage.setItem(ACTIVE_DAYS_KEY, JSON.stringify(next)).catch(() => undefined);
}
