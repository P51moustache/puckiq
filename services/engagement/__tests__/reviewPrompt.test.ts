import type { NightScore, PlayerNight } from '../../fantasy/nightScore';
import { NO_ACTIVE_DAYS, type ActiveDays } from '../activeDays';
import {
  goodNight,
  NEW_REVIEW_PROMPT,
  parseReviewPrompt,
  recordAnswer,
  recordAsk,
  recordQuietDay,
  REVIEW_ASK_GAP_DAYS,
  REVIEW_DISMISS_COOLDOWN_DAYS,
  REVIEW_MIN_ACTIVE_DAYS,
  REVIEW_PAYWALL_QUIET_MS,
  reviewAskBlock,
  reviewAskCopy,
  reviewMoment,
  shouldAskForReview,
  type ReviewAskInput,
} from '../reviewPrompt';

const NOW = new Date('2026-10-21T13:00:00Z');
const TODAY = '2026-10-21';
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
const regular: ActiveDays = { count: REVIEW_MIN_ACTIVE_DAYS, firstDay: '2026-10-15', day: TODAY, todayMs: 90_000 };

const input = (overrides: Partial<ReviewAskInput> = {}): ReviewAskInput => ({
  state: NEW_REVIEW_PROMPT,
  activity: regular,
  version: '3.3.4',
  today: TODAY,
  moment: 'good_recap',
  available: true,
  sampleTeam: false,
  onboarding: false,
  otherPrompt: false,
  live: false,
  paywallClosedAt: null,
  now: NOW,
  ...overrides,
});
const block = (overrides: Partial<ReviewAskInput> = {}) => reviewAskBlock(input(overrides));

const player = (overrides: Partial<PlayerNight> = {}): PlayerNight => ({
  playerId: 1, gameId: 1, state: 'final', points: 2, role: 'starter', slot: 'C', bigNight: null, ...overrides,
} as PlayerNight);
const score = (overrides: Partial<NightScore> = {}): NightScore => ({
  phase: 'final', totalPoints: 20, starterPoints: 18, benchPoints: 2, live: 0, final: 4, upcoming: 0,
  top: null, players: [player()], hindsight: null, leadGame: null, ...overrides,
} as NightScore);

describe('reviewMoment', () => {
  it('asks after a recap where the lineup came close to the best one', () => {
    expect(reviewMoment(score({ hindsight: { best: 20, captured: 18, share: 0.9 } }))).toBe('good_recap');
    expect(reviewMoment(score({ hindsight: { best: 20, captured: 12, share: 0.6 } }))).toBeNull();
  });

  it('falls back to a big night when there was no lineup to grade', () => {
    expect(goodNight(score({ players: [player({ bigNight: 'hat-trick' })] }))).toBe(true);
    expect(goodNight(score())).toBe(false);
  });

  it('has nothing to ask on without a recap', () => {
    expect(reviewMoment(null)).toBeNull();
  });
});

describe('reviewAskBlock', () => {
  it('asks a regular user after a good night', () => {
    expect(shouldAskForReview(input())).toBe(true);
  });

  it('needs a good-night moment first', () => {
    expect(block({ moment: null })).toBe('no_moment');
  });

  it('stays away without StoreKit, on the sample team and during onboarding', () => {
    expect(block({ available: false })).toBe('unavailable');
    expect(block({ sampleTeam: true })).toBe('sample_team');
    expect(block({ onboarding: true })).toBe('onboarding');
  });

  it(`waits for ${REVIEW_MIN_ACTIVE_DAYS} days of real use`, () => {
    expect(block({ activity: NO_ACTIVE_DAYS })).toBe('few_active_days');
    expect(block({ activity: { ...regular, count: REVIEW_MIN_ACTIVE_DAYS - 1 } })).toBe('few_active_days');
  });

  it('asks at most once per version', () => {
    const asked = recordAnswer(recordAsk(NEW_REVIEW_PROMPT, '3.3.4', new Date(daysAgo(200))), 'yes');
    expect(block({ state: asked })).toBe('asked_this_version');
    expect(block({ state: asked, version: '3.4.0' })).toBeNull();
  });

  it(`leaves ${REVIEW_ASK_GAP_DAYS} days after a yes, even in a new version`, () => {
    const yes = recordAnswer(recordAsk(NEW_REVIEW_PROMPT, '3.3.3', new Date(daysAgo(REVIEW_ASK_GAP_DAYS - 1))), 'yes');
    expect(block({ state: yes })).toBe('cooling_down');
    expect(block({ state: { ...yes, lastAskedAt: daysAgo(REVIEW_ASK_GAP_DAYS + 1) } })).toBeNull();
  });

  it(`rests ${REVIEW_DISMISS_COOLDOWN_DAYS} days after "Not really" or an unanswered sheet`, () => {
    const unanswered = recordAsk(NEW_REVIEW_PROMPT, '3.3.3', new Date(daysAgo(REVIEW_ASK_GAP_DAYS + 1)));
    expect(block({ state: unanswered })).toBe('cooling_down');
    expect(block({ state: recordAnswer(unanswered, 'not_really') })).toBe('cooling_down');
    expect(block({ state: { ...unanswered, lastAskedAt: daysAgo(REVIEW_DISMISS_COOLDOWN_DAYS + 1) } })).toBeNull();
  });

  it('stays out of live games and right after a paywall', () => {
    expect(block({ live: true })).toBe('live_games');
    expect(block({ paywallClosedAt: NOW.getTime() - REVIEW_PAYWALL_QUIET_MS + 1000 })).toBe('after_paywall');
    expect(block({ paywallClosedAt: NOW.getTime() - REVIEW_PAYWALL_QUIET_MS - 1000 })).toBeNull();
  });

  it('gives way to another sheet now and for the rest of the day it showed', () => {
    expect(block({ otherPrompt: true })).toBe('other_prompt');
    expect(block({ state: recordQuietDay(NEW_REVIEW_PROMPT, TODAY) })).toBe('other_prompt');
    expect(block({ state: recordQuietDay(NEW_REVIEW_PROMPT, '2026-10-20') })).toBeNull();
  });
});

describe('recording', () => {
  it('counts a shown sheet as dismissed until it is answered', () => {
    const asked = recordAsk(NEW_REVIEW_PROMPT, '3.3.4', NOW);
    expect(asked).toEqual({ askedVersion: '3.3.4', lastAskedAt: NOW.toISOString(), lastAnswer: 'dismissed', quietDay: null });
    expect(recordAnswer(asked, 'yes').lastAnswer).toBe('yes');
  });

  it('keeps the same state when the quiet day is already marked', () => {
    const quiet = recordQuietDay(NEW_REVIEW_PROMPT, TODAY);
    expect(recordQuietDay(quiet, TODAY)).toBe(quiet);
  });
});

describe('parseReviewPrompt', () => {
  it('reads back what it saved', () => {
    const state = recordQuietDay(recordAnswer(recordAsk(NEW_REVIEW_PROMPT, '3.3.4', NOW), 'not_really'), TODAY);
    expect(parseReviewPrompt(JSON.stringify(state))).toEqual(state);
  });

  it('falls back to a fresh state on missing or broken data', () => {
    expect(parseReviewPrompt(null)).toEqual(NEW_REVIEW_PROMPT);
    expect(parseReviewPrompt('nope')).toEqual(NEW_REVIEW_PROMPT);
    expect(parseReviewPrompt('{"lastAnswer":"maybe","askedVersion":3}')).toEqual(NEW_REVIEW_PROMPT);
  });
});

describe('reviewAskCopy', () => {
  const graded = score({ starterPoints: 31.5, hindsight: { best: 33.5, captured: 31.5, share: 0.94 } });

  it('stamps the hindsight share for Pro, as the recap shows it', () => {
    expect(reviewAskCopy(graded, true)).toEqual({ stamp: '94% OF BEST LINEUP', points: '31.5 PTS', title: 'Good night for your lineup.' });
  });

  it('keeps the Pro-only share off a free user\'s sheet', () => {
    expect(reviewAskCopy(graded, false)).toMatchObject({ stamp: null, points: '20.0 PTS', title: 'Good night for your lineup.' });
    const big = score({ players: [player(), player({ bigNight: 'hat-trick' })] });
    expect(reviewAskCopy(big, false)).toMatchObject({ stamp: 'HAT TRICK', title: 'Big night for your team.' });
  });

  it('just asks when the recap is gone', () => {
    expect(reviewAskCopy(null, true)).toEqual({ stamp: null, points: null, title: 'Enjoying PuckIQ?' });
  });
});
