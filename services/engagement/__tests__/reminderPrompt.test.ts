import {
  NEW_REMINDER_PROMPT,
  parseReminderPrompt,
  recordDismissal,
  reminderLeadLabel,
  reminderMoment,
  reminderOfferBlock,
  reminderOfferCopy,
  reminderOfferLine,
  REMINDER_PROMPT_COOLDOWN_DAYS,
  REMINDER_PROMPT_MAX_DISMISSALS,
  shouldOfferReminders,
  type ReminderOfferInput,
} from '../reminderPrompt';

const NOW = new Date('2026-10-10T22:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const input = (overrides: Partial<ReminderOfferInput> = {}): ReminderOfferInput => ({
  state: NEW_REMINDER_PROMPT,
  remindersOn: false,
  permission: 'undetermined',
  moment: 'before_lock',
  callShown: true,
  otherPrompt: false,
  now: NOW,
  ...overrides,
});
const offer = (overrides: Partial<ReminderOfferInput> = {}): boolean => shouldOfferReminders(input(overrides));
const block = (overrides: Partial<ReminderOfferInput> = {}) => reminderOfferBlock(input(overrides));

describe('game-night reminder offer', () => {
  it('shows at every moment when reminders are off', () => {
    expect(offer()).toBe(true);
    expect(offer({ permission: 'granted' })).toBe(true);
    expect(offer({ moment: 'after_lock' })).toBe(true);
    expect(offer({ moment: 'recap' })).toBe(true);
  });

  it('stays away when it cannot help or before the call has shown, and says why', () => {
    expect(block()).toBeNull();
    expect(block({ remindersOn: true })).toBe('reminders_on');
    expect(block({ permission: 'denied' })).toBe('permission_denied');
    expect(block({ moment: null })).toBe('no_game');
    expect(block({ callShown: false })).toBe('call_loading');
    expect(block({ state: { dismissals: REMINDER_PROMPT_MAX_DISMISSALS, lastDismissedAt: daysAgo(60) } })).toBe('asked_twice');
    expect(block({ state: recordDismissal(NEW_REMINDER_PROMPT, NOW) })).toBe('cooling_down');
  });

  it('reports the rule that matters most when several apply', () => {
    expect(block({ remindersOn: true, moment: null, callShown: false })).toBe('reminders_on');
    expect(block({ permission: 'denied', moment: null })).toBe('permission_denied');
    expect(block({ moment: null, callShown: false })).toBe('no_game');
  });

  it('holds off while another ask has the screen', () => {
    expect(block({ otherPrompt: true })).toBe('other_prompt');
    expect(block({ otherPrompt: true, moment: null })).toBe('other_prompt');
    expect(block({ otherPrompt: true, remindersOn: true })).toBe('reminders_on');
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

describe('reminderLeadLabel', () => {
  it('reads naturally for each reminder option', () => {
    expect(reminderLeadLabel(60)).toBe('an hour');
    expect(reminderLeadLabel(30)).toBe('30 minutes');
    expect(reminderLeadLabel(90)).toBe('90 minutes');
  });
});

describe('reminderOfferLine', () => {
  const puck = '2026-10-15T23:00:00Z';
  const at = (iso: string) => Date.parse(iso);

  it('offers tonight’s ping while there is still time for it', () => {
    expect(reminderOfferLine(60, puck, at('2026-10-15T21:30:00Z'))).toBe('Want a ping an hour before puck drop, with tonight’s call?');
    expect(reminderOfferLine(60, null, at('2026-10-15T22:30:00Z'))).toBe('Want a ping an hour before puck drop, with tonight’s call?');
  });

  it('offers the next game night once puck drop is closer than the lead', () => {
    expect(reminderOfferLine(60, puck, at('2026-10-15T22:30:00Z'))).toBe('Want a ping an hour before puck drop on your next game night?');
    expect(reminderOfferLine(30, puck, at('2026-10-15T22:30:00Z'))).toBe('Want a ping 30 minutes before puck drop on your next game night?');
  });
});

describe('reminderMoment', () => {
  it('names tonight’s moment, preferring the lock time while it is still ahead', () => {
    expect(reminderMoment({ recapShown: false, playingTonight: true, beforePuck: true })).toBe('before_lock');
    expect(reminderMoment({ recapShown: true, playingTonight: true, beforePuck: true })).toBe('before_lock');
    expect(reminderMoment({ recapShown: false, playingTonight: true, beforePuck: false })).toBe('after_lock');
    expect(reminderMoment({ recapShown: true, playingTonight: false, beforePuck: true })).toBe('recap');
    expect(reminderMoment({ recapShown: false, playingTonight: false, beforePuck: true })).toBeNull();
  });
});

describe('reminderOfferCopy', () => {
  const puck = '2026-10-15T23:00:00Z';
  const early = Date.parse('2026-10-15T21:00:00Z');

  it('names tonight’s lock before it, and the next game night after it', () => {
    const lock = new Date(Date.parse(puck)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    expect(reminderOfferCopy('before_lock', 60, puck, early)).toEqual({
      title: `Lineup locks at ${lock}`,
      body: 'Want a ping an hour before puck drop, with tonight’s call?',
    });
    expect(reminderOfferCopy('before_lock', 60, null, early).title).toBe('Your players play tonight');
    expect(reminderOfferCopy('after_lock', 30, null, early)).toEqual({
      title: 'Catch the next lock',
      body: 'Want a ping 30 minutes before puck drop on your next game night?',
    });
  });

  it('asks about game nights in general from the recap', () => {
    expect(reminderOfferCopy('recap', 60, puck, early)).toEqual({
      title: 'Get the call before lock',
      body: 'Want a ping an hour before puck drop on game nights, with the call ready?',
    });
  });
});
