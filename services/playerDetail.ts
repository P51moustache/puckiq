/**
 * Player detail service — fetches comprehensive player data from multiple
 * Supabase tables and views: players, skater/goalie season stats,
 * player_career_data, edge_skater_stats, game_skater_stats (last 5 games),
 * and trend views (hot/cold, pace projections, rolling stats, advanced trends,
 * goalie rolling stats, three star counts).
 *
 * Gracefully handles missing data (career, edge, recent games, trends) by
 * returning null for those sections. Only returns null for the entire result
 * if the player itself does not exist in the players table.
 *
 * 5-minute in-memory cache per player.
 */

import { supabase } from '../lib/supabase';
import { aggregateSeasonRows, latestSeason, normalizeCareerTotals, numberOrNull, scopedGames, seasonTotalsConflict } from '../utils/playerStats';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayerBio {
  playerId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string;
  teamAbbrev: string;
  sweaterNumber?: number;
  headshotUrl?: string;
  shootsCatches?: string;
  heightInches?: number;
  weightPounds?: number;
  birthDate?: string;
  birthCity?: string;
  birthCountry?: string;
  draftYear?: number;
  draftRound?: number;
  draftPick?: number;
  draftOverall?: number;
}

export interface SkaterSeasonStats {
  gamesPlayed: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  plusMinus: number | null;
  pim: number | null;
  powerPlayGoals: number | null;
  shorthandedGoals: number | null;
  gameWinningGoals: number | null;
  shots: number | null;
  shootingPctg: number | null;
  avgToi: number | null;
  faceoffWinPctg: number | null;
}

export interface GoalieSeasonStats {
  gamesPlayed: number | null;
  gamesStarted: number | null;
  wins: number | null;
  losses: number | null;
  otLosses: number | null;
  goalsAgainstAvg: number | null;
  savePctg: number | null;
  shotsAgainst: number | null;
  saves: number | null;
  shutouts: number | null;
}

export interface PlayerCareer {
  seasonTotals: any[];
  careerTotals: Record<string, number>;
  awards: any[];
}

export interface PlayerEdgeStats {
  topSpeed?: number;
  topSpeedRank?: number;
  topSpeedPercentile?: number;
  topShotSpeed?: number;
  topShotSpeedRank?: number;
  topShotSpeedPercentile?: number;
  totalDistance?: number;
  burstsOver20?: number;
  offensiveZonePctg?: number;
  neutralZonePctg?: number;
  defensiveZonePctg?: number;
}

export interface RecentGame {
  gameDate?: string;
  opponent?: string;
  gameId: number;
  goals: number | null;
  assists: number | null;
  points: number | null;
  plusMinus: number | null;
  toi?: string;
  shots?: number | null;
  hits?: number | null;
  blockedShots?: number | null;
  // Goalie-specific
  saves?: number | null;
  goalsAgainst?: number | null;
  decision?: string;
}

export interface HotColdData {
  gamesPlayed: number;
  seasonPpg: number;
  recentPpg: number;
  seasonGpg: number;
  recentGpg: number;
  pointStreak: number;
  hotColdScore: number;
  trendLabel: 'HOT' | 'WARM' | 'STEADY' | 'COOL' | 'COLD';
  recentShootingPct: number;
  seasonShootingPct: number;
}

export interface PaceProjections {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  projectedGoals82: number;
  projectedAssists82: number;
  projectedPoints82: number;
  projectedShots82: number;
  projectedPpg82: number;
  goalsPerGame: number;
  pointsPerGame: number;
  shootingPctg: number;
}

export interface RollingStats {
  avgGoals5g: number;
  avgAssists5g: number;
  avgPoints5g: number;
  avgShots5g: number;
  avgHits5g: number;
  avgPm5g: number;
  totalGoals5g: number;
  totalPoints5g: number;
  avgGoals10g: number;
  avgAssists10g: number;
  avgPoints10g: number;
  avgShots10g: number;
  avgGoals20g: number;
  avgPoints20g: number;
  seasonAvgGoals: number;
  seasonAvgPoints: number;
  lastGameDate?: string;
}

export interface AdvancedTrends {
  avgCorsiPct5g?: number;
  avgFenwickPct5g?: number;
  avgOzStart5g?: number;
  avgPdo5g?: number;
  avgCorsiPct10g?: number;
  avgFenwickPct10g?: number;
  avgPdo10g?: number;
  seasonCorsiPct?: number;
  seasonFenwickPct?: number;
  seasonPdo?: number;
  gamesWithAdvanced: number;
}

export interface GoalieTrends {
  avgGa5g: number;
  savePct5g?: number;
  wins5g: number;
  avgGa10g: number;
  savePct10g?: number;
  wins10g: number;
  starts: number;
  seasonSavePct?: number;
  seasonAvgGa: number;
  seasonWins: number;
  seasonShutouts: number;
  lastStartDate?: string;
}

export interface SkaterTrends {
  hotCold: HotColdData | null;
  pace: PaceProjections | null;
  rolling: RollingStats | null;
  advanced: AdvancedTrends | null;
  threeStarCount: number;
}

export interface PlayerDetail {
  seasonStatsIssue?: 'conflicting_game_records';
  season?: number;
  gameType?: number;
  asOf?: string;
  recentSampleSize?: number;
  bio: PlayerBio;
  seasonStats: any; // SkaterSeasonStats | GoalieSeasonStats depending on position
  career: PlayerCareer | null;
  edgeStats: PlayerEdgeStats | null;
  recentGames: RecentGame[];
  trends: SkaterTrends | GoalieTrends | null;
}

// ---------------------------------------------------------------------------
// Cache (5-min TTL)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000;
const detailCache = new Map<number, CacheEntry<PlayerDetail>>();

function isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < CACHE_TTL;
}

/** Clear cache (useful for testing). */
export function clearDetailCache(): void {
  detailCache.clear();
}

// ---------------------------------------------------------------------------
// getPlayerDetail
// ---------------------------------------------------------------------------

export async function getPlayerDetail(playerId: number): Promise<PlayerDetail | null> {
  const cached = detailCache.get(playerId);
  if (isCacheValid(cached)) return cached.data;

  try {
    // 1. Fetch player bio (required — null if not found)
    const { data: playerRow, error: playerErr } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (playerErr || !playerRow) {
      console.warn(`[PLAYER DETAIL] Player ${playerId} not found:`, playerErr?.message);
      return null;
    }

    const bio = mapBio(playerRow);
    const isGoalie = bio.position === 'G';

    // Season rows are club-stats regular-season totals; the schema has no game_type.
    const seasonStats = await fetchSeasonStats(playerId, isGoalie);
    const season = (seasonStats as any)?.season as number | undefined;
    const cutoff = new Date().toISOString().slice(0, 10);
    const [career, edgeStats, recentGames] = await Promise.all([
      fetchCareerData(playerId),
      !isGoalie && season ? fetchEdgeStats(playerId, season) : Promise.resolve(null),
      season ? fetchRecentGames(playerId, isGoalie, season, cutoff) : Promise.resolve([]),
    ]);
    const inconsistentTotals = seasonStats !== null && seasonTotalsConflict(seasonStats, recentGames);
    const detail: PlayerDetail = {
      bio, seasonStats: inconsistentTotals ? null : seasonStats, career, edgeStats, recentGames,
      seasonStatsIssue: inconsistentTotals ? 'conflicting_game_records' : undefined,
      // Existing rolling/advanced views do not expose a trustworthy period.
      trends: null,
      season, gameType: season ? 2 : undefined,
      asOf: (seasonStats as any)?.asOf,
      recentSampleSize: recentGames.length,
    };

    detailCache.set(playerId, { data: detail, timestamp: Date.now() });
    console.log(`[PLAYER DETAIL] Loaded detail for ${bio.fullName} (${bio.position})`);
    return detail;
  } catch (err) {
    console.error(`[PLAYER DETAIL] Error fetching detail for ${playerId}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sub-fetchers
// ---------------------------------------------------------------------------

async function fetchSeasonStats(
  playerId: number,
  isGoalie: boolean,
): Promise<SkaterSeasonStats | GoalieSeasonStats | null> {
  try {
    const { data, error } = await supabase.from(isGoalie ? 'goalie_season_stats' : 'skater_season_stats')
      .select('*').eq('player_id', playerId).order('season', { ascending: false });
    if (error || !data) return null;
    const season = latestSeason(data);
    if (!season) return null;
    const row = aggregateSeasonRows(data, season)[0];
    if (!row) return null;
    const fields = isGoalie ? {
      gamesPlayed:'games_played', gamesStarted:'games_started', wins:'wins', losses:'losses',
      otLosses:'ot_losses', shotsAgainst:'shots_against', saves:'saves', shutouts:'shutouts',
    } : {
      gamesPlayed:'games_played', goals:'goals', assists:'assists', points:'points', plusMinus:'plus_minus',
      pim:'pim', powerPlayGoals:'power_play_goals', shorthandedGoals:'shorthanded_goals', gameWinningGoals:'game_winning_goals',
      shots:'shots', shootingPctg:'shooting_pctg', avgToi:'avg_toi_per_game', faceoffWinPctg:'faceoff_win_pctg',
    };
    const stats: any = Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, numberOrNull(row[column!])]));
    if (isGoalie) {
      stats.savePctg = numberOrNull(row.save_pctg) ?? (row.saves != null && row.shots_against > 0 ? row.saves / row.shots_against : null);
      stats.goalsAgainstAvg = numberOrNull(row.goals_against_avg) ?? (row.goals_against != null && row.toi_seconds > 0 ? row.goals_against * 3600 / row.toi_seconds : null);
    }
    return { ...stats, season, asOf: row.updated_at ?? undefined };
  } catch {
    return null;
  }
}

async function fetchCareerData(playerId: number): Promise<PlayerCareer | null> {
  try {
    const { data: row, error } = await supabase
      .from('player_career_data')
      .select('*')
      .eq('player_id', playerId)
      .single();

    if (error || !row) return null;

    return {
      seasonTotals: Array.isArray(row.season_totals) ? row.season_totals : [],
      careerTotals: normalizeCareerTotals(row.career_totals),
      awards: Array.isArray(row.awards) ? row.awards : [],
    };
  } catch {
    return null;
  }
}

async function fetchEdgeStats(playerId: number, season?: number): Promise<PlayerEdgeStats | null> {
  try {
    const { data: rows, error } = await supabase
      .from('edge_skater_stats')
      .select('*')
      .eq('player_id', playerId)
      .eq('season', season ?? -1)
      .limit(1);

    if (error || !rows || rows.length === 0) return null;
    const row = rows[0];

    return {
      topSpeed: row.max_skating_speed_mph ?? undefined,
      topSpeedRank: row.max_skating_speed_rank ?? undefined,
      topSpeedPercentile: row.max_skating_speed_percentile ?? undefined,
      topShotSpeed: row.top_shot_speed_mph ?? undefined,
      topShotSpeedRank: row.top_shot_speed_rank ?? undefined,
      topShotSpeedPercentile: row.top_shot_speed_percentile ?? undefined,
      totalDistance: row.total_distance_miles ?? undefined,
      burstsOver20: row.bursts_over_20 ?? undefined,
      offensiveZonePctg: row.offensive_zone_pctg ?? undefined,
      neutralZonePctg: row.neutral_zone_pctg ?? undefined,
      defensiveZonePctg: row.defensive_zone_pctg ?? undefined,
    };
  } catch {
    return null;
  }
}

async function fetchRecentGames(
  playerId: number, isGoalie: boolean, season?: number,
  cutoff = new Date().toISOString().slice(0, 10),
): Promise<RecentGame[]> {
  if (!season) return [];
  try {
    const {data, error} = await supabase.from(isGoalie ? 'game_goalie_stats' : 'game_skater_stats')
      .select('*, games!inner(game_date, season, game_type, game_state, home_team_abbrev, away_team_abbrev)')
      .eq('player_id', playerId).eq('games.season', season).eq('games.game_type', 2)
      .lte('games.game_date', cutoff).in('games.game_state', ['OFF', 'FINAL'])
      .order('games(game_date)', {ascending: false}).order('game_id', {ascending: false}).limit(isGoalie ? 120 : 5);
    if (error || !data) return [];
    const appearances = scopedGames(data, season, cutoff).filter(row => {
      if (!isGoalie) return true;
      // Boxscores also include dressed backups who never entered the game.
      const playedTime = typeof row.toi === 'string' && /^\d+:\d{2}$/.test(row.toi)
        && row.toi.split(':').some((part: string) => Number(part) > 0);
      return playedTime || row.starter === true || (numberOrNull(row.saves) ?? 0) > 0
        || (numberOrNull(row.goals_against) ?? 0) > 0;
    });
    return appearances.slice(0,5).map(row => ({
      gameId: row.game_id, gameDate: row.games.game_date,
      opponent: row.team_abbrev === row.games.home_team_abbrev ? row.games.away_team_abbrev
        : row.team_abbrev === row.games.away_team_abbrev ? row.games.home_team_abbrev : undefined,
      goals: numberOrNull(row.goals), assists:numberOrNull(row.assists), points:numberOrNull(row.points),
      plusMinus:numberOrNull(row.plus_minus), toi:row.toi ?? undefined,
      shots:numberOrNull(row.shots_on_goal), hits:numberOrNull(row.hits), blockedShots:numberOrNull(row.blocked_shots),
      saves:numberOrNull(row.saves), goalsAgainst:numberOrNull(row.goals_against), decision:row.decision ?? undefined,
    }));
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapBio(row: any): PlayerBio {
  return {
    playerId: row.id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    fullName: row.full_name || `${row.first_name} ${row.last_name}`,
    position: row.position || '',
    teamAbbrev: row.current_team_abbrev || '',
    sweaterNumber: row.sweater_number ?? undefined,
    headshotUrl: row.headshot_url ?? undefined,
    shootsCatches: row.shoots_catches ?? undefined,
    heightInches: row.height_inches ?? undefined,
    weightPounds: row.weight_pounds ?? undefined,
    birthDate: row.birth_date ?? undefined,
    birthCity: row.birth_city ?? undefined,
    birthCountry: row.birth_country ?? undefined,
    draftYear: row.draft_year ?? undefined,
    draftRound: row.draft_round ?? undefined,
    draftPick: row.draft_pick ?? undefined,
    draftOverall: row.draft_overall ?? undefined,
  };
}

/** Visible for testing */
export const _internals = {
  detailCache,
  CACHE_TTL,
  mapBio,
  fetchSeasonStats,
  fetchCareerData,
  fetchEdgeStats,
  fetchRecentGames,

};
