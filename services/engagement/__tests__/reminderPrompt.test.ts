import {
  NEW_REMINDER_PROMPT,
  parseReminderPrompt,
  recordDismissal,
  REMINDER_PROMPT_COOLDOWN_DAYS,
  REMINDER_PROMPT_MAX_DISMISSALS,
  shouldOfferReminders,
  type ReminderOfferInput,
} from '../reminderPrompt';

const NOW = new Date('2026-10-10T22:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const offer = (overrides: Partial<ReminderOfferInput> = {}): boolean => shouldOfferReminders({
  state: NEW_REMINDER_PROMPT,
  remindersOn: false,
  permission: 'undetermined',
  gameDay: true,
  guideActive: false,
  now: NOW,
  ...overrides,
});

describe('game-night reminder offer', () => {
  it('shows on a game day when reminders are off', () => {
    expect(offer()).toBe(true);
    expect(offer({ permission: 'granted' })).toBe(true);
  });

  it('stays away when it cannot help or another card already asks', () => {
    expect(offer({ remindersOn: true })).toBe(false);
    expect(offer({ permission: 'denied' })).toBe(false);
    expect(offer({ gameDay: false })).toBe(false);
    expect(offer({ guideActive: true })).toBe(false);
  });

  it('waits a week after "Not now" and gives up after the last one', () => {
    const once = recordDismissal(NEW_REMINDER_PROMPT, NOW);
    expect(once).toEqual({ dismissals: 1, lastDismissedAt: NOW.toISOString() });
    expect(offer({ state: once })).toBe(false);
    expect(offer({ state: { dismissals: 1, lastDismissedAt: daysAgo(REMINDER_PROMPT_COOLDOWN_DAYS - 1) } })).toBe(false);
    expect(offer({ state: { dismissals: 1, lastDismissedAt: daysAgo(REMINDER_PROMPT_COOLDOWN_DAYS) } })).toBe(true);
    expect(offer({ state: { dismissals: REMINDER_PROMPT_MAX_DISMISSALS, lastDismissedAt: daysAgo(60) } })).toBe(false);
  });

  it('reads stored state defensively', () => {
    expect(parseReminderPrompt(null)).toEqual(NEW_REMINDER_PROMPT);
    expect(parseReminderPrompt('{')).toEqual(NEW_REMINDER_PROMPT);
    expect(parseReminderPrompt(JSON.stringify({ dismissals: 1.7, lastDismissedAt: 5 }))).toEqual({ dismissals: 1, lastDismissedAt: null });
    expect(parseReminderPrompt(JSON.stringify({ dismissals: -3 }))).toEqual(NEW_REMINDER_PROMPT);
  });
});
