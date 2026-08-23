import { getNhlCalendarDate } from '../nhlDate';

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
