/**
 * Tonight's "Enjoying PuckIQ?" ask: whether to show it, and what its answers do. The rules live in
 * services/engagement/reviewPrompt; this hook loads what they need, waits a moment after the
 * recap is on screen, and saves each ask. "Yes" hands over to Apple's review request; "Not really"
 * opens the feedback sheet. When a visit with a good recap ends without the sheet,
 * `review_prompt_skipped` says which rule kept it away.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { usePaywall } from '../components/PaywallProvider';
import type { ActiveDays } from '../services/engagement/activeDays';
import { loadActiveDays } from '../services/engagement/activeDaysStore';
import {
  parseReviewPrompt,
  recordAnswer,
  recordAsk,
  recordQuietDay,
  reviewAskBlock,
  type ReviewAnswer,
  type ReviewMoment,
  type ReviewPromptState,
} from '../services/engagement/reviewPrompt';
import { requestStoreReview, storeReviewAvailable } from '../services/native/storeReview';
import { todayNhl } from '../services/nhl/dates';
import { track } from '../services/analytics/track';
import { useOnScreen, useSettled, useSkipLog } from './usePromptVisit';

export const REVIEW_PROMPT_KEY = 'puckiq_review_prompt';
/** Lets the recap's headline land before the ask; a little longer than the reminder sheet's wait. */
export const REVIEW_SHEET_DELAY_MS = 1500;
const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';

export interface ReviewPromptArgs {
  moment: ReviewMoment | null;
  sampleTeam: boolean;
  onboarding: boolean;
  /** The reminder offer could show now. */
  otherPrompt: boolean;
  /** The reminder sheet is on screen (marks today as taken). */
  otherPromptShown: boolean;
  live: boolean;
}

export interface ReviewPrompt {
  visible: boolean;
  moment: ReviewMoment | null;
  /** "Yes": asks StoreKit for its review dialog, which Apple may or may not show. */
  enjoy: () => Promise<void>;
  /** "Not really": opens the feedback sheet. */
  notReally: () => void;
  /** Closed without an answer. */
  dismiss: () => void;
  feedbackOpen: boolean;
  closeFeedback: () => void;
}

export function useReviewPrompt({ moment, sampleTeam, onboarding, otherPrompt, otherPromptShown, live }: ReviewPromptArgs): ReviewPrompt {
  const { closedAt } = usePaywall();
  const loaded = useLoaded();
  const [state, setState] = useState<ReviewPromptState | null>(null);
  // The moment the sheet opened on; it stays up until answered, even once the rules say no.
  const [asking, setAsking] = useState<ReviewMoment | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const onScreen = useOnScreen();
  const current = state ?? loaded?.state ?? null;
  const save = useCallback((next: ReviewPromptState) => {
    setState(next);
    AsyncStorage.setItem(REVIEW_PROMPT_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const now = new Date();
  const today = todayNhl(now);
  const block = current && loaded ? reviewAskBlock({
    state: current,
    activity: loaded.activity,
    version: APP_VERSION,
    today,
    moment,
    available: loaded.available,
    sampleTeam,
    onboarding,
    otherPrompt,
    live,
    paywallClosedAt: closedAt ?? null,
    now,
  }) : null;
  const eligible = !!current && !!loaded && block === null;
  const settled = useSettled(eligible, onScreen, REVIEW_SHEET_DELAY_MS);
  const visible = asking !== null || (eligible && onScreen && settled);

  // Saved the moment it shows, so a closed app still counts as this version's ask.
  useEffect(() => {
    if (!visible || asking || !current || !moment) return;
    setAsking(moment);
    save(recordAsk(current, APP_VERSION, new Date()));
    track('review_prompt_view', { moment });
  }, [visible, asking, current, save, moment]);

  // A day the reminder sheet asked something is not a day for this one too.
  useEffect(() => {
    if (!otherPromptShown || !current) return;
    const next = recordQuietDay(current, todayNhl(new Date()));
    if (next !== current) save(next);
  }, [otherPromptShown, current, save]);

  const skip = block === 'no_moment' ? null : block ?? (eligible && !settled ? 'left_early' : null);
  useSkipLog({ event: 'review_prompt_skipped', onScreen, ready: !!current && !!loaded, skip, moment, visible });

  const answer = useCallback((value: ReviewAnswer) => {
    setAsking(null);
    track('review_prompt_answer', { answer: value, moment: asking });
    if (current) save(recordAnswer(current, value));
  }, [current, save, asking]);

  const enjoy = useCallback(async () => {
    answer('yes');
    await requestStoreReview();
  }, [answer]);

  const notReally = useCallback(() => {
    answer('not_really');
    track('feedback_opened', { source: 'review_prompt' });
    setFeedbackOpen(true);
  }, [answer]);

  const dismiss = useCallback(() => answer('dismissed'), [answer]);
  const closeFeedback = useCallback(() => setFeedbackOpen(false), []);

  return { visible, moment: asking ?? (visible ? moment : null), enjoy, notReally, dismiss, feedbackOpen, closeFeedback };
}

interface Loaded {
  state: ReviewPromptState;
  activity: ActiveDays;
  available: boolean;
}

/** The saved ask, the days-of-use count and StoreKit's availability, read once per mount. */
function useLoaded(): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem(REVIEW_PROMPT_KEY).catch(() => null),
      loadActiveDays(),
      storeReviewAvailable(),
    ]).then(([raw, activity, available]) => {
      if (!cancelled) setLoaded({ state: parseReviewPrompt(raw), activity, available });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return loaded;
}
