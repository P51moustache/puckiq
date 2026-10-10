/**
 * Power-play points for one game. Box scores carry power-play goals but not power-play assists;
 * the game summary (`landing`) lists each goal's strength with its assists, which completes PPP —
 * so live points match a host app that scores power-play points.
 */

import { fetchJson, HOUR, MINUTE } from './client';
import { fetchGameLines, type GameLine } from './gamecenter';
import { NHL_WEB_API } from './schedule';

interface RawGoal {
  strength?: string;
  playerId?: number;
  assists?: { playerId?: number }[];
}

export interface RawGameSummary {
  summary?: { scoring?: { goals?: RawGoal[] }[] };
}

/** Power-play goals and assists per player from a game summary. */
export function extractPowerPlayPoints(landing: RawGameSummary | null | undefined): Map<number, number> {
  const points = new Map<number, number>();
  const credit = (raw: unknown) => {
    const id = Number(raw);
    if (Number.isSafeInteger(id) && id > 0) points.set(id, (points.get(id) ?? 0) + 1);
  };
  for (const period of landing?.summary?.scoring ?? []) {
    for (const goal of period.goals ?? []) {
      if (goal.strength !== 'pp') continue;
      credit(goal.playerId);
      for (const assist of goal.assists ?? []) credit(assist.playerId);
    }
  }
  return points;
}

/** Null when the summary can't be read, so callers keep counting power-play goals only. */
export async function fetchPowerPlayPoints(
  gameId: number,
  options: { final: boolean; force?: boolean },
): Promise<Map<number, number> | null> {
  try {
    const payload = await fetchJson<RawGameSummary>(`${NHL_WEB_API}/v1/gamecenter/${gameId}/landing`, {
      ttlMs: options.final ? 6 * HOUR : 1 * MINUTE,
      persist: options.final,
      force: options.force,
    });
    return extractPowerPlayPoints(payload);
  } catch {
    return null;
  }
}

/**
 * Box-score lines with each skater's power-play points filled in. A summary that lags the box
 * score never takes a power-play goal away.
 */
export function withPowerPlayPoints(lines: Map<number, GameLine>, points: Map<number, number>): Map<number, GameLine> {
  const out = new Map<number, GameLine>();
  for (const [id, line] of lines) {
    out.set(id, line.isGoalie ? line : { ...line, powerPlayPoints: Math.max(points.get(id) ?? 0, line.powerPlayGoals) });
  }
  return out;
}

/**
 * A game's lines for fantasy scoring: the box score plus power-play assists from the summary.
 * Without the summary the lines count power-play goals only, as before.
 */
export async function fetchScoringLines(
  gameId: number,
  options: { final: boolean; force?: boolean },
): Promise<Map<number, GameLine>> {
  const [lines, points] = await Promise.all([fetchGameLines(gameId, options), fetchPowerPlayPoints(gameId, options)]);
  return points ? withPowerPlayPoints(lines, points) : lines;
}
