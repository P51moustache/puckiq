/**
 * Link names typed into PuckIQ 2.x to real NHL players when the match is unambiguous:
 * exactly one active NHL player with that exact name.
 */

import type { FantasyPlayer, NhlSearchPlayer } from '../../types/fantasy';
import { searchNhlPlayers } from '../nhlPlayerSearch';
import { isNhlLinked } from './positions';

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function uniqueExactMatch(name: string, results: NhlSearchPlayer[]): NhlSearchPlayer | null {
  const target = normalizeName(name);
  const exact = results.filter((row) => row.active && normalizeName(row.name) === target);
  return exact.length === 1 ? exact[0] : null;
}

export async function findExactNhlMatches(
  players: FantasyPlayer[],
  search: (query: string) => Promise<NhlSearchPlayer[]> = (query) => searchNhlPlayers(query, 10),
): Promise<Map<number, NhlSearchPlayer>> {
  const matches = new Map<number, NhlSearchPlayer>();
  const pending = players.filter((player) => !isNhlLinked(player));
  const CONCURRENCY = 3;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    await Promise.all(pending.slice(i, i + CONCURRENCY).map(async (player) => {
      try {
        const match = uniqueExactMatch(player.playerName, await search(player.playerName));
        if (match) matches.set(player.playerId, match);
      } catch {
        // Leave it for manual linking.
      }
    }));
  }
  return matches;
}
