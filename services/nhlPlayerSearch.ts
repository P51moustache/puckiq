/**
 * Search active NHL players via the official NHL site search.
 * Used for manual roster add so we do not depend on a seeded Supabase players table.
 */

import { nhlPlayerSearchEndpoint } from '../lib/nhlEndpoints';
import type { NhlSearchPlayer } from '../types/fantasy';
import type { LineGroup } from '../types/lines';

export { NHL_PLAYER_SEARCH_URL } from '../lib/nhlEndpoints';

interface NhlSearchRow {
  playerId?: string | number;
  name?: string;
  positionCode?: string;
  teamAbbrev?: string | null;
  lastTeamAbbrev?: string | null;
  active?: boolean;
}

export function mapNhlSearchRow(row: NhlSearchRow): NhlSearchPlayer | null {
  const playerId = Number(row.playerId);
  const name = (row.name ?? '').trim();
  if (!Number.isFinite(playerId) || playerId <= 0 || !name) {
    return null;
  }
  return {
    playerId,
    name,
    teamAbbrev: row.teamAbbrev || row.lastTeamAbbrev || '',
    position: row.positionCode || '',
    active: row.active === true,
  };
}

/** Official NHL position → this week's F / D / G. Same mapping old Pick IQ used. */
export function suggestedLineGroup(position: string): LineGroup {
  const code = position.trim().toUpperCase();
  if (code === 'G') return 'G';
  if (code === 'D') return 'D';
  return 'F';
}

/** Prefer active NHL hits; keep inactive only when the query has no active match. */
export function preferActiveHits(players: NhlSearchPlayer[]): NhlSearchPlayer[] {
  const active = players.filter((player) => player.active);
  return active.length > 0 ? active : players;
}

export function rankSearchResults(players: NhlSearchPlayer[], query: string): NhlSearchPlayer[] {
  const q = query.trim().toLowerCase();
  return [...players].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const aStarts = a.name.toLowerCase().startsWith(q) || a.name.toLowerCase().split(' ').pop()?.startsWith(q);
    const bStarts = b.name.toLowerCase().startsWith(q) || b.name.toLowerCase().split(' ').pop()?.startsWith(q);
    if (!!aStarts !== !!bStarts) return aStarts ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function searchNhlPlayers(query: string, limit = 20): Promise<NhlSearchPlayer[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `${nhlPlayerSearchEndpoint()}?culture=en-us&limit=${limit}&q=${encodeURIComponent(trimmed)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NHL player search failed (${res.status})`);
  }
  const payload = await res.json();
  const rows = Array.isArray(payload) ? payload : [];
  const mapped = rows
    .map((row: NhlSearchRow) => mapNhlSearchRow(row))
    .filter((p: NhlSearchPlayer | null): p is NhlSearchPlayer => p !== null);
  return preferActiveHits(rankSearchResults(mapped, trimmed));
}
