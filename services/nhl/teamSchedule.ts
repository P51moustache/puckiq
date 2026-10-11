/** Full published regular-season schedule, for player outlooks and remaining-game estimates. */
import { fetchJson, HOUR } from './client';
import {
  NHL_WEB_API,
  normalizeGame,
  isFantasyGame,
  type NhlGame,
} from './schedule';

export function mapTeamSchedule(payload: { games?: unknown[] }): NhlGame[] {
  const seen = new Set<number>();
  return (Array.isArray(payload.games) ? payload.games : [])
    .filter((raw) => raw && typeof raw === 'object')
    .map((raw) => normalizeGame(raw as Parameters<typeof normalizeGame>[0], ''))
    .filter(
      (game): game is NhlGame =>
        game !== null &&
        isFantasyGame(game) &&
        /^\d{4}-\d{2}-\d{2}$/.test(game.date),
    )
    .filter((game) => {
      if (seen.has(game.id)) return false;
      seen.add(game.id);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

export async function fetchTeamSchedule(
  team: string,
  seasonId: number,
  force = false,
): Promise<NhlGame[]> {
  if (!/^[A-Z]{3}$/.test(team)) return [];
  const payload = await fetchJson<{ games?: unknown[] }>(
    `${NHL_WEB_API}/v1/club-schedule-season/${team}/${seasonId}`,
    {
      ttlMs: 6 * HOUR,
      persist: true,
      force,
    },
  );
  return mapTeamSchedule(payload);
}
