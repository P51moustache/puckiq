/**
 * League stats from the public NHL stats REST API (api.nhle.com/stats/rest).
 * Batched by player id so a whole roster costs a couple of requests, not one per player.
 */

import { fetchJson, HOUR, withQuery } from './client';

export const NHL_STATS_API = 'https://api.nhle.com/stats/rest/en';

const PAGE_SIZE = 100;
const ID_CHUNK = 80;

export interface SkaterLine {
  playerId: number;
  name: string;
  /** NHL position code: C, L, R, D */
  position: string;
  /** Most recent team (traded players list several; the last is current). Empty for date-range aggregates. */
  team: string;
  gp: number;
  goals: number;
  assists: number;
  points: number;
  ppp: number;
  shots: number;
  hits: number;
  blocks: number;
  plusMinus: number;
  /** Seconds */
  toiPerGame: number;
}

export interface GoalieLine {
  playerId: number;
  name: string;
  team: string;
  gp: number;
  gs: number;
  wins: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  shutouts: number;
  savePct: number;
  gaa: number;
}

export interface StatsQuery {
  /** Whole-season rows (with team). */
  seasonId?: number;
  /** Date-range aggregate, inclusive, "YYYY-MM-DD". */
  from?: string;
  to?: string;
  playerIds?: number[];
  /** League-wide queries: how many rows (paged 100 at a time). */
  limit?: number;
  sortBy?: 'points' | 'shots' | 'wins' | 'gamesStarted';
  force?: boolean;
}

function lastTeam(teamAbbrevs: unknown): string {
  if (typeof teamAbbrevs !== 'string' || !teamAbbrevs) return '';
  const parts = teamAbbrevs.split(',').map((part) => part.trim()).filter(Boolean);
  return (parts[parts.length - 1] ?? '').toUpperCase();
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function baseFilter(query: StatsQuery): string[] {
  const parts = ['gameTypeId=2'];
  if (query.seasonId) parts.push(`seasonId=${query.seasonId}`);
  if (query.from) parts.push(`gameDate>="${query.from}"`);
  if (query.to) parts.push(`gameDate<="${query.to}"`);
  return parts;
}

function reportUrl(report: string, query: StatsQuery, extra: string[], start: number, limit: number): string {
  const isRange = !!(query.from || query.to);
  const defaultSort = report.startsWith('goalie') ? 'wins' : report.endsWith('realtime') ? 'hits' : 'points';
  const sortProperty = query.sortBy ?? defaultSort;
  return withQuery(`${NHL_STATS_API}/${report}`, {
    isAggregate: isRange ? 'true' : 'false',
    isGame: isRange ? 'true' : 'false',
    sort: JSON.stringify([{ property: sortProperty, direction: 'DESC' }, { property: 'playerId', direction: 'ASC' }]),
    start,
    limit,
    cayenneExp: [...extra, ...baseFilter(query)].join(' and '),
  });
}

async function fetchReport(report: string, query: StatsQuery): Promise<any[]> {
  const ttl = query.from || query.to ? 2 * HOUR : 3 * HOUR;
  if (query.playerIds) {
    const ids = [...new Set(query.playerIds.filter((id) => Number.isFinite(id) && id > 0))].sort((a, b) => a - b);
    if (ids.length === 0) return [];
    const pages = await Promise.all(
      chunk(ids, ID_CHUNK).map((group) =>
        fetchJson<{ data?: any[] }>(reportUrl(report, query, [`playerId in (${group.join(',')})`], 0, PAGE_SIZE), {
          ttlMs: ttl,
          persist: true,
          force: query.force,
        }),
      ),
    );
    return pages.flatMap((page) => page.data ?? []);
  }

  const limit = Math.max(1, query.limit ?? PAGE_SIZE);
  const starts: number[] = [];
  for (let start = 0; start < limit; start += PAGE_SIZE) starts.push(start);
  const pages = await Promise.all(
    starts.map((start) =>
      fetchJson<{ data?: any[] }>(reportUrl(report, query, [], start, Math.min(PAGE_SIZE, limit - start)), {
        ttlMs: ttl,
        persist: true,
        force: query.force,
      }),
    ),
  );
  return pages.flatMap((page) => page.data ?? []);
}

export function mapSkaterRows(summary: any[], realtime: any[]): SkaterLine[] {
  const physical = new Map<number, { hits: number; blocks: number }>();
  for (const row of realtime) {
    physical.set(num(row.playerId), { hits: num(row.hits), blocks: num(row.blockedShots) });
  }
  return summary
    .filter((row) => num(row.playerId) > 0)
    .map((row) => {
      const id = num(row.playerId);
      const extra = physical.get(id);
      return {
        playerId: id,
        name: String(row.skaterFullName ?? ''),
        position: String(row.positionCode ?? ''),
        team: lastTeam(row.teamAbbrevs),
        gp: num(row.gamesPlayed),
        goals: num(row.goals),
        assists: num(row.assists),
        points: num(row.points),
        ppp: num(row.ppPoints),
        shots: num(row.shots),
        hits: extra?.hits ?? 0,
        blocks: extra?.blocks ?? 0,
        plusMinus: num(row.plusMinus),
        toiPerGame: num(row.timeOnIcePerGame),
      };
    });
}

export function mapGoalieRows(rows: any[]): GoalieLine[] {
  return rows
    .filter((row) => num(row.playerId) > 0)
    .map((row) => ({
      playerId: num(row.playerId),
      name: String(row.goalieFullName ?? ''),
      team: lastTeam(row.teamAbbrevs),
      gp: num(row.gamesPlayed),
      gs: num(row.gamesStarted),
      wins: num(row.wins),
      saves: num(row.saves),
      shotsAgainst: num(row.shotsAgainst),
      goalsAgainst: num(row.goalsAgainst),
      shutouts: num(row.shutouts),
      savePct: num(row.savePct),
      gaa: num(row.goalsAgainstAverage),
    }));
}

export async function fetchSkaterLines(query: StatsQuery): Promise<SkaterLine[]> {
  const summary = await fetchReport('skater/summary', query);
  if (summary.length === 0) return [];
  const ids = summary.map((row) => num(row.playerId)).filter((id) => id > 0);
  const realtime = await fetchReport('skater/realtime', { ...query, playerIds: ids, sortBy: undefined }).catch(() => []);
  return mapSkaterRows(summary, realtime);
}

export async function fetchGoalieLines(query: StatsQuery): Promise<GoalieLine[]> {
  const rows = await fetchReport('goalie/summary', { ...query, sortBy: query.sortBy ?? 'wins' });
  return mapGoalieRows(rows);
}

// ---------------------------------------------------------------------------
// Current team (handles off-season trades and signings)
// ---------------------------------------------------------------------------

export interface PlayerBio {
  playerId: number;
  name: string;
  team: string;
  position: string;
  sweaterNumber: number | null;
}

async function fetchTeamIdMap(): Promise<Map<number, string>> {
  const payload = await fetchJson<{ data?: Array<{ id?: number; triCode?: string }> }>(`${NHL_STATS_API}/team`, {
    ttlMs: 24 * HOUR,
    persist: true,
  });
  const map = new Map<number, string>();
  for (const row of payload.data ?? []) {
    if (row.id && row.triCode) map.set(Number(row.id), row.triCode.toUpperCase());
  }
  return map;
}

/** The `players` endpoint ignores `limit` and pages 5 rows at a time — only for stragglers. */
const PLAYERS_PAGE = 5;
const MAX_FALLBACK_PAGES = 12;

/** One season row per player, so a page of ids fits in one response. */
const BIOS_CHUNK = 90;

async function fetchBiosReport(report: 'skater/bios' | 'goalie/bios', ids: number[], seasonId: number): Promise<PlayerBio[]> {
  const pages = await Promise.all(
    chunk(ids, BIOS_CHUNK).map((group) =>
      fetchJson<{ data?: any[] }>(
        withQuery(`${NHL_STATS_API}/${report}`, {
          isAggregate: 'false',
          isGame: 'false',
          start: 0,
          limit: PAGE_SIZE,
          sort: JSON.stringify([{ property: 'playerId', direction: 'ASC' }]),
          cayenneExp: `playerId in (${group.join(',')}) and seasonId=${seasonId} and gameTypeId=2`,
        }),
        { ttlMs: 12 * HOUR, persist: true },
      ).catch(() => ({ data: [] })),
    ),
  );
  return pages.flatMap((page) => page.data ?? []).map((row) => ({
    playerId: num(row.playerId),
    name: String(row.skaterFullName ?? row.goalieFullName ?? ''),
    team: String(row.currentTeamAbbrev ?? '').toUpperCase(),
    position: report === 'goalie/bios' ? 'G' : String(row.positionCode ?? ''),
    sweaterNumber: null,
  }));
}

/**
 * Current team + position for many players (off-season trades and signings included).
 * Uses the bios reports (100 rows/page); anyone they miss — e.g. a rookie with no NHL
 * games — goes through the slow `players` endpoint, capped.
 */
export async function fetchPlayerBios(
  playerIds: number[],
  seasonId?: number,
  kind: 'skater' | 'goalie' = 'skater',
): Promise<Map<number, PlayerBio>> {
  const ids = [...new Set(playerIds.filter((id) => Number.isFinite(id) && id > 0))].sort((a, b) => a - b);
  const out = new Map<number, PlayerBio>();
  if (ids.length === 0) return out;

  if (seasonId) {
    const rows = await fetchBiosReport(kind === 'goalie' ? 'goalie/bios' : 'skater/bios', ids, seasonId);
    for (const bio of rows) {
      if (bio.playerId && bio.team && !out.has(bio.playerId)) out.set(bio.playerId, bio);
    }
  }

  const missing = ids.filter((id) => !out.has(id)).slice(0, PLAYERS_PAGE * MAX_FALLBACK_PAGES);
  if (missing.length === 0) return out;
  const teams = await fetchTeamIdMap();
  const pages = await Promise.all(
    chunk(missing, PLAYERS_PAGE).map((group) =>
      fetchJson<{ data?: any[] }>(
        withQuery(`${NHL_STATS_API}/players`, { cayenneExp: `id in (${group.join(',')})` }),
        { ttlMs: 12 * HOUR, persist: true },
      ).catch(() => ({ data: [] })),
    ),
  );
  for (const row of pages.flatMap((page) => page.data ?? [])) {
    const id = num(row.id);
    if (!id) continue;
    out.set(id, {
      playerId: id,
      name: String(row.fullName ?? `${row.firstName ?? ''} ${row.lastName ?? ''}`).trim(),
      team: teams.get(num(row.currentTeamId)) ?? '',
      position: String(row.positionCode ?? ''),
      sweaterNumber: row.sweaterNumber == null ? null : num(row.sweaterNumber),
    });
  }
  return out;
}
