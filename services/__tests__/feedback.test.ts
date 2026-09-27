jest.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {} }));

import {
  buildFeedbackRow,
  FEEDBACK_MAX,
  feedbackMailto,
  feedbackProblem,
  isValidEmail,
  sendFeedback,
} from '../feedback';

const context = {
  appVersion: '3.0.0',
  build: '27',
  platform: 'ios',
  osVersion: '26.5',
  device: 'iPhone 17 Pro',
  isPro: true,
  screen: 'settings',
  userId: null,
};

describe('feedbackProblem', () => {
  it('needs a real message', () => {
    expect(feedbackProblem({ category: 'bug', message: '  ' })).toMatch(/few words/);
    expect(feedbackProblem({ category: 'bug', message: 'ok' })).toMatch(/few words/);
    expect(feedbackProblem({ category: 'bug', message: 'Pickups crashed' })).toBeNull();
  });

  it('caps the length', () => {
    expect(feedbackProblem({ category: 'idea', message: 'x'.repeat(FEEDBACK_MAX + 1) })).toMatch(/under/);
  });

  it('allows a blank email but rejects a malformed one', () => {
    expect(feedbackProblem({ category: 'idea', message: 'Add Fantrax import', email: '' })).toBeNull();
    expect(feedbackProblem({ category: 'idea', message: 'Add Fantrax import', email: 'me@' })).toMatch(/email/);
    expect(feedbackProblem({ category: 'idea', message: 'Add Fantrax import', email: ' me@x.co ' })).toBeNull();
  });
});

describe('isValidEmail', () => {
  it('accepts Apple private relay addresses', () => {
    expect(isValidEmail('abc123@privaterelay.appleid.com')).toBe(true);
    expect(isValidEmail('no spaces@x.com')).toBe(false);
  });
});

describe('buildFeedbackRow', () => {
  it('trims input, drops a bad email, and maps context to columns', () => {
    const row = buildFeedbackRow({ category: 'bug', message: '  Goalie card is blank \n', email: 'nope' }, context);
    expect(row).toEqual({
      category: 'bug',
      message: 'Goalie card is blank',
      email: null,
      app_version: '3.0.0',
      build: '27',
      platform: 'ios',
      os_version: '26.5',
      device: 'iPhone 17 Pro',
      is_pro: true,
      screen: 'settings',
      user_id: null,
    });
  });

  it('clips context to the column limits', () => {
    const row = buildFeedbackRow({ category: 'other', message: 'hello' }, { device: 'd'.repeat(100) });
    expect(row.device).toHaveLength(64);
    expect(row.is_pro).toBeNull();
    expect(row.app_version).toBeNull();
  });
});

describe('sendFeedback', () => {
  const row = buildFeedbackRow({ category: 'praise', message: 'Love the week grid' }, context);

  it('inserts into app_feedback without reading back', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn(() => ({ insert }));
    await sendFeedback(row, { from } as never, true);
    expect(from).toHaveBeenCalledWith('app_feedback');
    expect(insert).toHaveBeenCalledWith(row);
  });

  it('throws on a database error so the sheet can offer email', async () => {
    const from = () => ({ insert: jest.fn().mockResolvedValue({ error: { message: 'new row violates check' } }) });
    await expect(sendFeedback(row, { from } as never, true)).rejects.toThrow('new row violates check');
  });

  it('throws when Supabase is not configured', async () => {
    await expect(sendFeedback(row, { from: jest.fn() } as never, false)).rejects.toThrow(/not configured/);
  });
});

describe('feedbackMailto', () => {
  it('carries the message and context in a prefilled email', () => {
    const row = buildFeedbackRow({ category: 'bug', message: 'Tonight shows 0 games' }, context);
    const url = feedbackMailto(row, 'help@example.com');
    expect(url.startsWith('mailto:help@example.com?subject=')).toBe(true);
    const body = decodeURIComponent(url.split('&body=')[1]);
    expect(decodeURIComponent(url.split('subject=')[1].split('&')[0])).toBe('PuckIQ feedback: Bug');
    expect(body).toContain('Tonight shows 0 games');
    expect(body).toContain('PuckIQ 3.0.0 (27) · ios 26.5 · iPhone 17 Pro · Pro');
  });
});
