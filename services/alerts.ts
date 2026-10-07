/**
 * Player alerts: a push when one of MY players is scratched (NHL game report) or scores.
 * The server (`live-poller`) watches the games; the app only registers this device's Expo
 * push token and the NHL player ids it follows, through the `register-alerts` function.
 * No account needed — the token is the device's identity.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { FantasyTeam } from '../types/fantasy';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isNhlLinked } from './fantasy/positions';

export const ALERT_SETTINGS_KEY = 'puckiq_player_alerts';
/** Matches the server's cap: 5 teams × 30 players. */
export const MAX_ALERT_PLAYERS = 150;

export interface AlertSettings {
  enabled: boolean;
  scratches: boolean;
  goals: boolean;
}

export const DEFAULT_ALERTS: AlertSettings = { enabled: false, scratches: true, goals: true };

export function parseAlertSettings(raw: string | null): AlertSettings {
  if (!raw) return DEFAULT_ALERTS;
  try {
    const value = JSON.parse(raw) as Partial<AlertSettings>;
    return {
      enabled: value.enabled === true,
      scratches: value.scratches !== false,
      goals: value.goals !== false,
    };
  } catch {
    return DEFAULT_ALERTS;
  }
}

export async function loadAlertSettings(): Promise<AlertSettings> {
  try {
    return parseAlertSettings(await AsyncStorage.getItem(ALERT_SETTINGS_KEY));
  } catch {
    return DEFAULT_ALERTS;
  }
}

export async function saveAlertSettings(settings: AlertSettings): Promise<void> {
  await AsyncStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(settings));
}

/** Every NHL player on any of my teams (IR included — they can return mid-week), deduped, capped. */
export function alertPlayerIds(teams: FantasyTeam[]): number[] {
  const ids = new Set<number>();
  for (const team of teams) {
    for (const player of team.players) {
      if (isNhlLinked(player)) ids.add(player.playerId);
    }
  }
  return [...ids].sort((a, b) => a - b).slice(0, MAX_ALERT_PLAYERS);
}

/** What the server would store; equal signatures mean no need to re-register. */
export function alertSignature(token: string, playerIds: number[], settings: AlertSettings): string {
  return `${token}|${settings.scratches ? 1 : 0}${settings.goals ? 1 : 0}|${playerIds.join(',')}`;
}

/** This device's Expo push token, or null (simulator, no permission, no project id). */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return null;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data || null;
  } catch {
    return null;
  }
}

export async function registerAlerts(token: string, playerIds: number[], settings: AlertSettings, appVersion: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { error } = await supabase.functions.invoke('register-alerts', {
    method: 'POST',
    body: { token, playerIds, prefs: { scratches: settings.scratches, goals: settings.goals }, appVersion },
  });
  if (error) {
    console.warn('[ALERTS] register failed', error.message);
    return false;
  }
  return true;
}

export async function unregisterAlerts(token: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.functions.invoke('register-alerts', { method: 'DELETE', body: { token } });
  if (error) console.warn('[ALERTS] unregister failed', error.message);
}
