/**
 * Search active NHL players via the official NHL site search.
 * Used for manual roster add so we do not depend on a seeded Supabase players table.
 */

import type { NhlSearchPlayer } from '../types/fantasy';

export const NHL_PLAYER_SEARCH_URL = 'https://search.d3.nhle.com/api/v1/search/player';

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

function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * How well a name matches a typed query, higher is better:
 * exact full name > every word prefixes a name part > surname prefix > anything else.
 * The NHL search API matches on any word, so "Jake Oettinger" returns every Jake first.
 */
export function matchScore(name: string, query: string): number {
  const full = foldName(name);
  const q = foldName(query).replace(/\s+/g, ' ');
  if (!q) return 0;
  if (full === q) return 100;
  const parts = full.split(/\s+/);
  const words = q.split(' ');
  const allWordsMatch = words.every((word) => parts.some((part) => part.startsWith(word)));
  if (allWordsMatch && words.length > 1) return 80;
  if (full.startsWith(q)) return 70;
  const last = parts[parts.length - 1] ?? '';
  if (last.startsWith(q)) return 60;
  if (allWordsMatch) return 40;
  return 0;
}

export function rankSearchResults(players: NhlSearchPlayer[], query: string): NhlSearchPlayer[] {
  return [...players].sort((a, b) => {
    const scoreDiff = matchScore(b.name, query) - matchScore(a.name, query);
    if (scoreDiff !== 0) return scoreDiff;
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Ask the API for more than we show — its own ordering buries full-name matches. */
const MIN_FETCH = 40;

/**
 * `activeOnly` filters on the server: the API caps results before any client filter, and
 * short queries fill that cap with retired players ("mcd" → 40 retirees, no McDavid).
 */
export async function searchNhlPlayers(query: string, limit = 20, { activeOnly = true } = {}): Promise<NhlSearchPlayer[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `${NHL_PLAYER_SEARCH_URL}?culture=en-us&limit=${Math.max(limit, MIN_FETCH)}&q=${encodeURIComponent(trimmed)}${activeOnly ? '&active=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NHL player search failed (${res.status})`);
  }
  const payload = await res.json();
  const rows = Array.isArray(payload) ? payload : [];
  const mapped = rows
    .map((row: NhlSearchRow) => mapNhlSearchRow(row))
    .filter((p: NhlSearchPlayer | null): p is NhlSearchPlayer => p !== null);
  return rankSearchResults(mapped, trimmed).slice(0, limit);
}
