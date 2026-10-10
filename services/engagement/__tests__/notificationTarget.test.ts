import { notificationTarget } from '../notificationTarget';

describe('notificationTarget', () => {
  it('opens Tonight for every kind of PuckIQ notification', () => {
    for (const kind of ['lineup', 'live', 'goal', 'scratch'] as const) {
      expect(notificationTarget({ kind, screen: 'tonight' })).toEqual({ kind, route: '/' });
    }
  });

  it('treats reminders scheduled by older builds (screen only) as lineup reminders', () => {
    expect(notificationTarget({ screen: 'tonight', date: '2026-10-10' })).toEqual({ kind: 'lineup', route: '/' });
  });

  it('ignores anything else', () => {
    expect(notificationTarget(undefined)).toBeNull();
    expect(notificationTarget(null)).toBeNull();
    expect(notificationTarget('goal')).toBeNull();
    expect(notificationTarget({ kind: 'promo' })).toBeNull();
    expect(notificationTarget({ screen: 'settings' })).toBeNull();
  });
});
