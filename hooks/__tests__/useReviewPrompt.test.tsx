let mockAppStateListener: ((state: string) => void) | null = null;
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppStateListener = listener;
      return { remove: () => { mockAppStateListener = null; } };
    },
  },
}));
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
let mockClosedAt: number | null = null;
jest.mock('../../components/PaywallProvider', () => ({ usePaywall: () => ({ openPaywall: jest.fn(), closedAt: mockClosedAt }) }));
let mockActivity = { count: 3, firstDay: '2026-10-15', day: '2026-10-20', todayMs: 90_000 };
jest.mock('../../services/engagement/activeDaysStore', () => ({ loadActiveDays: () => Promise.resolve(mockActivity) }));
let mockAvailable = true;
const mockRequestReview = jest.fn(() => Promise.resolve(true));
jest.mock('../../services/native/storeReview', () => ({
  storeReviewAvailable: () => Promise.resolve(mockAvailable),
  requestStoreReview: () => mockRequestReview(),
}));
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => Promise.resolve(mockStore.get(key) ?? null),
  setItem: (key: string, value: string) => { mockStore.set(key, value); return Promise.resolve(); },
  removeItem: (key: string) => { mockStore.delete(key); return Promise.resolve(); },
}));
const mockTrack = jest.fn();
jest.mock('../../services/analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import React from 'react';
import { NEW_REVIEW_PROMPT, recordAsk, REVIEW_PAYWALL_QUIET_MS } from '../../services/engagement/reviewPrompt';
import { REVIEW_PROMPT_KEY, REVIEW_SHEET_DELAY_MS, useReviewPrompt, type ReviewPrompt, type ReviewPromptArgs } from '../useReviewPrompt';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date('2026-10-21T13:00:00Z');
const VERSION = '3.0.0'; // jest.setup's expo-constants mock
const ready: ReviewPromptArgs = { moment: 'good_recap', sampleTeam: false, onboarding: false, otherPrompt: false, otherPromptShown: false, live: false };

let latest: ReviewPrompt | null = null;
function Probe(props: ReviewPromptArgs) {
  latest = useReviewPrompt(props);
  return null;
}

async function mount(props: Partial<ReviewPromptArgs> = {}) {
  let tree: any;
  await act(async () => {
    tree = create(<Probe {...ready} {...props} />);
  });
  return tree;
}

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });
const events = (name: string) => mockTrack.mock.calls.filter((call) => call[0] === name).map((call) => call[1]);
const saved = () => JSON.parse(mockStore.get(REVIEW_PROMPT_KEY) ?? 'null');

describe('useReviewPrompt', () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: NOW });
    jest.clearAllMocks();
    mockFocused = true;
    mockClosedAt = null;
    mockAvailable = true;
    mockActivity = { count: 3, firstDay: '2026-10-15', day: '2026-10-20', todayMs: 90_000 };
    mockStore.clear();
  });
  afterEach(() => jest.useRealTimers());

  it('asks a moment after a good recap is on screen, and saves the ask right away', async () => {
    const tree = await mount();
    advance(REVIEW_SHEET_DELAY_MS - 1);
    expect(latest!.visible).toBe(false);
    advance(1);
    expect(latest!.visible).toBe(true);
    expect(latest!.moment).toBe('good_recap');
    expect(events('review_prompt_view')).toEqual([{ moment: 'good_recap' }]);
    await act(async () => undefined);
    expect(saved()).toMatchObject({ askedVersion: VERSION, lastAnswer: 'dismissed' });
    // The saved ask now blocks this version, but the open sheet stays until answered.
    expect(latest!.visible).toBe(true);
    act(() => tree.unmount());
  });

  it('hands "Yes" to StoreKit and records the answer', async () => {
    const tree = await mount();
    advance(REVIEW_SHEET_DELAY_MS);
    await act(async () => { await latest!.enjoy(); });
    expect(mockRequestReview).toHaveBeenCalled();
    expect(events('review_prompt_answer')).toEqual([{ answer: 'yes', moment: 'good_recap' }]);
    expect(latest!.visible).toBe(false);
    expect(saved()).toMatchObject({ lastAnswer: 'yes' });
    act(() => tree.unmount());
  });

  it('opens feedback on "Not really" instead of the store', async () => {
    const tree = await mount();
    advance(REVIEW_SHEET_DELAY_MS);
    act(() => latest!.notReally());
    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(latest!.feedbackOpen).toBe(true);
    expect(events('feedback_opened')).toEqual([{ source: 'review_prompt' }]);
    expect(events('review_prompt_answer')).toEqual([{ answer: 'not_really', moment: 'good_recap' }]);
    act(() => latest!.closeFeedback());
    expect(latest!.feedbackOpen).toBe(false);
    act(() => tree.unmount());
  });

  it('never asks twice in one version', async () => {
    mockStore.set(REVIEW_PROMPT_KEY, JSON.stringify(recordAsk(NEW_REVIEW_PROMPT, VERSION, new Date('2026-01-01'))));
    const tree = await mount();
    advance(REVIEW_SHEET_DELAY_MS * 2);
    expect(latest!.visible).toBe(false);
    act(() => tree.unmount());
    expect(events('review_prompt_skipped')).toEqual([{ reason: 'asked_this_version', moment: 'good_recap' }]);
  });

  it('logs the rule that kept it away only when there was a good night to ask on', async () => {
    mockActivity = { ...mockActivity, count: 1 };
    let tree = await mount();
    advance(REVIEW_SHEET_DELAY_MS);
    act(() => tree.unmount());
    tree = await mount({ moment: null });
    act(() => tree.unmount());
    expect(events('review_prompt_skipped')).toEqual([{ reason: 'few_active_days', moment: 'good_recap' }]);
  });

  it('keeps clear of a paywall that just closed and of live games', async () => {
    mockClosedAt = NOW.getTime() - REVIEW_PAYWALL_QUIET_MS / 2;
    let tree = await mount();
    advance(REVIEW_SHEET_DELAY_MS);
    expect(latest!.visible).toBe(false);
    act(() => tree.unmount());
    mockClosedAt = null;
    tree = await mount({ live: true });
    advance(REVIEW_SHEET_DELAY_MS);
    expect(latest!.visible).toBe(false);
    act(() => tree.unmount());
    expect(events('review_prompt_skipped').map((skip) => skip.reason)).toEqual(['after_paywall', 'live_games']);
  });

  it('stays away for the rest of a day the reminder sheet showed', async () => {
    const tree = await mount({ otherPrompt: true, otherPromptShown: true });
    await act(async () => undefined);
    expect(saved()).toMatchObject({ quietDay: '2026-10-21' });
    act(() => tree.update(<Probe {...ready} />));
    advance(REVIEW_SHEET_DELAY_MS * 2);
    expect(latest!.visible).toBe(false);
    act(() => tree.unmount());
  });

  it('stays away when StoreKit has no review request to hand over to', async () => {
    mockAvailable = false;
    const tree = await mount();
    advance(REVIEW_SHEET_DELAY_MS);
    expect(latest!.visible).toBe(false);
    act(() => mockAppStateListener!('background'));
    expect(events('review_prompt_skipped')).toEqual([{ reason: 'unavailable', moment: 'good_recap' }]);
    act(() => tree.unmount());
  });
});
