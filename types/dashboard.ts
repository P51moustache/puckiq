export type ModuleId = 'startSit' | 'trending' | 'alerts' | 'waiverWire' | 'matchupEdge' | 'dailyInsight';

export interface ModuleConfig {
  id: ModuleId;
  enabled: boolean;
  order: number;
}

export interface DashboardPreferences {
  modules: ModuleConfig[];
  lastCustomized: string | null;
}

export const DEFAULT_MODULES: ModuleConfig[] = [
  { id: 'startSit', enabled: true, order: 0 },
  { id: 'trending', enabled: true, order: 1 },
  { id: 'alerts', enabled: true, order: 2 },
  { id: 'waiverWire', enabled: true, order: 3 },
  { id: 'matchupEdge', enabled: true, order: 4 },
  { id: 'dailyInsight', enabled: true, order: 5 },
];

export const MODULE_META: Record<ModuleId, { title: string; icon: string; description: string }> = {
  startSit: { title: 'Start / Sit', icon: 'swap-horizontal', description: 'Quick lineup decisions for tonight' },
  trending: { title: 'Trending Now', icon: 'trending-up', description: 'Hottest players right now' },
  alerts: { title: 'Alerts', icon: 'notifications', description: 'Injuries, confirmations, lineup changes' },
  waiverWire: { title: 'Waiver Wire', icon: 'search', description: 'Top available pickups' },
  matchupEdge: { title: 'Matchup Edge', icon: 'flash', description: 'Best player matchups tonight' },
  dailyInsight: { title: 'Daily Insight', icon: 'bulb', description: 'One bold insight from our model' },
};
