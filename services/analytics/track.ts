/**
 * One-liners for product events. Keep names snake_case and properties free of
 * personal data (no names, emails, or rosters) — see services/analytics/posthog.ts.
 */

import AnalyticsService from './AnalyticsService';

export function track(event: string, properties?: Record<string, string | number | boolean | null | undefined>): void {
  AnalyticsService.getInstance().trackCustomEvent(event, properties);
}

export function trackScreen(screen: string): void {
  AnalyticsService.getInstance().trackScreenView(screen);
}
