/** Period-coherent regular-season player statistics. No unscoped rolling views. */
import { supabase } from '../lib/supabase';
import { aggregateSeasonRows, latestSeason, numberOrNull, scopedGames, seasonTotalsConflict, type StatRow } from '../utils/playerStats';
export type StatCategory = 'goals' | 'assists' | 'points' | 'shots';
export interface TrendingPlayer {
  season?: number;
  gameType?: number;
  asOf?: string;
  recentSampleSize?: number;
  recentAvailable?: boolean;
  seasonShots?: number | null;
  playerId: number;
  playerName: string;
  firstName: string;
  lastName: string;
  headshotUrl?: string;
  teamAbbrev: string;
  position: string;
  trendLabel: 'HOT' | 'WARM' | 'STEADY' | 'COOL' | 'COLD';
  hotColdScore: number;
  pointStreak: number;
  pointStreakIsMinimum?: boolean;
  recentPpg: number;
  seasonPpg: number;
  recentGpg: number;
  seasonGpg: number;
  recentShootingPct: number | null;
  seasonShootingPct: number | null;
  // Rolling stats
  avgGoals5g: number;
  avgAssists5g: number;
  avgPoints5g: number;
  avgShots5g: number;
  avgGoals10g: number;
  avgPoints10g: number;
  // Season totals
  gamesPlayed: number;
  seasonGoals: number;
  seasonAssists: number;
  seasonPoints: number;
  // Per-game shot averages (from skater_hot_cold)
  recentShotsPerGame: number;
  seasonShotsPerGame: number;
  // Pace projections (from skater_trend_summary)
  projectedGoals82?: number;
  projectedPoints82?: number;
  goalsPerGame?: number;
  pointsPerGame?: number;
  // Advanced stats (from skater_trend_summary)
  corsiPct5g?: number;
  seasonCorsiPct?: number;
  pdo5g?: number;
  seasonPdo?: number;
  // Extra rolling (from skater_rolling_stats)
  avgHits5g?: number;
  avgPlusMinus5g?: number;
  totalPoints5g?: number;
  totalPoints10g?: number;
  // Matchup (populated for tonight's players)
  matchup?: {
    opponent: string;
    gameTime: string;
    isHome: boolean;
    gameId: number;
  };
}
export interface TrendingGoalie {
  playerId: number;
  playerName: string;
  firstName: string;
  lastName: string;
  headshotUrl?: string;
  teamAbbrev: string;
  trendLabel: 'HOT' | 'WARM' | 'STEADY' | 'COOL' | 'COLD';
  // Rolling
  avgGa5g: number;
  savePct5g: number | null;
  wins5g: number;
  avgGa10g: number;
  savePct10g: number | null;
  wins10g: number;
  // Season
  starts: number;
  seasonSavePct: number | null;
  seasonAvgGa: number;
  seasonWins: number;
  seasonShutouts: number;
  // Season stats
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  goalsAgainstAvg: number;
  savePctg: number;
}
export interface HitRateResult {
  hit: number;
  total: number;
  rate: number;
  games: {
    gameId: number;
    value: number;
    exceeded: boolean;
    gameDate: string;
  }[];
}
export interface L10GameStat {
  gameId: number;
  gameDate: string;
  value: number;
}
export interface LeaderTrend {
  season?: number;
  gameType?: number;
  asOf?: string;
  recentSampleSize?: number;
  playerId: number;
  trendLabel: 'HOT' | 'WARM' | 'STEADY' | 'COOL' | 'COLD';
  hotColdScore: number;
  pointStreak: number;
  pointStreakIsMinimum?: boolean;
  recentPpg: number;
  seasonPpg: number;
  // Pace projections
  projectedGoals82: number;
  projectedAssists82: number;
  projectedPoints82: number;
  goalsPerGame: number;
  pointsPerGame: number;
}
const CACHE_TTL = 5 * 60 * 1000;
const trendCache = new Map<string, {
  data: any;
  timestamp: number;
}>();
function getCached<T>(key: string): T | null {
  const entry = trendCache.get(key);
  return entry && Date.now() - entry.timestamp < CACHE_TTL ? entry.data : null;
}
function setCache(key: string, data: any) { trendCache.set(key, { data, timestamp: Date.now() }); }
export function clearTrendsCache() { trendCache.clear(); }
const STAT_COLUMN_MAP: Record<StatCategory, string> = { goals: 'goals', assists: 'assists', points: 'points', shots: 'shots_on_goal' };
const DEFAULT_THRESHOLDS: Record<StatCategory, number> = { goals: 0.5, assists: 0.5, points: 0.5, shots: 2.5 };
/** Fetch all team splits before ranking. A partial page must not become league leaders. */
async function seasonRows(table = 'skater_season_stats'): Promise<{
  season: number;
  rows: StatRow[];
} | null> {
  const cached = getCached<{
    season: number;
    rows: StatRow[];
  }>(table);
  if (cached)
    return cached;
  const latest = await supabase.from(table).select('season').order('season', { ascending: false }).limit(1);
  if (latest.error)
    throw new Error(latest.error.message || 'Player season data unavailable');
  const season = latestSeason(latest.data ?? []);
  if (!season)
    return null;
  const rows: StatRow[] = [];
  for (let offset = 0;; offset += 1000) {
    const response = await supabase.from(table).select('*').eq('season', season).order('id').range(offset, offset + 999);
    if (response.error || !response.data)
      throw new Error(response.error?.message || 'Player season data unavailable');
    rows.push(...response.data);
    if (response.data.length < 1000)
      break;
  }
  const result = { season, rows: aggregateSeasonRows(rows, season) };
  setCache(table, result);
  return result;
}
async function recentRows(playerId: number, season: number, cutoff: string, count = 10): Promise<StatRow[]> {
  const key = `recent:${playerId}:${season}:${cutoff}:${count}`;
  const cached = getCached<StatRow[]>(key);
  if (cached)
    return cached;
  const response = await supabase.from('game_skater_stats')
    .select('*, games!inner(game_date, season, game_type, game_state, home_team_abbrev, away_team_abbrev)')
    .eq('player_id', playerId).eq('games.season', season).eq('games.game_type', 2)
    .lte('games.game_date', cutoff).in('games.game_state', ['OFF', 'FINAL'])
    .order('games(game_date)', { ascending: false }).order('game_id', { ascending: false }).limit(count);
  if (response.error)
    throw new Error(response.error.message || 'Recent player data unavailable');
  const rows = scopedGames(response.data ?? [], season, cutoff).slice(0, count);
  setCache(key, rows);
  return rows;
}
function makePlayer(row: StatRow, info: StatRow | undefined, recent: StatRow[]): TrendingPlayer {
  const gp = row.games_played;
  const complete = recent.length > 0 && recent.every(r => ['goals', 'assists', 'points', 'shots_on_goal'].every(k => numberOrNull(r[k]) !== null));
  const l5 = complete ? recent.slice(0, 5) : [];
  const avg = (key: string, games = l5) => games.length ? games.reduce((sum, r) => sum + Number(r[key]), 0) / games.length : 0;
  const seasonPpg = gp > 0 ? row.points / gp : 0;
  const recentPpg = avg('points');
  const score = complete && seasonPpg > 0 ? (recentPpg - seasonPpg) / seasonPpg : 0;
  const trendLabel = score >= .3 ? 'HOT' : score >= .1 ? 'WARM' : score <= -.3 ? 'COLD' : score <= -.1 ? 'COOL' : 'STEADY';
  const goals = l5.reduce((sum, r) => sum + r.goals, 0), shots = l5.reduce((sum, r) => sum + r.shots_on_goal, 0);
  let streak = 0;
  for (const r of recent) {
    if (numberOrNull(r.points) === null || r.points <= 0)
      break;
    streak++;
  }
  return {
    playerId: row.player_id, playerName: info ? `${info.first_name} ${info.last_name}` : `Player ${row.player_id}`,
    firstName: info?.first_name ?? '', lastName: info?.last_name ?? '', headshotUrl: info?.headshot_url ?? undefined,
    teamAbbrev: info?.current_team_abbrev ?? row.team_abbrev, position: row.position ?? info?.position ?? '',
    season: row.season, gameType: 2, asOf: row.updated_at ?? undefined, recentSampleSize: l5.length, recentAvailable: complete,
    trendLabel, hotColdScore: score, pointStreak: complete ? streak : 0, pointStreakIsMinimum: complete && streak === recent.length && streak < gp,
    recentPpg, seasonPpg, recentGpg: avg('goals'), seasonGpg: gp > 0 ? row.goals / gp : 0,
    recentShootingPct: complete && shots > 0 ? goals / shots * 100 : null, seasonShootingPct: row.shooting_pctg == null ? null : row.shooting_pctg * 100,
    avgGoals5g: avg('goals'), avgAssists5g: avg('assists'), avgPoints5g: recentPpg, avgShots5g: avg('shots_on_goal'),
    avgGoals10g: complete ? avg('goals', recent) : 0, avgPoints10g: complete ? avg('points', recent) : 0,
    gamesPlayed: gp, seasonGoals: row.goals, seasonAssists: row.assists, seasonPoints: row.points, seasonShots: row.shots,
    recentShotsPerGame: avg('shots_on_goal'), seasonShotsPerGame: gp > 0 && row.shots !== null ? row.shots / gp : 0,
    projectedGoals82: gp > 0 ? row.goals / gp * 82 : undefined, projectedPoints82: gp > 0 ? row.points / gp * 82 : undefined,
    goalsPerGame: gp > 0 ? row.goals / gp : undefined, pointsPerGame: gp > 0 ? row.points / gp : undefined,
  };
}
async function playersFromRows(rows: StatRow[], season: number, roster?: StatRow[]): Promise<TrendingPlayer[]> {
  if (!rows.length)
    return [];
  const response = roster ? { data: roster } : await supabase.from('players').select('id, first_name, last_name, headshot_url, current_team_abbrev, position').in('id', rows.map(r => r.player_id));
  if ('error' in response && response.error) throw new Error(response.error.message || 'Player roster unavailable');
  const names = new Map<number, StatRow>((response.data ?? []).map((r: StatRow) => [r.id, r]));
  const cutoff = new Date().toISOString().slice(0, 10);
  // Limit concurrency so a full league pool does not overwhelm the data API.
  const players: TrendingPlayer[] = [];
  for (let start = 0; start < rows.length; start += 10) {
    const batch = await Promise.all(rows.slice(start, start + 10).map(async (r) => {
      const recent = await recentRows(r.player_id, season, cutoff);
      if (seasonTotalsConflict(
        { gamesPlayed: r.games_played, goals: r.goals, assists: r.assists, points: r.points, shots: r.shots },
        recent.map(g => ({ goals: g.goals, assists: g.assists, points: g.points, shots: g.shots_on_goal })),
      )) return null;
      return makePlayer(r, names.get(r.player_id), recent);
    }));
    players.push(...batch.filter((player): player is TrendingPlayer => player !== null));
  }
  return players;
}
export async function getLeagueLeaders(statCategory: StatCategory, limit = 10): Promise<TrendingPlayer[]> {
  const key = `leaders:${statCategory}:${limit}`;
  const cached = getCached<TrendingPlayer[]>(key);
  if (cached)
    return cached;
  try {
    const dataset = await seasonRows();
    if (!dataset)
      return [];
    const selected = dataset.rows.filter(r => r.games_played > 0 && ['goals', 'assists', 'points', statCategory].every(k => numberOrNull(r[k]) !== null))
      .sort((a, b) => b[statCategory] - a[statCategory] || a.player_id - b.player_id).slice(0, limit);
    const players = await playersFromRows(selected, dataset.season);
    setCache(key, players);
    return players;
  }
  catch {
    return [];
  }
}
export async function getLeagueLeadersStrict(statCategory: StatCategory, limit = 10): Promise<TrendingPlayer[]> {
  const dataset = await seasonRows();
  if (!dataset) return [];
  const selected = dataset.rows.filter(r => r.games_played > 0 && ['goals', 'assists', 'points', statCategory].every(k => numberOrNull(r[k]) !== null))
    .sort((a, b) => b[statCategory] - a[statCategory] || a.player_id - b.player_id).slice(0, limit);
  return playersFromRows(selected, dataset.season);
}
let pendingTrendPool: Promise<TrendingPlayer[]> | null = null;
async function loadTrendPool(): Promise<TrendingPlayer[]> {
  const cached = getCached<TrendingPlayer[]>('trend-pool');
  if (cached)
    return cached;
  if (pendingTrendPool)
    return pendingTrendPool;
  pendingTrendPool = (async () => {
    const dataset = await seasonRows();
    if (!dataset)
      return [];
    const rows = dataset.rows.filter(r => r.games_played > 15 && r.points >= 20 && r.goals != null && r.assists != null && r.shots != null);
    const players = await playersFromRows(rows, dataset.season);
    setCache('trend-pool', players);
    return players;
  })();
  try {
    return await pendingTrendPool;
  }
  finally {
    pendingTrendPool = null;
  }
}
export async function getTrendingPlayers(direction: 'up' | 'down', limit = 10): Promise<TrendingPlayer[]> {
  try {
    const players = await loadTrendPool();
    return players.filter(p => p.recentAvailable && p.recentSampleSize === 5 && (direction === 'up' ? ['HOT', 'WARM'] : ['COLD', 'COOL']).includes(p.trendLabel))
      .sort((a, b) => direction === 'up' ? b.hotColdScore - a.hotColdScore : a.hotColdScore - b.hotColdScore).slice(0, limit);
  }
  catch {
    return [];
  }
}
export async function getTrendingPlayersStrict(direction: 'up' | 'down', limit = 10): Promise<TrendingPlayer[]> {
  const players = await loadTrendPool();
  return players.filter(p => p.recentAvailable && p.recentSampleSize === 5 && (direction === 'up' ? ['HOT', 'WARM'] : ['COLD', 'COOL']).includes(p.trendLabel))
    .sort((a, b) => direction === 'up' ? b.hotColdScore - a.hotColdScore : a.hotColdScore - b.hotColdScore).slice(0, limit);
}
export async function getLeaderTrends(playerIds: number[]): Promise<Map<number, LeaderTrend>> {
  const result = new Map<number, LeaderTrend>();
  if (!playerIds.length)
    return result;
  try {
    const dataset = await seasonRows();
    if (!dataset)
      return result;
    const players = await playersFromRows(dataset.rows.filter(r => playerIds.includes(r.player_id) && r.games_played > 0 && r.points != null && r.goals != null && r.assists != null), dataset.season);
    for (const p of players) {
      if (!p.recentAvailable)
        continue;
      result.set(p.playerId, { playerId: p.playerId, season: p.season, gameType: 2, asOf: p.asOf, recentSampleSize: p.recentSampleSize,
        trendLabel: p.trendLabel, hotColdScore: p.hotColdScore, pointStreak: p.pointStreak, pointStreakIsMinimum: p.pointStreakIsMinimum, recentPpg: p.recentPpg, seasonPpg: p.seasonPpg,
        projectedGoals82: p.seasonGoals / p.gamesPlayed * 82, projectedAssists82: p.seasonAssists / p.gamesPlayed * 82, projectedPoints82: p.seasonPoints / p.gamesPlayed * 82,
        goalsPerGame: p.seasonGoals / p.gamesPlayed, pointsPerGame: p.seasonPoints / p.gamesPlayed });
    }
  }
  catch { /* no verified trend */ }
  return result;
}
async function loadPlayersPlayingTonight(limit = 20): Promise<TrendingPlayer[]> {
    const today = new Date().toISOString().slice(0, 10);
    const games = await supabase.from('games').select('id, season, game_type, home_team_abbrev, away_team_abbrev, start_time_utc').eq('game_date', today).in('game_state', ['FUT', 'PRE', 'LIVE', 'CRIT']);
    const dataset = await seasonRows();
    if (games.error) throw new Error(games.error.message || 'Tonight schedule unavailable');
    if (!dataset) return [];
    const currentGames = (games.data ?? []).filter(g => g.season === dataset.season && g.game_type === 2);
    if (!currentGames.length) return [];
    const teams = new Set(currentGames.flatMap(g => [g.home_team_abbrev, g.away_team_abbrev]));
    const roster = await supabase.from('players').select('id, first_name, last_name, headshot_url, current_team_abbrev, position').in('current_team_abbrev', [...teams]);
    if (roster.error) throw new Error(roster.error.message || 'Tonight roster unavailable');
    const activeRoster = (roster.data ?? []).filter(r => teams.has(r.current_team_abbrev));
    const eligibleIds = new Set(activeRoster.map(r => r.id));
    const players = await playersFromRows(dataset.rows.filter(r => r.games_played > 0 && r.points != null && r.goals != null && r.assists != null && eligibleIds.has(r.player_id)), dataset.season, activeRoster);
    return players.filter(p => p.recentAvailable).flatMap(p => {
      const g = currentGames.find(g => g.home_team_abbrev === p.teamAbbrev || g.away_team_abbrev === p.teamAbbrev);
      if (!g)
        return [];
      return [{ ...p, matchup: { opponent: g.home_team_abbrev === p.teamAbbrev ? g.away_team_abbrev : g.home_team_abbrev, isHome: g.home_team_abbrev === p.teamAbbrev, gameTime: g.start_time_utc, gameId: g.id } }];
    }).sort((a, b) => b.hotColdScore - a.hotColdScore).slice(0, limit);
}
export function getPlayersPlayingTonightStrict(limit = 20): Promise<TrendingPlayer[]> { return loadPlayersPlayingTonight(limit); }
export async function getPlayersPlayingTonight(limit = 20): Promise<TrendingPlayer[]> {
  try { return await loadPlayersPlayingTonight(limit); } catch { return []; }
}
/** Goalie rolling views do not expose season/type; suppress until a scoped source is available. */
export async function getTrendingGoalies(_direction: 'up' | 'down', _limit = 5): Promise<TrendingGoalie[]> { return []; }
export async function getPlayerL10GameStats(playerId: number, statCategory: StatCategory): Promise<L10GameStat[]> {
  try {
    const dataset = await seasonRows();
    if (!dataset)
      return [];
    const column = STAT_COLUMN_MAP[statCategory];
    if (!column)
      return [];
    const rows = await recentRows(playerId, dataset.season, new Date().toISOString().slice(0, 10));
    return rows.filter(r => numberOrNull(r[column]) !== null).map(r => ({ gameId: r.game_id, gameDate: r.games.game_date, value: Number(r[column]) })).reverse();
  }
  catch {
    return [];
  }
}
export async function getPlayerHitRate(playerId: number, statCategory: StatCategory, threshold?: number, lastNGames = 10): Promise<HitRateResult> {
  try {
    const dataset = await seasonRows();
    if (!dataset)
      return { hit: 0, total: 0, rate: 0, games: [] };
    const column = STAT_COLUMN_MAP[statCategory];
    if (!column)
      return { hit: 0, total: 0, rate: 0, games: [] };
    const rows = await recentRows(playerId, dataset.season, new Date().toISOString().slice(0, 10), lastNGames);
    const games = rows.filter(r => numberOrNull(r[column]) !== null).map(r => ({ gameId: r.game_id, gameDate: r.games.game_date, value: Number(r[column]), exceeded: Number(r[column]) > (threshold ?? DEFAULT_THRESHOLDS[statCategory]) }));
    const hit = games.filter(g => g.exceeded).length;
    return { hit, total: games.length, rate: games.length ? hit / games.length : 0, games };
  }
  catch {
    return { hit: 0, total: 0, rate: 0, games: [] };
  }
}
export async function batchGetHitRates(playerIds: number[], statCategory: StatCategory, threshold?: number): Promise<Map<number, HitRateResult>> {
  return new Map(await Promise.all(playerIds.map(async (id) => [id, await getPlayerHitRate(id, statCategory, threshold)] as const)));
}
export type ProjectionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type ProjectionDirection = 'OVER' | 'UNDER';
export interface StatProjection {
  stat: StatCategory;
  projected: number;
  seasonAvg: number;
  direction: ProjectionDirection;
  /** Difference between projected and season avg, as a percentage */
  diffPct: number;
}
export interface PlayerProjection {
  playerId: number;
  playerName: string;
  firstName: string;
  lastName: string;
  headshotUrl?: string;
  teamAbbrev: string;
  position: string;
  trendLabel: TrendingPlayer['trendLabel'];
  confidence: ProjectionConfidence;
  matchup: {
    opponent: string;
    gameTime: string;
    isHome: boolean;
    gameId: number;
  };
  projections: StatProjection[];
  pointStreak: number;
  pointStreakIsMinimum?: boolean;
  hotColdScore: number;
}
/**
* Get player projections for tonight's games.
* Calculates simple projections: base = season per-game avg,
* adjustment = recent form weight (L5 rolling avg vs season).
* Confidence = based on L5 consistency (low variance = HIGH).
*/
export async function getPlayerProjections(limit: number = 15): Promise<PlayerProjection[]> {
  const cacheKey = `projections:${limit}`;
  const cached = getCached<PlayerProjection[]>(cacheKey);
  if (cached)
    return cached;
  try {
    // 1. Get tonight's trending players (already has matchup info)
    const tonightPlayers = await getPlayersPlayingTonight(limit * 2);
    if (tonightPlayers.length === 0)
      return [];
    // 2. For each player, calculate projections across all stat categories
    const projections: PlayerProjection[] = [];
    for (const player of tonightPlayers.slice(0, limit)) {
      if (!player.matchup)
        continue;
      const statProjections: StatProjection[] = [];
      // Calculate projections for goals, assists, points, shots
      const categories: StatCategory[] = ['goals', 'assists', 'points', 'shots'];
      for (const stat of categories) {
        const { recent, season } = getPlayerStatAverages(player, stat);
        if (season === 0)
          continue;
        // Projected = weighted average: 60% recent form, 40% season
        const projected = recent * 0.6 + season * 0.4;
        const direction: ProjectionDirection = projected >= season ? 'OVER' : 'UNDER';
        const diffPct = season > 0 ? ((projected - season) / season) * 100 : 0;
        statProjections.push({
          stat,
          projected: Math.round(projected * 100) / 100,
          seasonAvg: Math.round(season * 100) / 100,
          direction,
          diffPct: Math.round(diffPct),
        });
      }
      // Calculate confidence based on form consistency
      const confidence = calculateConfidence(player);
      projections.push({
        playerId: player.playerId,
        playerName: player.playerName,
        firstName: player.firstName,
        lastName: player.lastName,
        headshotUrl: player.headshotUrl,
        teamAbbrev: player.teamAbbrev,
        position: player.position,
        trendLabel: player.trendLabel,
        confidence,
        matchup: player.matchup,
        projections: statProjections,
        pointStreak: player.pointStreak,
        pointStreakIsMinimum: player.pointStreakIsMinimum,
        hotColdScore: player.hotColdScore,
      });
    }
    // Sort by confidence (HIGH first), then by hotColdScore
    const CONFIDENCE_ORDER: Record<ProjectionConfidence, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    projections.sort((a, b) => {
      const confDiff = CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence];
      if (confDiff !== 0)
        return confDiff;
      return b.hotColdScore - a.hotColdScore;
    });
    setCache(cacheKey, projections);
    console.log(`[PLAYER TRENDS] Generated ${projections.length} projections for tonight`);
    return projections;
  }
  catch (err) {
    console.error('[PLAYER TRENDS] Error generating projections:', err);
    return [];
  }
}
function getPlayerStatAverages(player: TrendingPlayer, stat: StatCategory): {
  recent: number;
  season: number;
} {
  const gp = player.gamesPlayed || 1;
  switch (stat) {
    case 'goals':
      return { recent: player.avgGoals5g, season: player.seasonGoals / gp };
    case 'assists':
      return { recent: player.avgAssists5g, season: player.seasonAssists / gp };
    case 'points':
      return { recent: player.avgPoints5g, season: player.seasonPoints / gp };
    case 'shots':
      return { recent: player.recentShotsPerGame, season: player.seasonShotsPerGame };
    default:
      return { recent: 0, season: 0 };
  }
}
function calculateConfidence(player: TrendingPlayer): ProjectionConfidence {
  // High confidence: consistent recent performance aligned with season
  // Use ratio of recent PPG to season PPG as a consistency proxy
  const recentPpg = player.recentPpg;
  const seasonPpg = player.seasonPpg;
  if (seasonPpg === 0)
    return 'LOW';
  const ratio = recentPpg / seasonPpg;
  const hasStreak = player.pointStreak >= 3;
  const isHot = player.trendLabel === 'HOT' || player.trendLabel === 'WARM';
  // HIGH: performing near or above season average with streak
  if (ratio >= 0.85 && ratio <= 1.5 && hasStreak && isHot)
    return 'HIGH';
  // MEDIUM: performing near season average
  if (ratio >= 0.7 && ratio <= 1.8)
    return 'MEDIUM';
  // LOW: volatile or cold
  return 'LOW';
}
/** Visible for testing */
export const _internals = {
  trendCache,
  CACHE_TTL,
  STAT_COLUMN_MAP,
  DEFAULT_THRESHOLDS,
  makePlayer,
  getPlayerStatAverages,
  calculateConfidence,
};
