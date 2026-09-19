export type SupportDestination = { type: 'email' | 'url'; value: string };

export type SettingsReturnRoute = '/(tabs)' | '/(tabs)/following' | '/(tabs)/players' | '/(tabs)/stats';

const settingsOrigins: Record<string, SettingsReturnRoute> = {
  following: '/(tabs)/following',
  players: '/(tabs)/players',
  league: '/(tabs)/stats',
  tonight: '/(tabs)',
};

export function getSettingsReturnRoute(origin?: string | string[]): SettingsReturnRoute {
  const value = Array.isArray(origin) ? origin[0] : origin;
  return (value && settingsOrigins[value]) || '/(tabs)';
}

export type SettingsOrigin = 'tonight' | 'following' | 'players' | 'league';

export function getSettingsOriginFromPathname(pathname: string): SettingsOrigin {
  if (pathname === '/following' || pathname.endsWith('/following')) return 'following';
  if (pathname === '/players' || pathname.endsWith('/players')) return 'players';
  if (pathname === '/stats' || pathname.endsWith('/stats')) return 'league';
  return 'tonight';
}

export function getSupportDestination(raw?: string): SupportDestination | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { type: 'email', value };
  if (/^https:\/\/[^\s]+$/i.test(value)) return { type: 'url', value };
  return null;
}

export const proBenefits = [
  { title: 'Fantasy Projections', subtitle: 'Projected fantasy points for tonight’s players', icon: 'analytics' as const },
  { title: 'My Team', subtitle: 'Roster, start/sit, projected points, and waiver tools', icon: 'people' as const },
];

export const proSummary = 'Pro unlocks Fantasy Projections and My Team.';
