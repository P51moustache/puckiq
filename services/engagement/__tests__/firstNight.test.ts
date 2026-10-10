import {
  completeStep,
  dismissFirstNight,
  FIRST_NIGHT_DAYS,
  isFirstNightActive,
  isFirstNightFinished,
  parseFirstNight,
  startFirstNight,
} from '../firstNight';

const NOW = new Date('2026-10-10T16:00:00Z');
const daysLater = (days: number) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

describe('first night guide', () => {
  it('starts with nothing done and is active right after setup', () => {
    const state = startFirstNight(NOW);
    expect(state).toEqual({ startedAt: NOW.toISOString(), done: [], dismissed: false });
    expect(isFirstNightActive(state, NOW)).toBe(true);
  });

  it('records steps once, in guide order, and finishes after all three', () => {
    let state = startFirstNight(NOW);
    state = completeStep(state, 'reminder');
    state = completeStep(state, 'players');
    expect(completeStep(state, 'players')).toBe(state);
    expect(state.done).toEqual(['players', 'reminder']);
    expect(isFirstNightFinished(state)).toBe(false);
    state = completeStep(state, 'pickup');
    expect(state.done).toEqual(['players', 'pickup', 'reminder']);
    expect(isFirstNightFinished(state)).toBe(true);
    expect(isFirstNightActive(state, NOW)).toBe(false);
  });

  it('goes away when closed', () => {
    const state = dismissFirstNight(startFirstNight(NOW));
    expect(isFirstNightActive(state, NOW)).toBe(false);
    expect(dismissFirstNight(state)).toBe(state);
  });

  it('stops showing a week after setup even if unfinished', () => {
    const state = startFirstNight(NOW);
    expect(isFirstNightActive(state, daysLater(FIRST_NIGHT_DAYS - 0.5))).toBe(true);
    expect(isFirstNightActive(state, daysLater(FIRST_NIGHT_DAYS))).toBe(false);
  });

  it('is inactive for users who never started it', () => {
    expect(isFirstNightActive(null, NOW)).toBe(false);
  });

  it('round-trips stored state and rejects anything malformed', () => {
    const state = completeStep(startFirstNight(NOW), 'pickup');
    expect(parseFirstNight(JSON.stringify(state))).toEqual(state);
    expect(parseFirstNight(JSON.stringify({ ...state, done: ['pickup', 'bogus'] }))?.done).toEqual(['pickup']);
    expect(parseFirstNight(null)).toBeNull();
    expect(parseFirstNight('not json')).toBeNull();
    expect(parseFirstNight(JSON.stringify({ done: [] }))).toBeNull();
    expect(parseFirstNight(JSON.stringify({ startedAt: 'yesterday', done: [] }))).toBeNull();
  });
});
