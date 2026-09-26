/**
 * PuckIQ is free to download with a Pro subscription (RevenueCat entitlement `pro`).
 * Store prices come from App Store Connect via RevenueCat; these are display fallbacks
 * for when the store can't be reached.
 */

export const LIST_PRICE_ANNUAL = '$19.99';
export const LIST_PRICE_MONTHLY = '$4.99';

export const FREE_FEATURES = [
  'Your roster, from real NHL players',
  'Tonight: who plays, puck-drop countdown, NHL scratch checks, live stats',
  'This week’s schedule grid and off-nights',
  'One coach move every day',
  'Lineup reminder before first puck',
] as const;

export interface ProFeature {
  title: string;
  detail: string;
  icon: string;
}

export const PRO_FEATURES: ProFeature[] = [
  { icon: 'grid-outline', title: 'Tonight’s best lineup', detail: 'Slot-aware start/sit for your league’s exact positions.' },
  { icon: 'flash-outline', title: 'Every coach move', detail: 'Overflow sits, empty slots, goalie start rates, injury checks.' },
  { icon: 'calendar-outline', title: 'Week planner', detail: 'Games that actually count — this week and next.' },
  { icon: 'trending-up-outline', title: 'Pickups for YOUR holes', detail: 'Streamers ranked by the empty slots they fill for you.' },
  { icon: 'git-compare-outline', title: 'Matchup edge', detail: 'Your usable games vs your opponent’s, day by day.' },
  { icon: 'pulse-outline', title: 'Player trends', detail: 'Full game logs, last-14 form, and goalie workload.' },
  { icon: 'speedometer-outline', title: 'NHL Edge telemetry', detail: 'Skating speed, shot speed, and danger-zone stats vs the league.' },
  { icon: 'layers-outline', title: 'Up to 5 leagues', detail: 'Every team you manage, one tap apart.' },
];

/** Paywall is on. Set EXPO_PUBLIC_PAYWALL_ENABLED=0 to hide purchase buttons (e.g. store products not live yet). */
export function isPaywallEnabled(): boolean {
  return process.env.EXPO_PUBLIC_PAYWALL_ENABLED !== '0';
}

/** Where the paywall was opened from — sent to analytics. */
export type PaywallSource =
  | 'tonight_lineup'
  | 'tonight_moves'
  | 'week_planner'
  | 'week_next'
  | 'matchup'
  | 'pickups'
  | 'player_trends'
  | 'player_edge'
  | 'teams'
  | 'settings'
  | 'onboarding';
