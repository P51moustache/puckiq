import type { CoachMove } from '../../fantasy/coach';
import type { ProStatus } from '../../subscription';
import {
  firstProMove,
  movePlayers,
  parseTrialWelcome,
  trialLine,
  TRIAL_WELCOME_WINDOW_DAYS,
  welcomeDue,
  WELCOME_MAX_PLAYERS,
} from '../trialWelcome';

const NOW = new Date('2026-10-22T22:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();

const move = (id: string, kind: CoachMove['kind'], severity: number, playerIds: number[] = [1]): CoachMove => ({
  id, kind, severity, title: id, detail: '', playerIds,
});

const TRIAL: ProStatus = { isPro: true, source: 'subscription', expiresAt: '2026-10-29T18:00:00Z', willRenew: true, periodType: 'trial' };

describe('parseTrialWelcome', () => {
  it('reads a saved purchase', () => {
    expect(parseTrialWelcome(JSON.stringify({ startedAt: hoursAgo(1), renewal: '$19.99/year' }))).toEqual({ startedAt: hoursAgo(1), renewal: '$19.99/year' });
  });

  it('treats a missing price as unknown', () => {
    expect(parseTrialWelcome(JSON.stringify({ startedAt: hoursAgo(1) }))?.renewal).toBeNull();
  });

  it('ignores nothing, junk and bad dates', () => {
    expect(parseTrialWelcome(null)).toBeNull();
    expect(parseTrialWelcome('{oops')).toBeNull();
    expect(parseTrialWelcome(JSON.stringify({ startedAt: 'soon' }))).toBeNull();
  });
});

describe('welcomeDue', () => {
  it('is due right after a purchase', () => {
    expect(welcomeDue({ startedAt: hoursAgo(0.01), renewal: null }, NOW)).toBe(true);
  });

  it('lapses once the window has passed', () => {
    expect(welcomeDue({ startedAt: hoursAgo(TRIAL_WELCOME_WINDOW_DAYS * 24 - 1), renewal: null }, NOW)).toBe(true);
    expect(welcomeDue({ startedAt: hoursAgo(TRIAL_WELCOME_WINDOW_DAYS * 24), renewal: null }, NOW)).toBe(false);
  });

  it('is not due without a purchase or with a clock that ran backwards', () => {
    expect(welcomeDue(null, NOW)).toBe(false);
    expect(welcomeDue({ startedAt: hoursAgo(-1), renewal: null }, NOW)).toBe(false);
  });
});

describe('firstProMove', () => {
  it('picks the first move free users could not see', () => {
    const moves = [move('scratch', 'scratch', 0), move('sit-a', 'overflow', 2), move('sit-b', 'overflow', 2), move('goalie', 'goalie', 3)];
    // Free users get safety checks and the first decision (sit-a), so sit-b is Pro's first.
    expect(firstProMove(moves)?.id).toBe('sit-b');
  });

  it('is null when free users already see every move', () => {
    expect(firstProMove([move('scratch', 'scratch', 0), move('sit-a', 'overflow', 2)])).toBeNull();
    expect(firstProMove([])).toBeNull();
  });

  it('never offers the all-clear as a Pro move', () => {
    expect(firstProMove([move('sit-a', 'overflow', 2), move('clean', 'clean', 5)])).toBeNull();
  });
});

describe('movePlayers', () => {
  it('calls sits and benches in red, checks in amber', () => {
    expect(movePlayers(move('sit', 'overflow', 2, [7]))).toEqual([{ playerId: 7, call: { label: 'SIT', tone: 'bad' } }]);
    expect(movePlayers(move('off', 'off', 4, [8]))[0].call).toEqual({ label: 'BENCH', tone: 'bad' });
    expect(movePlayers(move('g', 'goalie', 3, [9]))[0].call).toEqual({ label: 'CHECK', tone: 'warn' });
  });

  it('caps the faces and shows none for an empty slot', () => {
    expect(movePlayers(move('sit', 'overflow', 2, [1, 2, 3, 4, 5]))).toHaveLength(WELCOME_MAX_PLAYERS);
    expect(movePlayers(move('slot', 'empty', 2, []))).toEqual([]);
  });
});

describe('trialLine', () => {
  it('names the end of the free days and the price after', () => {
    expect(trialLine(TRIAL, '$19.99/year')).toBe('Free until Oct 29 · then $19.99/year. Cancel anytime in Settings.');
  });

  it('leaves the price out when it never loaded', () => {
    expect(trialLine(TRIAL, null)).toBe('Free until Oct 29. Cancel anytime in Settings.');
  });

  it('describes a paid plan as renewing', () => {
    expect(trialLine({ ...TRIAL, periodType: 'normal' }, '$4.99/month')).toBe('$4.99/month, renews automatically. Cancel anytime in Settings.');
  });

  it('says nothing it cannot back up', () => {
    expect(trialLine({ isPro: false, source: null, expiresAt: null, willRenew: false }, null)).toBeNull();
  });
});
