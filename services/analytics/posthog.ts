/**
 * Product analytics → PostHog, over its plain HTTP batch API (no SDK, no native code).
 * Anonymous by design: events carry a random per-install ID, never the account ID,
 * email, or roster. Off when EXPO_PUBLIC_POSTHOG_KEY isn't set.
 */

import type { AnalyticsEvent } from './types';

const DEFAULT_HOST = 'https://us.i.posthog.com';

export interface PostHogConfig {
  apiKey: string;
  host: string;
}

/**
 * Debug builds (simulator, screenshots, local testing) don't send unless
 * EXPO_PUBLIC_POSTHOG_DEV=1, so real usage data stays clean.
 */
export function posthogConfig(
  env: Record<string, string | undefined> = process.env,
  isDev: boolean = typeof __DEV__ !== 'undefined' && __DEV__,
): PostHogConfig | null {
  const apiKey = env.EXPO_PUBLIC_POSTHOG_KEY?.trim();
  if (!apiKey) return null;
  if (isDev && env.EXPO_PUBLIC_POSTHOG_DEV !== '1') return null;
  const host = (env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_HOST).replace(/\/+$/, '');
  return { apiKey, host };
}

export interface AppContext {
  appVersion: string;
  os: string;
  /** 'production' or 'development' — filter dev noise out of charts. */
  environment?: string;
}

interface PostHogEvent {
  event: string;
  distinct_id: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

/** Keys that could identify a person; never sent even if a caller passes them. */
const NEVER_SEND = new Set(['user_id', 'email', 'userId', 'name', 'playerName', 'teamName']);

function clean(properties: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (NEVER_SEND.has(key) || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

export function toPostHogEvent(event: AnalyticsEvent, distinctId: string, app: AppContext): PostHogEvent {
  const { event: name, timestamp, session_id: sessionId, user_id: _userId, ...rest } = event as AnalyticsEvent & Record<string, unknown>;
  const nested = (rest as { properties?: Record<string, unknown> }).properties;
  const { properties: _nested, ...top } = rest as Record<string, unknown>;
  const base = {
    session_id: sessionId,
    $app_version: app.appVersion,
    $os: app.os,
    $lib: 'puckiq',
    environment: app.environment ?? 'production',
    // Anonymous install IDs shouldn't create PostHog person profiles.
    $process_person_profile: false,
  };

  if (name === 'screen_view') {
    const { screen_name: screen, screen_class: _class, previous_screen: previous, ...extra } = top as Record<string, unknown>;
    return {
      event: '$screen',
      distinct_id: distinctId,
      timestamp: new Date(timestamp).toISOString(),
      properties: { ...base, ...clean(extra), $screen_name: screen ?? 'unknown', previous_screen: previous },
    };
  }

  return {
    event: name,
    distinct_id: distinctId,
    timestamp: new Date(timestamp).toISOString(),
    properties: { ...base, ...clean(top), ...clean(nested) },
  };
}

/** POST a batch; throws on failure so the caller can keep the events queued. */
export async function sendToPostHog(
  config: PostHogConfig,
  events: AnalyticsEvent[],
  distinctId: string,
  app: AppContext,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (events.length === 0) return;
  const response = await fetchImpl(`${config.host}/batch/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: config.apiKey,
      batch: events.map((event) => toPostHogEvent(event, distinctId, app)),
    }),
  });
  if (!response.ok) throw new Error(`PostHog ${response.status}`);
}

/** Random, app-generated install ID (not the IDFA/IDFV) — resets on reinstall. */
export function newInstallId(random: () => number = Math.random): string {
  const hex = () => Math.floor(random() * 0x10000).toString(16).padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${hex()}-${hex()}${hex()}${hex()}`;
}
