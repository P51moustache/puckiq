/**
 * Every NHL team's current roster, from the public web API. Used to recognise player names in
 * roster text people paste or screenshot from Yahoo, ESPN or Fantrax.
 */

import { fetchJson, HOUR } from './client';
import { NHL_WEB_API } from './schedule';

/** The 32 active franchises (NHL tri-codes). */
export const ACTIVE_NHL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD',
  'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WPG', 'WSH',
] as const;

/** Rosters change through call-ups and trades, but not by the hour. */
const ROSTER_TTL_MS = 12 * HOUR;

export interface RosterPlayer {
  playerId: number;
  firstName: string;
  lastName: string;
  team: string;
  /** C, L, R, D or G as the NHL writes it. */
  position: string;
}

interface RawRosterPlayer {
  id?: number;
  firstName?: { default?: string };
  lastName?: { default?: string };
  positionCode?: string;
}

interface RawRoster {
  forwards?: RawRosterPlayer[];
  defensemen?: RawRosterPlayer[];
  goalies?: RawRosterPlayer[];
}

export function mapRoster(team: string, raw: RawRoster): RosterPlayer[] {
  const rows = [...(raw.forwards ?? []), ...(raw.defensemen ?? []), ...(raw.goalies ?? [])];
  return rows.flatMap((row) => {
    const firstName = row.firstName?.default?.trim();
    const lastName = row.lastName?.default?.trim();
    if (!row.id || !firstName || !lastName) return [];
    return [{ playerId: row.id, firstName, lastName, team, position: row.positionCode ?? '' }];
  });
}

export async function fetchTeamRoster(team: string, options: { force?: boolean } = {}): Promise<RosterPlayer[]> {
  const raw = await fetchJson<RawRoster>(`${NHL_WEB_API}/v1/roster/${team}/current`, { ttlMs: ROSTER_TTL_MS, persist: true, force: options.force });
  return mapRoster(team, raw);
}

/**
 * The web API rate-limits a burst of 32 roster requests (429s after ~25 at four at a time), so
 * load two at a time and give the teams that failed one more try after a pause.
 */
const ROSTER_CONCURRENCY = 2;
const RETRY_PAUSE_MS = 1_500;

async function loadTeams(teams: readonly string[], options: { force?: boolean }): Promise<Map<string, RosterPlayer[]>> {
  const loaded = new Map<string, RosterPlayer[]>();
  let next = 0;
  const worker = async () => {
    while (next < teams.length) {
      const team = teams[next];
      next += 1;
      try {
        loaded.set(team, await fetchTeamRoster(team, options));
      } catch {
        // Retried below.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(ROSTER_CONCURRENCY, teams.length) }, worker));
  return loaded;
}

/**
 * All active NHL players. Teams that still fail after the retry are left out rather than failing
 * the rest (the import's search fallback covers their players).
 */
export async function fetchAllRosters(options: { force?: boolean } = {}): Promise<RosterPlayer[]> {
  const loaded = await loadTeams(ACTIVE_NHL_TEAMS, options);
  const missing = ACTIVE_NHL_TEAMS.filter((team) => !loaded.has(team));
  if (missing.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    for (const [team, players] of await loadTeams(missing, options)) loaded.set(team, players);
  }
  const players = [...loaded.values()].flat();
  if (players.length === 0) throw new Error('No NHL rosters loaded');
  return players;
}
