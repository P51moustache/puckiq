import { formatLockCountdown, isPlayerLocked } from '../lockCountdown';

const now = new Date('2026-08-22T18:00:00Z');

describe('formatLockCountdown', () => {
  it('returns null when there is no start time', () => {
    expect(formatLockCountdown(null, now)).toBeNull();
  });

  it('counts down to puck-drop as lock', () => {
    expect(formatLockCountdown('2026-08-22T20:14:00Z', now)).toBe('Locks in 2h 14m');
    expect(formatLockCountdown('2026-08-22T18:40:00Z', now)).toBe('Locks in 40m');
    expect(formatLockCountdown('2026-08-24T20:00:00Z', now)).toBe('Locks in 2d 2h');
  });

  it('says Locked after puck-drop or once the game is live', () => {
    expect(formatLockCountdown('2026-08-22T17:00:00Z', now)).toBe('Locked');
    expect(formatLockCountdown('2026-08-22T20:00:00Z', now, 'LIVE')).toBe('Locked');
    expect(isPlayerLocked('2026-08-22T20:00:00Z', 'FINAL', now)).toBe(true);
  });
});
