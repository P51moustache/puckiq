/**
 * Where a tapped notification should take you. Every PuckIQ notification is about tonight —
 * lineup reminders, "your night is live", scratch and goal alerts — so they all open Tonight.
 * Anything else (or a notification from an older build without data) is left alone.
 */

export type NotificationKind = 'lineup' | 'live' | 'goal' | 'scratch';

const KINDS: readonly NotificationKind[] = ['lineup', 'live', 'goal', 'scratch'];

export interface NotificationTarget {
  kind: NotificationKind;
  route: '/';
}

export function notificationTarget(data: unknown): NotificationTarget | null {
  if (!data || typeof data !== 'object') return null;
  const { kind, screen } = data as { kind?: unknown; screen?: unknown };
  if (typeof kind === 'string' && (KINDS as readonly string[]).includes(kind)) return { kind: kind as NotificationKind, route: '/' };
  // Lineup reminders scheduled by 3.1 and earlier carry only `screen`.
  if (screen === 'tonight') return { kind: 'lineup', route: '/' };
  return null;
}
