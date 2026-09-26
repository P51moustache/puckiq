/**
 * NHL Edge tracking data (public api-web endpoints): skating speed, bursts, distance,
 * shot speed and zone time for skaters; save % by danger and quality starts for goalies.
 * Edge only exists once a season has regular-season games, so early on we fall back to
 * last season (the endpoint 404s until then).
 */

import { fetchJson, HOUR, NhlFetchError } from './client';
import { previousSeasonId } from './dates';
import { NHL_WEB_API } from './schedule';

export interface EdgeMetric {
  key: string;
  label: string;
  /** Display value without the unit, e.g. "24.6" or ".912". */
  value: string;
  unit?: string;
  /** League percentile 0..1, higher is better. Null when the NHL doesn't rank it. */
  percentile: number | null;
  /** League average, formatted like `value`. */
  leagueAvg?: string;
}

export interface EdgeProfile {
  playerId: number;
  seasonId: number;
  isGoalie: boolean;
  /** First metric is the headline one (free users see only this). */
  metrics: EdgeMetric[];
}

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function pct(value: unknown): number | null {
  const n = num(value);
  return n === null ? null : Math.max(0, Math.min(1, n));
}

/** ".912" — goalie save-percentage style. */
function savePct(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}

function share(value: number): string {
  return (value * 100).toFixed(1);
}

function metric(
  key: string,
  label: string,
  raw: number | null,
  format: (value: number) => string,
  percentile: unknown,
  avg: number | null,
  unit?: string,
): EdgeMetric | null {
  if (raw === null) return null;
  return {
    key,
    label,
    value: format(raw),
    unit,
    percentile: pct(percentile),
    leagueAvg: avg === null ? undefined : format(avg),
  };
}

export function mapSkaterEdge(payload: any, playerId: number, seasonId: number): EdgeProfile | null {
  if (!payload || typeof payload !== 'object') return null;
  const speed = payload.skatingSpeed ?? {};
  const shot = payload.topShotSpeed ?? {};
  const distance = payload.totalDistanceSkated ?? {};
  const zone = payload.zoneTimeDetails ?? {};
  const high = Array.isArray(payload.sogSummary)
    ? payload.sogSummary.find((row: any) => row?.locationCode === 'high')
    : null;

  const metrics = [
    metric('topSpeed', 'Top speed', num(speed.speedMax?.imperial), (v) => v.toFixed(1), speed.speedMax?.percentile, num(speed.speedMax?.leagueAvg?.imperial), 'mph'),
    metric('bursts', '20+ mph bursts', num(speed.burstsOver20?.value), (v) => String(Math.round(v)), speed.burstsOver20?.percentile, num(speed.burstsOver20?.leagueAvg?.value)),
    metric('shotSpeed', 'Hardest shot', num(shot.imperial), (v) => v.toFixed(1), shot.percentile, num(shot.leagueAvg?.imperial), 'mph'),
    metric('highDanger', 'High-danger shots', num(high?.shots), (v) => String(Math.round(v)), high?.shotsPercentile, num(high?.shotsLeagueAvg)),
    metric('ozTime', 'Offensive-zone time', num(zone.offensiveZonePctg), share, zone.offensiveZonePercentile, num(zone.offensiveZoneLeagueAvg), '%'),
    metric('distance', 'Distance skated', num(distance.imperial), (v) => v.toFixed(0), distance.percentile, num(distance.leagueAvg?.imperial), 'mi'),
  ].filter((row): row is EdgeMetric => row !== null);

  return metrics.length > 0 ? { playerId, seasonId, isGoalie: false, metrics } : null;
}

export function mapGoalieEdge(payload: any, playerId: number, seasonId: number): EdgeProfile | null {
  if (!payload || typeof payload !== 'object') return null;
  const stats = payload.stats ?? {};
  const rows = Array.isArray(payload.shotLocationSummary) ? payload.shotLocationSummary : [];
  const all = rows.find((row: any) => row?.locationCode === 'all');
  const high = rows.find((row: any) => row?.locationCode === 'high');

  const metrics = [
    metric('savePct', 'Save %', num(all?.savePctg), savePct, all?.savePctgPercentile, num(all?.savePctgLeagueAvg)),
    metric('highSavePct', 'High-danger save %', num(high?.savePctg), savePct, high?.savePctgPercentile, num(high?.savePctgLeagueAvg)),
    metric('gaa', 'Goals against avg', num(stats.goalsAgainstAvg?.value), (v) => v.toFixed(2), stats.goalsAgainstAvg?.percentile, num(stats.goalsAgainstAvg?.leagueAvg)),
    metric('above900', 'Starts above .900', num(stats.gamesAbove900?.value), share, stats.gamesAbove900?.percentile, num(stats.gamesAbove900?.leagueAvg), '%'),
    metric('goalSupport', 'Goal support', num(stats.goalSupportAvg?.value), (v) => v.toFixed(2), stats.goalSupportAvg?.percentile, num(stats.goalSupportAvg?.leagueAvg), 'GF/gm'),
  ].filter((row): row is EdgeMetric => row !== null);

  return metrics.length > 0 ? { playerId, seasonId, isGoalie: true, metrics } : null;
}

async function fetchSeason(playerId: number, isGoalie: boolean, seasonId: number, force?: boolean): Promise<EdgeProfile | null> {
  const kind = isGoalie ? 'goalie-detail' : 'skater-detail';
  const payload = await fetchJson<any>(`${NHL_WEB_API}/v1/edge/${kind}/${playerId}/${seasonId}/2`, {
    ttlMs: 12 * HOUR,
    persist: true,
    force,
  });
  return isGoalie ? mapGoalieEdge(payload, playerId, seasonId) : mapSkaterEdge(payload, playerId, seasonId);
}

const isMissing = (error: unknown) => error instanceof NhlFetchError && error.status === 404;

/**
 * Edge for this season, or last season when this one has no tracking yet (or the
 * player hasn't played). Null when the NHL has nothing for him at all.
 */
export async function fetchPlayerEdge(
  playerId: number,
  isGoalie: boolean,
  seasonId: number,
  options: { force?: boolean } = {},
): Promise<EdgeProfile | null> {
  try {
    const current = await fetchSeason(playerId, isGoalie, seasonId, options.force);
    if (current) return current;
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  try {
    return await fetchSeason(playerId, isGoalie, previousSeasonId(seasonId), options.force);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** "99th", "1st", "22nd" — capped at 99th so the leader doesn't read "100th". */
export function percentileLabel(percentile: number): string {
  const n = Math.max(1, Math.min(99, Math.round(percentile * 100)));
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/** F1 timing colours: purple = elite, green = above average, amber = below. */
export type EdgeTier = 'elite' | 'good' | 'below';

export function edgeTier(percentile: number): EdgeTier {
  // Tier on the same rounded number the label shows, so "90th" is always purple.
  const shown = Math.round(percentile * 100);
  if (shown >= 90) return 'elite';
  if (shown >= 50) return 'good';
  return 'below';
}
