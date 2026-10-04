/** The existing-user cohort is frozen before this launch campaign. */
export const RELEASE_NOTICE_ID = 'puckiq-coach-3.0';
export const ONBOARDING_KEY = 'puckiq_onboarding_complete';

export const LOYALTY_CAMPAIGN = {
  downloadedBefore: '2026-10-04T00:00:00Z',
  startsAt: '2026-10-04T00:00:00Z',
  days: 30,
} as const;

export const RELEASE_FEATURES = [
  { icon: 'alarm-outline', title: 'A coach before lock', body: 'Who plays, NHL scratch checks, lineup reminders, and moves for tonight.' },
  { icon: 'calendar-outline', title: 'Games that count', body: 'Find bench overflow and empty slots across your week with Pro.' },
  { icon: 'swap-horizontal-outline', title: 'Pickups that fit', body: 'Rank streamers by the nights they would actually start for your team.' },
  { icon: 'stats-chart-outline', title: 'More ways to scout and share', body: 'Player game logs, NHL Edge stats, matchup planning, and cards for your league chat.' },
] as const;
