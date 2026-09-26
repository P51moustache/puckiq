/**
 * Single-player detail: bio/headshot (landing) and the per-game log.
 */

import { fetchJson, HOUR } from './client';
import { NHL_WEB_API } from './schedule';

export interface PlayerProfile {
  playerId: number;
  name: string;
  team: string;
  teamName: string;
  position: string;
  sweaterNumber: number | null;
  headshot: string | null;
  age: number | null;
  shoots: string | null;
  isActive: boolean;
}

export interface GameLogRow {
  gameId: number;
  date: string;
  opponent: string;
  isHome: boolean;
  goals: number;
  assists: number;
  points: number;
  ppp: number;
  shots: number;
  plusMinus: number;
  pim: number;
  toi: string;
  /** Goalies */
  started: boolean;
  decision: string | null;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  shutout: boolean;
}

export interface PlayerGameLog {
  seasonId: number;
  games: GameLogRow[];
}

function ageOn(birthDate: string | undefined, now: Date): number | null {
  if (!birthDate) return null;
  const born = Date.parse(birthDate);
  if (!Number.isFinite(born)) return null;
  const years = (now.getTime() - born) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.floor(years);
}

export function mapLanding(payload: any, now: Date = new Date()): PlayerProfile {
  const first = payload?.firstName?.default ?? '';
  const last = payload?.lastName?.default ?? '';
  return {
    playerId: Number(payload?.playerId ?? 0),
    name: `${first} ${last}`.trim(),
    team: String(payload?.currentTeamAbbrev ?? '').toUpperCase(),
    teamName: payload?.fullTeamName?.default ?? '',
    position: String(payload?.position ?? ''),
    sweaterNumber: payload?.sweaterNumber == null ? null : Number(payload.sweaterNumber),
    headshot: typeof payload?.headshot === 'string' ? payload.headshot : null,
    age: ageOn(payload?.birthDate, now),
    shoots: payload?.shootsCatches ?? null,
    isActive: payload?.isActive !== false,
  };
}

export function mapGameLog(payload: any, seasonId: number): PlayerGameLog {
  const rows: GameLogRow[] = (Array.isArray(payload?.gameLog) ? payload.gameLog : []).map((row: any) => ({
    gameId: Number(row.gameId ?? 0),
    date: String(row.gameDate ?? ''),
    opponent: String(row.opponentAbbrev ?? '').toUpperCase(),
    isHome: row.homeRoadFlag === 'H',
    goals: Number(row.goals ?? 0),
    assists: Number(row.assists ?? 0),
    points: Number(row.points ?? 0),
    ppp: Number(row.powerPlayPoints ?? 0),
    shots: Number(row.shots ?? 0),
    plusMinus: Number(row.plusMinus ?? 0),
    pim: Number(row.pim ?? 0),
    toi: String(row.toi ?? ''),
    started: Number(row.gamesStarted ?? 0) > 0,
    decision: row.decision ?? null,
    saves: Math.max(0, Number(row.shotsAgainst ?? 0) - Number(row.goalsAgainst ?? 0)),
    shotsAgainst: Number(row.shotsAgainst ?? 0),
    goalsAgainst: Number(row.goalsAgainst ?? 0),
    shutout: Number(row.shutouts ?? 0) > 0,
  }));
  // Newest first, regardless of API order.
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { seasonId, games: rows };
}

export async function fetchPlayerProfile(playerId: number): Promise<PlayerProfile> {
  const payload = await fetchJson<any>(`${NHL_WEB_API}/v1/player/${playerId}/landing`, {
    ttlMs: 12 * HOUR,
    persist: true,
  });
  return mapLanding(payload);
}

export async function fetchPlayerGameLog(playerId: number, seasonId: number, options: { force?: boolean } = {}): Promise<PlayerGameLog> {
  const payload = await fetchJson<any>(`${NHL_WEB_API}/v1/player/${playerId}/game-log/${seasonId}/2`, {
    ttlMs: 2 * HOUR,
    persist: true,
    force: options.force,
  });
  return mapGameLog(payload, seasonId);
}

/** NHL headshot CDN path; falls back gracefully in the UI when a player moved teams. */
export function headshotUrl(playerId: number, team: string, seasonId: number): string | null {
  if (!team || !playerId) return null;
  return `https://assets.nhle.com/mugs/nhl/${seasonId}/${team.toUpperCase()}/${playerId}.png`;
}
