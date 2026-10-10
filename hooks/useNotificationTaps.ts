/**
 * Opens Tonight when any PuckIQ notification is tapped — lineup reminders, "your night is
 * live", scratch and goal alerts — including the tap that cold-launched the app.
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { notificationTarget } from '../services/engagement/notificationTarget';
import { track } from '../services/analytics/track';

export function useNotificationTaps(): void {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const target = notificationTarget(response.notification.request.content.data);
    if (!target) return;
    track('notification_open', { kind: target.kind });
    router.push(target.route as Href);
    // Otherwise the same response comes back on the next launch.
    Notifications.clearLastNotificationResponseAsync?.().catch(() => undefined);
  }, [response]);
}

/** Mount once, inside the navigator, after setup. */
export function NotificationTaps(): null {
  useNotificationTaps();
  return null;
}
