/**
 * When PuckIQ asks "Enjoying PuckIQ?", and what each answer does to the next ask. Asked only
 * after a good night shows in the morning recap, once someone has used the app on a few days,
 * and never alongside onboarding, another sheet, live games or a paywall. At most once per app
 * version, with a long rest after "Not really" or closing it. "Yes" hands over to Apple's own
 * review request, which Apple may or may not show; "Not really" opens feedback instead.
 */

import { BIG_NIGHT_LABEL, headlinePoints, type NightScore } from '../fantasy/nightScore';
import { formatValue } from '../fantasy/scoring';
import type { ActiveDays } from './activeDays';

/** Days of real use (see activeDays) before the first ask. */
export const REVIEW_MIN_ACTIVE_DAYS = 3;
/** Shortest gap between two asks, even across versions, after a "Yes". */
export const REVIEW_ASK_GAP_DAYS = 60;
/** Rest after "Not really" or closing the sheet without an answer. */
export const REVIEW_DISMISS_COOLDOWN_DAYS = 120;
/** How long after a paywall closes before the ask may follow. */
export const REVIEW_PAYWALL_QUIET_MS = 30 * 60 * 1000;
/**
 * A night counts as good when PuckIQ's lineup got this share of the best lineup possible in
 * hindsight (the recap's "92% of the best lineup" line).
 */
export const GOOD_NIGHT_SHARE = 0.85;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What the ask follows. One today; a new moment is a new member here. */
export type ReviewMoment = 'good_recap';

export type ReviewAnswer = 'yes' | 'not_really' | 'dismissed';

/** Why the ask stayed away, as logged by `review_prompt_skipped`. */
export type ReviewSkipReason =
  | 'unavailable'
  | 'sample_team'
  | 'onboarding'
  | 'few_active_days'
  | 'asked_this_version'
  | 'cooling_down'
  | 'live_games'
  | 'after_paywall'
  | 'other_prompt';

/** Every block except the missing moment, which isn't worth logging. */
export type ReviewBlock = ReviewSkipReason | 'no_moment';

export interface ReviewPromptState {
  /** App version of the last ask. */
  askedVersion: string | null;
  /** ISO time of the last ask. */
  lastAskedAt: string | null;
  /** How the last ask ended; an ask nobody answered counts as dismissed. */
  lastAnswer: ReviewAnswer | null;
  /** A day (YYYY-MM-DD) another sheet already asked something, so this one waits. */
  quietDay: string | null;
}

export const NEW_REVIEW_PROMPT: ReviewPromptState = { askedVersion: null, lastAskedAt: null, lastAnswer: null, quietDay: null };

export interface ReviewAskInput {
  state: ReviewPromptState;
  activity: ActiveDays;
  /** Running app version. */
  version: string;
  /** Today (YYYY-MM-DD, the same calendar activeDays uses). */
  today: string;
  moment: ReviewMoment | null;
  /** StoreKit's review request is there to hand over to. */
  available: boolean;
  /** The roster is the sample team, so the recap isn't theirs. */
  sampleTeam: boolean;
  /** The first-night guide is still showing. */
  onboarding: boolean;
  /** Another sheet (the reminder offer) could show now. */
  otherPrompt: boolean;
  live: boolean;
  /** Epoch ms the paywall last closed, or null. */
  paywallClosedAt: number | null;
  now: Date;
}

/** The moment to ask on, or null: last night's recap on screen, and the night went well. */
export function reviewMoment(recap: NightScore | null): ReviewMoment | null {
  return recap && goodNight(recap) ? 'good_recap' : null;
}

/** PuckIQ's lineup came close to the best one, or (with no lineup to grade) someone had a big night. */
export function goodNight(score: NightScore): boolean {
  if (score.hindsight) return score.hindsight.share >= GOOD_NIGHT_SHARE;
  return score.players.some((player) => player.bigNight !== null);
}

export interface ReviewAskCopy {
  /** The recap's stamp: "94% OF BEST LINEUP" (Pro, where the recap shows it) or a big night. */
  stamp: string | null;
  /** "31.5 PTS", the recap's own headline number. */
  points: string | null;
  title: string;
}

/**
 * The sheet's words, from the night it follows. Free users only see the hindsight share as a Pro
 * line in the recap, so their stamp is a big night (or nothing) instead.
 */
export function reviewAskCopy(score: NightScore | null, isPro: boolean): ReviewAskCopy {
  if (!score) return { stamp: null, points: null, title: 'Enjoying PuckIQ?' };
  const big = score.players.find((player) => player.bigNight)?.bigNight ?? null;
  const graded = score.hindsight && score.hindsight.share >= GOOD_NIGHT_SHARE;
  const stamp = isPro && score.hindsight
    ? `${Math.round(score.hindsight.share * 100)}% OF BEST LINEUP`
    : big ? BIG_NIGHT_LABEL[big] : null;
  return {
    stamp,
    points: `${formatValue(headlinePoints(score, isPro))} PTS`,
    title: graded ? 'Good night for your lineup.' : 'Big night for your team.',
  };
}

/** The first rule that keeps the ask away, or null when it may show. */
export function reviewAskBlock(input: ReviewAskInput): ReviewBlock | null {
  if (!input.moment) return 'no_moment';
  if (!input.available) return 'unavailable';
  if (input.sampleTeam) return 'sample_team';
  if (input.onboarding) return 'onboarding';
  if (input.activity.count < REVIEW_MIN_ACTIVE_DAYS) return 'few_active_days';
  if (input.state.askedVersion === input.version) return 'asked_this_version';
  if (coolingDown(input.state, input.now)) return 'cooling_down';
  if (input.live) return 'live_games';
  if (input.paywallClosedAt !== null && input.now.getTime() - input.paywallClosedAt < REVIEW_PAYWALL_QUIET_MS) return 'after_paywall';
  if (input.otherPrompt || input.state.quietDay === input.today) return 'other_prompt';
  return null;
}

export function shouldAskForReview(input: ReviewAskInput): boolean {
  return reviewAskBlock(input) === null;
}

function coolingDown(state: ReviewPromptState, now: Date): boolean {
  if (!state.lastAskedAt) return false;
  const last = Date.parse(state.lastAskedAt);
  if (!Number.isFinite(last)) return false;
  const rest = state.lastAnswer === 'yes' ? REVIEW_ASK_GAP_DAYS : REVIEW_DISMISS_COOLDOWN_DAYS;
  return now.getTime() - last < rest * DAY_MS;
}

/** The sheet is on screen: this version has had its ask, and until answered it counts as dismissed. */
export function recordAsk(state: ReviewPromptState, version: string, now: Date): ReviewPromptState {
  return { ...state, askedVersion: version, lastAskedAt: now.toISOString(), lastAnswer: 'dismissed' };
}

export function recordAnswer(state: ReviewPromptState, answer: ReviewAnswer): ReviewPromptState {
  return { ...state, lastAnswer: answer };
}

/** Another sheet asked something today. */
export function recordQuietDay(state: ReviewPromptState, today: string): ReviewPromptState {
  return state.quietDay === today ? state : { ...state, quietDay: today };
}

const ANSWERS: readonly ReviewAnswer[] = ['yes', 'not_really', 'dismissed'];

export function parseReviewPrompt(raw: string | null): ReviewPromptState {
  if (!raw) return NEW_REVIEW_PROMPT;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof ReviewPromptState, unknown>>;
    const text = (field: unknown) => (typeof field === 'string' ? field : null);
    return {
      askedVersion: text(value.askedVersion),
      lastAskedAt: text(value.lastAskedAt),
      lastAnswer: ANSWERS.includes(value.lastAnswer as ReviewAnswer) ? value.lastAnswer as ReviewAnswer : null,
      quietDay: text(value.quietDay),
    };
  } catch {
    return NEW_REVIEW_PROMPT;
  }
}
