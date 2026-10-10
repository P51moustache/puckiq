/**
 * Per-game detail: official scratches (pre-game) and live/final box score lines.
 * Scratches are the only "Confirmed" lineup signal we use. The NHL does not publish
 * a starting goalie before puck drop, so we never claim one. Once a game is under way
 * the box score flags who started in net, and at the end who got the decision.
 */

import { fetchJson, HOUR, MINUTE } from './client';
import { NHL_WEB_API } from './schedule';

/** A goalie's decision of record: win, loss, or overtime/shootout loss. */
export type GoalieDecision = 'W' | 'L' | 'O';

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
  /**
   * Power-play goals + assists, from the game summary (services/nhl/powerPlay.ts). Box scores carry
   * only the goals, so this is absent until the summary is merged in.
   */
  powerPlayPoints?: number;
  pim: number;
  toi: string;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  /** Goalies: started the game in net (box score `starter`). Absent for skaters and when the box score doesn't say. */
  starter?: boolean;
  /** Goalies: the decision of record once the game ends. Absent before then, for the other goalie, and for skaters. */
  decision?: GoalieDecision;
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
  starter?: boolean;
  decision?: string | null;
}

interface RawTeamStats {
  forwards?: RawSkater[];
  defense?: RawSkater[];
  goalies?: RawGoalie[];
}

interface RawBoxscore {
  homeTeam?: { abbrev?: string };
  awayTeam?: { abbrev?: string };
  playerByGameStats?: { homeTeam?: RawTeamStats; awayTeam?: RawTeamStats };
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

/** Box-score time on ice ("MM:SS") in seconds; 0 when missing or malformed. */
export function toiSeconds(toi: string | undefined): number {
  if (!toi) return 0;
  const [m, s] = toi.split(':').map(Number);
  return (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
}

const DECISIONS: readonly GoalieDecision[] = ['W', 'L', 'O'];

function decisionOf(raw: string | null | undefined): GoalieDecision | undefined {
  const value = typeof raw === 'string' ? raw.toUpperCase() : '';
  return DECISIONS.find((decision) => decision === value);
}

/** Only what the box score says: no key at all when it's silent, so lines without it stay unchanged. */
function goalieFlags(goalie: RawGoalie): Pick<GameLine, 'starter' | 'decision'> {
  const decision = decisionOf(goalie.decision);
  return {
    ...(typeof goalie.starter === 'boolean' ? { starter: goalie.starter } : {}),
    ...(decision ? { decision } : {}),
  };
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
        ...goalieFlags(goalie),
      });
    }
  }
  return lines;
}

/**
 * Each team's starting goalie (team abbrev → player id). A final box score flags him
 * (`starter`); a live one doesn't yet, so mid-game a team counts only when a single goalie
 * has played — him. A team that can't be told (a pull mid-game, no flags) is left out.
 */
export function extractStartingGoalies(boxscore: RawBoxscore): Map<string, number> {
  const starters = new Map<string, number>();
  for (const side of ['homeTeam', 'awayTeam'] as const) {
    const team = (boxscore?.[side]?.abbrev ?? '').toUpperCase();
    const goalies = boxscore?.playerByGameStats?.[side]?.goalies ?? [];
    const flagged = goalies.filter((goalie) => goalie.starter === true);
    const played = goalies.filter((goalie) => toiSeconds(goalie.toi) > 0);
    const starter = flagged.length > 0 ? flagged : played;
    const id = Number(starter[0]?.playerId);
    if (team && starter.length === 1 && Number.isFinite(id) && id > 0) starters.set(team, id);
  }
  return starters;
}

type BoxscoreOptions = { final: boolean; force?: boolean };

/** One cached box score request, whatever is read from it. A final one keeps for hours. */
function fetchBoxscore(gameId: number, options: BoxscoreOptions): Promise<RawBoxscore> {
  return fetchJson<RawBoxscore>(`${NHL_WEB_API}/v1/gamecenter/${gameId}/boxscore`, {
    ttlMs: options.final ? 6 * HOUR : 1 * MINUTE,
    persist: options.final,
    force: options.force,
  });
}

export async function fetchGameLines(gameId: number, options: BoxscoreOptions): Promise<Map<number, GameLine>> {
  try {
    return extractGameLines(await fetchBoxscore(gameId, options));
  } catch {
    return new Map();
  }
}

/** Fails soft to an empty map: unknown starters. */
export async function fetchStartingGoalies(gameId: number, options: BoxscoreOptions): Promise<Map<string, number>> {
  try {
    return extractStartingGoalies(await fetchBoxscore(gameId, options));
  } catch {
    return new Map();
  }
}
