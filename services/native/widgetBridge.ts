/**
 * Bridge to the iOS widget extension and Live Activity. The Native stream implements the
 * native module (`PuckIQNative`); until it exists — and on Android, web, or Expo Go —
 * every call is a safe no-op. Keep this API stable: screens import it.
 */

import { NativeModules, Platform } from 'react-native';

export interface WidgetPlayer {
  name: string;
  team: string;
  opponent: string;
  home: boolean;
  /** ISO puck drop, or null when unknown. */
  startUTC: string | null;
}

export interface WidgetLive {
  points: number;
  live: number;
  final: number;
  upcoming: number;
  top: { name: string; line: string } | null;
}

/** What the widgets show. Written to the shared App Group as JSON. */
export interface WidgetSnapshot {
  updatedAt: string;
  /** NHL game day, YYYY-MM-DD. */
  date: string;
  teamName: string;
  playing: number;
  total: number;
  firstPuckUTC: string | null;
  /** Up to 8, earliest puck drop first. */
  players: WidgetPlayer[];
  live: WidgetLive | null;
}

export interface LiveActivityState {
  points: number;
  live: number;
  final: number;
  upcoming: number;
  topName: string | null;
  topLine: string | null;
  /** "P2 10:15", "INT 1", "Final" — the most advanced game clock among my games. */
  clock: string | null;
}

interface PuckIQNativeModule {
  setWidgetSnapshot(json: string): Promise<void>;
  liveActivitiesEnabled(): boolean;
  startOrUpdateLiveActivity(attributesJson: string, stateJson: string): Promise<boolean>;
  endLiveActivity(stateJson: string | null): Promise<void>;
}

function nativeModule(): PuckIQNativeModule | null {
  if (Platform.OS !== 'ios') return null;
  // Optional chaining: partial react-native mocks in jest leave NativeModules undefined.
  return (NativeModules?.PuckIQNative as PuckIQNativeModule | undefined) ?? null;
}

export async function publishWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  const native = nativeModule();
  if (!native) return;
  try {
    await native.setWidgetSnapshot(JSON.stringify(snapshot));
  } catch (error) {
    console.warn('[widget] publish failed', error);
  }
}

export function liveActivitiesSupported(): boolean {
  const native = nativeModule();
  if (!native) return false;
  try {
    return native.liveActivitiesEnabled();
  } catch {
    return false;
  }
}

export async function startOrUpdateLiveActivity(attrs: { teamName: string; date: string }, state: LiveActivityState): Promise<boolean> {
  const native = nativeModule();
  if (!native) return false;
  try {
    return await native.startOrUpdateLiveActivity(JSON.stringify(attrs), JSON.stringify(state));
  } catch (error) {
    console.warn('[live-activity] update failed', error);
    return false;
  }
}

export async function endLiveActivity(state?: LiveActivityState): Promise<void> {
  const native = nativeModule();
  if (!native) return;
  try {
    await native.endLiveActivity(state ? JSON.stringify(state) : null);
  } catch (error) {
    console.warn('[live-activity] end failed', error);
  }
}
