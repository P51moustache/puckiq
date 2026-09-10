import { getArenaTeam } from '../constants/arenaTheme';
export function parseEntityId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
export function parseTeamParam(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? getArenaTeam(value)?.abbrev ?? null : null;
}
