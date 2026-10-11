/** The existing-user cohort is frozen before this launch campaign. */
export const RELEASE_NOTICE_ID = 'puckiq-player-3.2';
export const ONBOARDING_KEY = 'puckiq_onboarding_complete';

export const LOYALTY_CAMPAIGN = {
  downloadedBefore: '2026-10-04T00:00:00Z',
  startsAt: '2026-10-04T00:00:00Z',
  days: 30,
} as const;

export const RELEASE_FEATURES = [
  { icon: 'person-outline', title: 'Player scouting', body: 'Faded portraits, recent-performance graphs, schedule assessments and estimated season outlooks.' },
  { icon: 'sparkles-outline', title: 'Your best lineup', body: 'Compare the recommended lineup with your saved start/bench plan by date. Full optimization with Pro.' },
  { icon: 'trending-up-outline', title: 'Insights you can act on', body: 'Open each recommendation to see the reason, affected players and the next step.' },
  { icon: 'calendar-outline', title: 'A connected week', body: 'Find pickups for the exact night you need, spot empty slots and prepare for lineup lock.' },
] as const;
