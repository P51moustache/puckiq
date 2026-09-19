export type GameOrigin = 'home' | 'book' | 'link';
export type TeamOrigin = 'following' | 'league';

function scalar(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

export function gameOrigin(value: string | string[] | undefined): GameOrigin {
  const origin = scalar(value);
  return origin === 'book' || origin === 'home' ? origin : 'link';
}

export function teamOrigin(value: string | string[] | undefined): TeamOrigin | null {
  const origin = scalar(value);
  return origin === 'following' || origin === 'league' ? origin : null;
}

export function teamOriginRoute(origin: TeamOrigin): '/(tabs)/following' | '/(tabs)/stats' {
  return origin === 'following' ? '/(tabs)/following' : '/(tabs)/stats';
}
