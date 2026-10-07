import type { RoomDues } from '../../../types/league';
import { duesProblemMessage, formatAmount, isIsoDate, MAX_DUES_AMOUNT, summarizeDues, validateDues } from '../dues';
import { makeRoom, member, ME } from './fixtures';

const draft: RoomDues = {
  amount: 50,
  currency: 'USD',
  deadline: '2026-10-31',
  payouts: [{ place: 2, amount: 150 }, { place: 1, amount: 350 }],
  potLink: '  https://www.leaguesafe.com/league/42  ',
};

describe('validateDues', () => {
  it('returns normalised dues: payouts by place, a trimmed pot link', () => {
    expect(validateDues(draft, 10)).toEqual({
      ok: true,
      dues: { ...draft, payouts: [{ place: 1, amount: 350 }, { place: 2, amount: 150 }], potLink: 'https://www.leaguesafe.com/league/42' },
    });
  });

  it('takes whole amounts from 0 to the cap, or no dues at all', () => {
    const noPayouts = { ...draft, payouts: [] };
    for (const amount of [null, 0, MAX_DUES_AMOUNT]) expect(validateDues({ ...noPayouts, amount }, 10).ok).toBe(true);
    for (const amount of [-1, MAX_DUES_AMOUNT + 1, 12.5]) expect(validateDues({ ...noPayouts, amount }, 10)).toEqual({ ok: false, reason: 'amount' });
  });

  it('checks currency, deadline and pot link', () => {
    expect(validateDues({ ...draft, currency: 'EUR' as never })).toEqual({ ok: false, reason: 'currency' });
    expect(validateDues({ ...draft, deadline: '2026-02-30' })).toEqual({ ok: false, reason: 'deadline' });
    expect(validateDues({ ...draft, deadline: '10/31/2026' })).toEqual({ ok: false, reason: 'deadline' });
    for (const potLink of ['http://leaguesafe.com', 'javascript:alert(1)', 'https://', `https://${'a'.repeat(400)}.com`]) {
      expect(validateDues({ ...draft, potLink })).toEqual({ ok: false, reason: 'pot_link' });
    }
    expect(validateDues({ ...draft, potLink: '   ' })).toMatchObject({ ok: true, dues: { potLink: null } });
  });

  it('needs payout places 1..n without repeats, and whole positive amounts', () => {
    expect(validateDues({ ...draft, payouts: [{ place: 1, amount: 300 }, { place: 3, amount: 100 }] })).toEqual({ ok: false, reason: 'payout_places' });
    expect(validateDues({ ...draft, payouts: [{ place: 1, amount: 300 }, { place: 1, amount: 100 }] })).toEqual({ ok: false, reason: 'payout_places' });
    expect(validateDues({ ...draft, payouts: [{ place: 1, amount: 0 }] })).toEqual({ ok: false, reason: 'payout_amount' });
    expect(validateDues({ ...draft, payouts: [{ place: 1, amount: 2.5 }] })).toEqual({ ok: false, reason: 'payout_amount' });
  });

  it('checks the payouts fit the pot when it knows the league size', () => {
    const rich = { ...draft, payouts: [{ place: 1, amount: 400 }, { place: 2, amount: 150 }] };
    expect(validateDues(rich, 10)).toEqual({ ok: false, reason: 'payouts_exceed_pot' });
    expect(validateDues(rich).ok).toBe(true);
    const tooManyPlaces = { ...draft, payouts: [1, 2, 3, 4, 5].map((place) => ({ place, amount: 10 })) };
    expect(validateDues(tooManyPlaces, 4)).toEqual({ ok: false, reason: 'payout_places' });
  });
});

describe('copy and helpers', () => {
  it('formats amounts and explains problems', () => {
    expect(formatAmount(1234567)).toBe('1,234,567');
    expect(duesProblemMessage('amount')).toContain('10,000');
    expect(duesProblemMessage('pot_link')).toContain('https://');
  });

  it('only accepts real calendar dates', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
  });
});

describe('summarizeDues', () => {
  const room = makeRoom({
    leagueSize: 10,
    dues: { amount: 50, currency: 'CAD', deadline: '2026-10-31', payouts: [{ place: 1, amount: 350 }, { place: 2, amount: 150 }], potLink: null },
  });
  const members = [member(ME, 'Zach Attack'), member('u-ben', 'Ben’s Bombers'), member('u-al', 'Al’s Allstars')];
  const statuses = [
    { roomId: 'room-1', userId: 'u-ben', paid: true, updatedAt: '' },
    { roomId: 'room-1', userId: ME, paid: false, updatedAt: '' },
    { roomId: 'room-1', userId: 'u-gone', paid: true, updatedAt: '' },
  ];

  it('totals the pot over the whole league and lists who hasn’t paid', () => {
    const summary = summarizeDues(room, statuses, members);
    expect(summary).toMatchObject({
      amount: 50,
      currency: 'CAD',
      deadline: '2026-10-31',
      potTotal: 500,
      collected: 50,
      paidCount: 1,
      memberCount: 3,
      payoutsTotal: 500,
      payoutsValid: true,
    });
    expect(summary.unpaid.map((row) => row.userId)).toEqual(['u-al', ME]);
  });

  it('treats the deadline day itself as on time', () => {
    const summary = summarizeDues(room, statuses, members);
    expect(summary.deadlinePassed('2026-10-31')).toBe(false);
    expect(summary.deadlinePassed('2026-11-01')).toBe(true);
  });

  it('flags payouts that outgrow the pot', () => {
    const greedy = makeRoom({ leagueSize: 10, dues: { ...room.dues, payouts: [{ place: 1, amount: 600 }] } });
    expect(summarizeDues(greedy, statuses, members).payoutsValid).toBe(false);
  });

  it('has nothing to collect in a room without dues', () => {
    const summary = summarizeDues(makeRoom(), statuses, members);
    expect(summary).toMatchObject({ amount: null, potTotal: 0, collected: 0, unpaid: [], payoutsValid: true });
    expect(summary.deadlinePassed('2030-01-01')).toBe(false);
  });
});
