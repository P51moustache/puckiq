/**
 * Request validation for the register-alerts Edge Function (pure, no imports, tested with jest).
 *
 * POST   { token, playerIds, prefs: { scratches, goals }, appVersion?, platform? } -> upsert
 * DELETE { token }                                                                   -> remove
 * Errors are short codes the app can log: invalid_body, invalid_token, invalid_player_ids,
 * invalid_prefs, invalid_app_version, invalid_platform.
 */

/** Matches the alert_devices.player_ids check constraint. */
export const MAX_PLAYER_IDS = 150;
/** 150 ids plus a token is well under 4 KB; anything bigger is not from the app. */
export const MAX_BODY_BYTES = 8 * 1024;
const MAX_TOKEN_LENGTH = 200;
const MAX_APP_VERSION_LENGTH = 32;
const PLATFORMS = ['ios', 'android'] as const;

export type AlertPlatform = (typeof PLATFORMS)[number];

export interface AlertRegistration {
  token: string;
  playerIds: number[];
  prefs: { scratches: boolean; goals: boolean };
  appVersion: string | null;
  platform: AlertPlatform;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Expo push tokens: ExponentPushToken[...] or ExpoPushToken[...], no whitespace or nested brackets. */
export function isExpoPushToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_TOKEN_LENGTH &&
    /^(ExponentPushToken|ExpoPushToken)\[[^\[\]\s]+\]$/.test(value)
  );
}

function parsePlayerIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length > MAX_PLAYER_IDS) return null;
  const ids = new Set<number>();
  for (const id of value) {
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0 || id > 2_147_483_647) return null;
    ids.add(id);
  }
  return Array.from(ids);
}

export function parseRegistration(body: unknown): Parsed<AlertRegistration> {
  const input = asRecord(body);
  if (!input) return fail('invalid_body');
  if (!isExpoPushToken(input.token)) return fail('invalid_token');

  const playerIds = parsePlayerIds(input.playerIds);
  if (!playerIds) return fail('invalid_player_ids');

  const prefs = asRecord(input.prefs);
  if (!prefs || typeof prefs.scratches !== 'boolean' || typeof prefs.goals !== 'boolean') {
    return fail('invalid_prefs');
  }

  const appVersion = input.appVersion ?? null;
  if (appVersion !== null && (typeof appVersion !== 'string' || appVersion.length > MAX_APP_VERSION_LENGTH)) {
    return fail('invalid_app_version');
  }

  // The app ships on iOS; platform is optional so the documented request shape stays valid.
  const platform = input.platform ?? 'ios';
  if (!PLATFORMS.includes(platform as AlertPlatform)) return fail('invalid_platform');

  return {
    ok: true,
    value: {
      token: input.token,
      playerIds,
      prefs: { scratches: prefs.scratches, goals: prefs.goals },
      appVersion: appVersion === null ? null : appVersion.trim() || null,
      platform: platform as AlertPlatform,
    },
  };
}

export function parseUnregistration(body: unknown): Parsed<{ token: string }> {
  const input = asRecord(body);
  if (!input) return fail('invalid_body');
  if (!isExpoPushToken(input.token)) return fail('invalid_token');
  return { ok: true, value: { token: input.token } };
}

/** The alert_devices row (snake_case) for an upsert on expo_push_token. */
export function registrationToRow(registration: AlertRegistration, nowIso: string) {
  return {
    expo_push_token: registration.token,
    player_ids: registration.playerIds,
    prefs: registration.prefs,
    platform: registration.platform,
    app_version: registration.appVersion,
    updated_at: nowIso,
  };
}
