import { ACTIVE_DAY_MIN_MS, addForegroundTime, NO_ACTIVE_DAYS, parseActiveDays } from '../activeDays';

describe('addForegroundTime', () => {
  it('counts a day once it reaches a minute in front, summed over visits', () => {
    let state = addForegroundTime(NO_ACTIVE_DAYS, '2026-10-20', 40_000);
    expect(state.count).toBe(0);
    state = addForegroundTime(state, '2026-10-20', 25_000);
    expect(state).toEqual({ count: 1, firstDay: '2026-10-20', day: '2026-10-20', todayMs: 65_000 });
  });

  it('counts each day only once', () => {
    let state = addForegroundTime(NO_ACTIVE_DAYS, '2026-10-20', ACTIVE_DAY_MIN_MS);
    state = addForegroundTime(state, '2026-10-20', 10 * ACTIVE_DAY_MIN_MS);
    expect(state.count).toBe(1);
  });

  it('starts the clock over on a new day and keeps the first day', () => {
    let state = addForegroundTime(NO_ACTIVE_DAYS, '2026-10-20', 50_000);
    state = addForegroundTime(state, '2026-10-21', 30_000);
    expect(state).toMatchObject({ count: 0, firstDay: null, todayMs: 30_000 });
    state = addForegroundTime(state, '2026-10-21', 30_000);
    state = addForegroundTime(state, '2026-10-22', 90_000);
    expect(state).toMatchObject({ count: 2, firstDay: '2026-10-21', day: '2026-10-22' });
  });

  it('ignores empty or negative stretches', () => {
    expect(addForegroundTime(NO_ACTIVE_DAYS, '2026-10-20', 0)).toBe(NO_ACTIVE_DAYS);
    expect(addForegroundTime(NO_ACTIVE_DAYS, '2026-10-20', -5)).toBe(NO_ACTIVE_DAYS);
    expect(addForegroundTime(NO_ACTIVE_DAYS, '2026-10-20', NaN)).toBe(NO_ACTIVE_DAYS);
  });
});

describe('parseActiveDays', () => {
  it('reads back what it saved', () => {
    const state = addForegroundTime(NO_ACTIVE_DAYS, '2026-10-20', 70_000);
    expect(parseActiveDays(JSON.stringify(state))).toEqual(state);
  });

  it('falls back to nothing on missing or broken data', () => {
    expect(parseActiveDays(null)).toEqual(NO_ACTIVE_DAYS);
    expect(parseActiveDays('{oops')).toEqual(NO_ACTIVE_DAYS);
    expect(parseActiveDays('{"count":-2,"todayMs":"x"}')).toEqual(NO_ACTIVE_DAYS);
  });
});
