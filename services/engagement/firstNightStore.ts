/** Where the first-night guide's progress is kept (this device only). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseFirstNight, startFirstNight, type FirstNightState } from './firstNight';

export const FIRST_NIGHT_KEY = 'puckiq_first_night';

export async function loadFirstNight(): Promise<FirstNightState | null> {
  try {
    return parseFirstNight(await AsyncStorage.getItem(FIRST_NIGHT_KEY));
  } catch {
    return null;
  }
}

export async function saveFirstNight(state: FirstNightState): Promise<void> {
  await AsyncStorage.setItem(FIRST_NIGHT_KEY, JSON.stringify(state));
}

/** Called when setup finishes, so only brand-new users get the guide. */
export async function beginFirstNight(now: Date = new Date()): Promise<void> {
  await saveFirstNight(startFirstNight(now)).catch(() => undefined);
}
