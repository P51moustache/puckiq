/**
 * Per-game detail: official scratches (pre-game) and live/final box score lines.
 * Scratches are the only "Confirmed" lineup signal we use. The NHL does not publish
 * a starting goalie before puck drop, so we never claim one.
 */

import { fetchJson, HOUR, MINUTE } from './client';
import { NHL_WEB_API } from './schedule';

export interface GameLine {
  playerId: number;
  isGoalie: boolean;
  goals: number;
  assists: number;
  points: number;
  shots: number;
  hits: number;
  blocks: number;
  plusMinus: number;
  powerPlayGoals: number;
  pim: number;
  toi: string;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
}

interface RawSkater {
  playerId?: number;
  goals?: number;
  assists?: number;
  points?: number;
  sog?: number;
  hits?: number;
  blockedShots?: number;
  plusMinus?: number;
  powerPlayGoals?: number;
  pim?: number;
  toi?: string;
}

interface RawGoalie {
  playerId?: number;
  saves?: number;
  shotsAgainst?: number;
  goalsAgainst?: number;
  toi?: string;
  pim?: number;
}

interface RawTeamStats {
  forwards?: RawSkater[];
  defense?: RawSkater[];
  goalies?: RawGoalie[];
}

export function extractScratchIds(rightRail: any): Set<number> {
  const ids = new Set<number>();
  const away = rightRail?.gameInfo?.awayTeam?.scratches ?? [];
  const home = rightRail?.gameInfo?.homeTeam?.scratches ?? [];
  for (const row of [...away, ...home] as Array<{ id?: number }>) {
    const id = Number(row?.id);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return ids;
}

export async function fetchScratchIds(gameId: number, options: { force?: boolean } = {}): Promise<Set<number>> {
  try {
    const payload = await fetchJson<unknown>(`${NHL_WEB_API}/v1/gamecenter/${gameId}/right-rail`, {
      ttlMs: 2 * MINUTE,
      force: options.force,
    });
    return extractScratchIds(payload);
  } catch {
    return new Set();
  }
}

function toiSeconds(toi: string | undefined): number {
  if (!toi) return 0;
  const [m, s] = toi.split(':').map(Number);
  return (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
}

export function extractGameLines(boxscore: { playerByGameStats?: { homeTeam?: RawTeamStats; awayTeam?: RawTeamStats } }): Map<number, GameLine> {
  const lines = new Map<number, GameLine>();
  const teams = [boxscore?.playerByGameStats?.homeTeam, boxscore?.playerByGameStats?.awayTeam];
  for (const team of teams) {
    if (!team) continue;
    for (const skater of [...(team.forwards ?? []), ...(team.defense ?? [])]) {
      const id = Number(skater.playerId);
      if (!Number.isFinite(id)) continue;
      lines.set(id, {
        playerId: id,
        isGoalie: false,
        goals: skater.goals ?? 0,
        assists: skater.assists ?? 0,
        points: skater.points ?? (skater.goals ?? 0) + (skater.assists ?? 0),
        shots: skater.sog ?? 0,
        hits: skater.hits ?? 0,
        blocks: skater.blockedShots ?? 0,
        plusMinus: skater.plusMinus ?? 0,
        powerPlayGoals: skater.powerPlayGoals ?? 0,
        pim: skater.pim ?? 0,
        toi: skater.toi ?? '00:00',
        saves: 0,
        shotsAgainst: 0,
        goalsAgainst: 0,
      });
    }
    for (const goalie of team.goalies ?? []) {
      const id = Number(goalie.playerId);
      if (!Number.isFinite(id)) continue;
      // A dressed backup shows up with 00:00. Only a goalie who has played gets a line.
      if (toiSeconds(goalie.toi) === 0) continue;
      lines.set(id, {
        playerId: id,
        isGoalie: true,
        goals: 0,
        assists: 0,
        points: 0,
        shots: 0,
        hits: 0,
        blocks: 0,
        plusMinus: 0,
        powerPlayGoals: 0,
        pim: goalie.pim ?? 0,
        toi: goalie.toi ?? '00:00',
        saves: goalie.saves ?? 0,
        shotsAgainst: goalie.shotsAgainst ?? 0,
        goalsAgainst: goalie.goalsAgainst ?? 0,
      });
    }
  }
  return lines;
}

export async function fetchGameLines(
  gameId: number,
  options: { final: boolean; force?: boolean },
): Promise<Map<number, GameLine>> {
  try {
    const payload = await fetchJson<any>(`${NHL_WEB_API}/v1/gamecenter/${gameId}/boxscore`, {
      ttlMs: options.final ? 6 * HOUR : 1 * MINUTE,
      persist: options.final,
      force: options.force,
    });
    return extractGameLines(payload);
  } catch {
    return new Map();
  }
}
