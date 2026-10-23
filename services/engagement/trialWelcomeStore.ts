/** Where a purchase waits for its "Pro is on" welcome (this device only). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseTrialWelcome, type TrialWelcomeRecord } from './trialWelcome';

export const TRIAL_WELCOME_KEY = 'puckiq_trial_welcome';

export async function markTrialWelcome(renewal: string | null, now: Date = new Date()): Promise<void> {
  const record: TrialWelcomeRecord = { startedAt: now.toISOString(), renewal };
  await AsyncStorage.setItem(TRIAL_WELCOME_KEY, JSON.stringify(record)).catch(() => undefined);
}

export async function loadTrialWelcome(): Promise<TrialWelcomeRecord | null> {
  try {
    return parseTrialWelcome(await AsyncStorage.getItem(TRIAL_WELCOME_KEY));
  } catch {
    return null;
  }
}

export async function clearTrialWelcome(): Promise<void> {
  await AsyncStorage.removeItem(TRIAL_WELCOME_KEY).catch(() => undefined);
}
