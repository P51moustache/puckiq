/**
 * The guided first night: right after setup, Tonight shows three steps (see who plays, one
 * pickup idea, a game-night reminder) instead of leaving new users to wander every tab — the
 * users who wandered without doing anything never came back. Pure; storage lives in
 * firstNightStore.ts.
 */

export type FirstNightStep = 'players' | 'pickup' | 'reminder';

export const FIRST_NIGHT_STEPS: readonly FirstNightStep[] = ['players', 'pickup', 'reminder'];

/** A week after setup the guide has done its job, or won't: stop showing it either way. */
export const FIRST_NIGHT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface FirstNightState {
  /** ISO time setup finished. */
  startedAt: string;
  done: FirstNightStep[];
  dismissed: boolean;
}

export function startFirstNight(now: Date): FirstNightState {
  return { startedAt: now.toISOString(), done: [], dismissed: false };
}

/** Marks a step done (idempotent), keeping steps in guide order. */
export function completeStep(state: FirstNightState, step: FirstNightStep): FirstNightState {
  if (state.done.includes(step)) return state;
  return { ...state, done: FIRST_NIGHT_STEPS.filter((each) => each === step || state.done.includes(each)) };
}

export function dismissFirstNight(state: FirstNightState): FirstNightState {
  return state.dismissed ? state : { ...state, dismissed: true };
}

export function isFirstNightFinished(state: FirstNightState): boolean {
  return FIRST_NIGHT_STEPS.every((step) => state.done.includes(step));
}

export function isFirstNightActive(state: FirstNightState | null, now: Date): boolean {
  if (!state || state.dismissed || isFirstNightFinished(state)) return false;
  const started = Date.parse(state.startedAt);
  return Number.isFinite(started) && now.getTime() - started < FIRST_NIGHT_DAYS * DAY_MS;
}

/** Reads stored state; anything malformed counts as "never started". */
export function parseFirstNight(raw: string | null): FirstNightState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<FirstNightState>;
    if (typeof value.startedAt !== 'string' || !Number.isFinite(Date.parse(value.startedAt))) return null;
    const done = Array.isArray(value.done) ? FIRST_NIGHT_STEPS.filter((step) => value.done!.includes(step)) : [];
    return { startedAt: value.startedAt, done, dismissed: value.dismissed === true };
  } catch {
    return null;
  }
}
