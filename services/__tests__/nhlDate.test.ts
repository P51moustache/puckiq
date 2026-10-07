import { getEtHour, getNhlCalendarDate, getNhlGameDay, GAME_DAY_ROLLOVER_HOUR_ET } from '../nhlDate';

describe('getNhlCalendarDate', () => {
  it('formats an Eastern calendar date as YYYY-MM-DD', () => {
    const winter = new Date('2026-01-15T18:00:00Z');
    expect(getNhlCalendarDate(winter)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getNhlCalendarDate(winter)).toBe('2026-01-15');
  });

  it('stays on the previous Eastern day late at night UTC', () => {
    const late = new Date('2026-01-16T03:30:00Z');
    expect(getNhlCalendarDate(late)).toBe('2026-01-15');
  });
});

describe('getNhlGameDay', () => {
  it('rolls over at 6 AM Eastern', () => {
    expect(GAME_DAY_ROLLOVER_HOUR_ET).toBe(6);
  });

  it('keeps a 10:30 PM ET puck drop on its own day past midnight Eastern', () => {
    // Tue Oct 13, 11:59 PM ET and Wed Oct 14, 1:15 AM ET (EDT = UTC-4): still Tuesday's games.
    expect(getNhlGameDay(new Date('2026-10-14T03:59:00Z'))).toBe('2026-10-13');
    expect(getNhlGameDay(new Date('2026-10-14T05:15:00Z'))).toBe('2026-10-13');
  });

  it('moves to the new day from 6 AM Eastern', () => {
    expect(getNhlGameDay(new Date('2026-10-14T09:59:00Z'))).toBe('2026-10-13');
    expect(getNhlGameDay(new Date('2026-10-14T10:00:00Z'))).toBe('2026-10-14');
    expect(getNhlGameDay(new Date('2026-10-14T23:00:00Z'))).toBe('2026-10-14');
  });

  it('works in winter (EST = UTC-5)', () => {
    expect(getNhlGameDay(new Date('2026-01-16T06:30:00Z'))).toBe('2026-01-15'); // 1:30 AM ET
    expect(getNhlGameDay(new Date('2026-01-16T11:00:00Z'))).toBe('2026-01-16'); // 6:00 AM ET
  });
});

describe('getEtHour', () => {
  it('reads the Eastern hour', () => {
    expect(getEtHour(new Date('2026-10-14T03:30:00Z'))).toBe(23);
    expect(getEtHour(new Date('2026-10-14T04:30:00Z'))).toBe(0);
    expect(getEtHour(new Date('2026-10-14T15:30:00Z'))).toBe(11);
  });
});
