// Team Comparison Service
// Fetches and processes team statistics for side-by-side comparison

import {
  TeamComparisonStats,
  OffenseStats,
  DefenseStats,
  SpecialTeamsStats,
  AdvancedStats,
  GoaltendingStats,
  DisciplineStats,
  CategoryWinner,
} from '../types/teamStats';
import { supabase } from '../lib/supabase';

import { fetchArenaStandings } from './arenaData';
import type { ArenaStanding } from '../types/arena';

export async function getTeamComparisonPair(a: string, b: string): Promise<[TeamComparisonStats, TeamComparisonStats]> {
  const snapshot = await fetchArenaStandings();
  return Promise.all([getTeamComparisonData(a, snapshot), getTeamComparisonData(b, snapshot)]);
}

/** Every compared team uses the same exact standings snapshot and regular season. */
export async function getTeamComparisonData(teamAbbrev: string, context?: ArenaStanding[]): Promise<TeamComparisonStats> {
  const snapshot = context ?? await fetchArenaStandings();
  const standing = snapshot.find(row => row.team_abbrev === teamAbbrev);
  if (!standing) throw new Error(`Statistics unavailable for ${teamAbbrev} in this snapshot.`);
  const season = standing.season;
  if (snapshot.some(row => row.season !== season || row.snapshot_date !== standing.snapshot_date)) {
    throw new Error('Team statistics do not share a coherent snapshot.');
  }
  const categories = await supabase.from('team_stat_categories').select('stat_category,data,fetched_at')
    .eq('team_abbrev', teamAbbrev).eq('season', season)
    .in('stat_category', ['summary', 'penalties']).order('fetched_at', { ascending: false });
  // Category tables are regular-season feeds. Require matching games played so a
  // later rolling category snapshot cannot silently enrich an older standing.
  const rows = categories.error ? [] : categories.data ?? [];
  const compatible = (category: string) => rows.find((row: any) => row.stat_category === category && row.data?.gamesPlayed === standing.games_played);
  const summary = compatible('summary');
  const penalties = compatible('penalties');
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : NaN;
  const mapped = snapshot.map(row => ({ teamAbbrev: row.team_abbrev, gamesPlayed: row.games_played, goalFor: row.goals_for, goalAgainst: row.goals_against, wins: row.wins, losses: row.losses, otLosses: row.ot_losses, points: row.points }));
  const stats = buildTeamStats(summary?.data?.teamId ?? 0, teamAbbrev, mapped,
    mapped.find(row => row.teamAbbrev === teamAbbrev), {
      powerPlayGoals: finite(summary?.data?.powerPlayGoals),
      shutouts: finite(summary?.data?.shutouts),
      realPenaltyCountPerGame: standing.games_played > 0 ? finite(penalties?.data?.penalties) / standing.games_played : NaN,
      realPenaltyMinutesTotal: finite(penalties?.data?.penaltyMinutes),
    }, summary?.data);
  stats.period = { season, snapshotDate: standing.snapshot_date, gameType: 2, summaryAsOf: summary?.fetched_at ?? null, penaltiesAsOf: penalties?.fetched_at ?? null };
  return stats;
}

/**
 * Build team stats from API data
 */
function buildTeamStats(
  teamId: number,
  teamAbbrev: string,
  allTeamsStandings: any[],
  standingData: any,
  clubStats: any = null,
  teamSummary: any = null
): TeamComparisonStats {
  const gamesPlayed = standingData?.gamesPlayed > 0 ? standingData.gamesPlayed : NaN;
  const goalsFor = standingData?.goalFor ?? standingData?.goalsFor ?? NaN;
  const goalsAgainst = standingData?.goalAgainst ?? standingData?.goalsAgainst ?? NaN;

  // Aggregated club stats (computed by the caller from skater + goalie season tables)
  const totalPowerPlayGoals = clubStats?.powerPlayGoals ?? 0;
  const totalShutouts = clubStats?.shutouts ?? 0;

  // Authoritative real penalty count + PIM season total from NHL API.
  // Null when team_stat_categories.penalties hasn't synced yet — caller will hide the row.
  const realPenaltyCountPerGame: number | null = clubStats?.realPenaltyCountPerGame ?? null;
  const realPenaltyMinutesTotal: number | null = clubStats?.realPenaltyMinutesTotal ?? null;

  // Use REAL team-level stats from team summary API (not estimates!)
  const shotsPerGame = teamSummary?.shotsForPerGame ?? NaN;
  const shotsAgainstPerGame = teamSummary?.shotsAgainstPerGame ?? NaN;
  const shootingPct = shotsPerGame > 0 ? (goalsFor / (shotsPerGame * gamesPlayed)) * 100 : NaN;
  const savePct = shotsAgainstPerGame > 0 ? 1 - (goalsAgainst / (shotsAgainstPerGame * gamesPlayed)) : NaN;

  // Use REAL PP% and PK% from team summary (not estimated!)
  const powerPlayPct = (teamSummary?.powerPlayPct ?? NaN) * 100;
  const penaltyKillPct = (teamSummary?.penaltyKillPct ?? NaN) * 100;

  // Calculate rankings across all teams
  const teamRankings = calculateAllRankings(allTeamsStandings, teamAbbrev, clubStats);

  // Real data from NHL API
  const goalsForPerGame = goalsFor / gamesPlayed;
  const goalsAgainstPerGame = goalsAgainst / gamesPlayed;

  // Offense stats (real data from standings + aggregated player stats)
  const offense: OffenseStats = {
    goalsPerGame: goalsForPerGame,
    goalsPerGameRank: teamRankings.goalsPerGameRank,
    shotsPerGame: shotsPerGame,
    shotsPerGameRank: teamRankings.shotsPerGameRank,
    shootingPct: shootingPct,
    shootingPctRank: teamRankings.shootingPctRank,
    powerPlayGoals: totalPowerPlayGoals,
    powerPlayGoalsRank: teamRankings.powerPlayGoalsRank,
    powerPlayPct: powerPlayPct,
    powerPlayPctRank: teamRankings.powerPlayPctRank,
    scoringFirst: NaN, // Not available from API
    scoringFirstRank: undefined,
  };

  // Defense stats (real data from standings + aggregated goalie stats)
  const defense: DefenseStats = {
    goalsAgainstPerGame: goalsAgainstPerGame,
    goalsAgainstPerGameRank: teamRankings.goalsAgainstPerGameRank,
    shotsAgainstPerGame: shotsAgainstPerGame,
    shotsAgainstPerGameRank: teamRankings.shotsAgainstPerGameRank,
    penaltyKillPct: penaltyKillPct,
    penaltyKillPctRank: teamRankings.penaltyKillPctRank,
    blockedShots: NaN, // Not available from player stats
    blockedShotsRank: undefined,
    takeaways: NaN, // Not available from player stats
    takeawaysRank: undefined,
    hits: NaN, // Not available from player stats
    hitsRank: undefined,
  };

  // Special Teams stats (using real NHL data)
  const specialTeams: SpecialTeamsStats = {
    powerPlayOpportunities: NaN, // Not available from API
    powerPlayOpportunitiesRank: undefined,
    powerPlayPct: powerPlayPct,
    powerPlayPctRank: teamRankings.powerPlayPctRank,
    penaltyKillPct: penaltyKillPct,
    penaltyKillPctRank: teamRankings.penaltyKillPctRank,
    shorthandedGoals: NaN, // Not available from API
    shorthandedGoalsRank: undefined,
    powerPlayGoalsFor: totalPowerPlayGoals,
    powerPlayGoalsForRank: teamRankings.powerPlayGoalsRank,
    powerPlayGoalsAgainst: NaN, // Not available from API
    powerPlayGoalsAgainstRank: undefined,
  };

  // Advanced stats - not available from standings API
  const advanced: AdvancedStats = {
    corsiForPct: NaN,
    corsiForPctRank: undefined,
    fenwickForPct: NaN,
    fenwickForPctRank: undefined,
    pdo: NaN,
    pdoRank: undefined,
    expectedGoalsFor: NaN,
    expectedGoalsForRank: undefined,
    expectedGoalsAgainst: NaN,
    expectedGoalsAgainstRank: undefined,
    highDangerChancesFor: NaN,
    highDangerChancesForRank: undefined,
    highDangerChancesAgainst: NaN,
    highDangerChancesAgainstRank: undefined,
    shotQuality: NaN,
    shotQualityRank: undefined,
  };

  // Goaltending stats (calculated from aggregated goalie data)
  const goaltending: GoaltendingStats = {
    savePct: savePct,
    savePctRank: teamRankings.savePctRank,
    goalsAgainstAverage: goalsAgainstPerGame,
    goalsAgainstAverageRank: teamRankings.goalsAgainstPerGameRank,
    shutouts: totalShutouts,
    shutoutsRank: undefined,
    qualityStarts: NaN, // Not available
    qualityStartsRank: undefined,
    highDangerSavePct: NaN, // Not available
    highDangerSavePctRank: undefined,
    reboundControl: NaN, // Not available
    reboundControlRank: undefined,
  };

  // Discipline stats — prefer authoritative NHL penalties endpoint when synced,
  // else NaN so the UI hides the row instead of showing a fake derivation.
  const penaltiesPerGame = realPenaltyCountPerGame ?? NaN;
  const penaltyMinutesValue = realPenaltyMinutesTotal ?? NaN;
  const discipline: DisciplineStats = {
    penaltiesPerGame,
    penaltiesPerGameRank: undefined,
    penaltyMinutes: penaltyMinutesValue,
    penaltyMinutesRank: undefined,
    minorPenalties: NaN,
    minorPenaltiesRank: undefined,
    majorPenalties: NaN,
    majorPenaltiesRank: undefined,
  };

  return {
    teamId,
    teamAbbrev,
    offense,
    defense,
    specialTeams,
    advanced,
    goaltending,
    discipline,
  };
}

/**
 * Calculate rankings for all stats across all teams
 */
function calculateAllRankings(allTeamsStandings: any[], teamAbbrev: string, clubStats: any = null): any {
  // Calculate metrics for all teams
  const allTeamsMetrics = allTeamsStandings.map((team: any) => {
    const gp = team.gamesPlayed > 0 ? team.gamesPlayed : NaN;
    const gf = team.goalFor ?? team.goalsFor ?? NaN;
    const ga = team.goalAgainst ?? team.goalsAgainst ?? NaN;

    return {
      teamAbbrev: team.teamAbbrev?.default || team.teamAbbrev,
      goalsPerGame: gf / gp,
      goalsAgainstPerGame: ga / gp,
    };
  });

  // Helper to get rank
  const getRank = (metric: string, higherIsBetter: boolean = true) => {
    const sorted = [...allTeamsMetrics]
      .filter((t: any) => Number.isFinite(t[metric]))
      .sort((a: any, b: any) => higherIsBetter ? b[metric] - a[metric] : a[metric] - b[metric]);

    const teamIndex = sorted.findIndex((t: any) => t.teamAbbrev === teamAbbrev);
    return teamIndex >= 0 ? teamIndex + 1 : undefined;
  };

  // Only return rankings we can actually calculate from standings data
  // TODO: Connect to Supabase for real per-stat rankings
  return {
    goalsPerGameRank: getRank('goalsPerGame', true),
    goalsAgainstPerGameRank: getRank('goalsAgainstPerGame', false),
    shotsPerGameRank: undefined,
    shotsAgainstPerGameRank: undefined,
    shootingPctRank: undefined,
    savePctRank: undefined,
    powerPlayPctRank: undefined,
    penaltyKillPctRank: undefined,
    powerPlayGoalsRank: undefined,
  };
}

/**
 * Determine which team wins a specific stat comparison
 */
export function determineWinner(
  homeValue: number,
  awayValue: number,
  higherIsBetter: boolean
): 'home' | 'away' | 'tie' {
  // Unavailable stats arrive as NaN (e.g. discipline before the penalties
  // category syncs, or always-0 advanced stats). Comparing NaN would otherwise
  // fabricate a spurious 'away' winner, so treat any non-finite input as a tie.
  if (!Number.isFinite(homeValue) || !Number.isFinite(awayValue)) return 'tie';

  const diff = Math.abs(homeValue - awayValue);

  // Consider values within 0.5% as a tie
  const threshold = Math.max(homeValue, awayValue) * 0.005;
  if (diff <= threshold) return 'tie'; // Changed from < to <= to handle 0 vs 0 correctly

  if (higherIsBetter) {
    return homeValue > awayValue ? 'home' : 'away';
  } else {
    return homeValue < awayValue ? 'home' : 'away';
  }
}

/**
 * Calculate category winners based on stat comparisons
 */
export function calculateCategoryWinners(
  homeStats: TeamComparisonStats,
  awayStats: TeamComparisonStats
): CategoryWinner {
  const categories: CategoryWinner = {
    offense: 'tie',
    defense: 'tie',
    specialTeams: 'tie',
    advanced: 'tie',
    goaltending: 'tie',
    discipline: 'tie',
  };

  if (homeStats.period && awayStats.period && (homeStats.period.season !== awayStats.period.season || homeStats.period.snapshotDate !== awayStats.period.snapshotDate)) return categories;

  // Offense: count wins for key stats
  let offenseHome = 0;
  let offenseAway = 0;
  if (determineWinner(homeStats.offense.goalsPerGame, awayStats.offense.goalsPerGame, true) === 'home') offenseHome++;
  else if (determineWinner(homeStats.offense.goalsPerGame, awayStats.offense.goalsPerGame, true) === 'away') offenseAway++;

  if (determineWinner(homeStats.offense.shotsPerGame, awayStats.offense.shotsPerGame, true) === 'home') offenseHome++;
  else if (determineWinner(homeStats.offense.shotsPerGame, awayStats.offense.shotsPerGame, true) === 'away') offenseAway++;

  if (determineWinner(homeStats.offense.shootingPct, awayStats.offense.shootingPct, true) === 'home') offenseHome++;
  else if (determineWinner(homeStats.offense.shootingPct, awayStats.offense.shootingPct, true) === 'away') offenseAway++;

  categories.offense = offenseHome > offenseAway ? 'home' : offenseAway > offenseHome ? 'away' : 'tie';

  // Defense: count wins for key stats (lower is better for GA)
  // Only include stats with real data (exclude blockedShots, takeaways, hits - always 0)
  let defenseHome = 0;
  let defenseAway = 0;
  if (determineWinner(homeStats.defense.goalsAgainstPerGame, awayStats.defense.goalsAgainstPerGame, false) === 'home') defenseHome++;
  else if (determineWinner(homeStats.defense.goalsAgainstPerGame, awayStats.defense.goalsAgainstPerGame, false) === 'away') defenseAway++;

  if (determineWinner(homeStats.defense.shotsAgainstPerGame, awayStats.defense.shotsAgainstPerGame, false) === 'home') defenseHome++;
  else if (determineWinner(homeStats.defense.shotsAgainstPerGame, awayStats.defense.shotsAgainstPerGame, false) === 'away') defenseAway++;

  if (determineWinner(homeStats.defense.penaltyKillPct, awayStats.defense.penaltyKillPct, true) === 'home') defenseHome++;
  else if (determineWinner(homeStats.defense.penaltyKillPct, awayStats.defense.penaltyKillPct, true) === 'away') defenseAway++;

  categories.defense = defenseHome > defenseAway ? 'home' : defenseAway > defenseHome ? 'away' : 'tie';

  // Special Teams
  let stHome = 0;
  let stAway = 0;
  if (determineWinner(homeStats.specialTeams.powerPlayPct, awayStats.specialTeams.powerPlayPct, true) === 'home') stHome++;
  else if (determineWinner(homeStats.specialTeams.powerPlayPct, awayStats.specialTeams.powerPlayPct, true) === 'away') stAway++;

  if (determineWinner(homeStats.specialTeams.penaltyKillPct, awayStats.specialTeams.penaltyKillPct, true) === 'home') stHome++;
  else if (determineWinner(homeStats.specialTeams.penaltyKillPct, awayStats.specialTeams.penaltyKillPct, true) === 'away') stAway++;

  categories.specialTeams = stHome > stAway ? 'home' : stAway > stHome ? 'away' : 'tie';

  // Advanced
  let advHome = 0;
  let advAway = 0;
  if (determineWinner(homeStats.advanced.corsiForPct, awayStats.advanced.corsiForPct, true) === 'home') advHome++;
  else if (determineWinner(homeStats.advanced.corsiForPct, awayStats.advanced.corsiForPct, true) === 'away') advAway++;

  if (determineWinner(homeStats.advanced.expectedGoalsFor, awayStats.advanced.expectedGoalsFor, true) === 'home') advHome++;
  else if (determineWinner(homeStats.advanced.expectedGoalsFor, awayStats.advanced.expectedGoalsFor, true) === 'away') advAway++;

  categories.advanced = advHome > advAway ? 'home' : advAway > advHome ? 'away' : 'tie';

  // Goaltending (higher save % is better, lower GAA is better)
  let goalHome = 0;
  let goalAway = 0;
  if (determineWinner(homeStats.goaltending.savePct, awayStats.goaltending.savePct, true) === 'home') goalHome++;
  else if (determineWinner(homeStats.goaltending.savePct, awayStats.goaltending.savePct, true) === 'away') goalAway++;

  if (determineWinner(homeStats.goaltending.goalsAgainstAverage, awayStats.goaltending.goalsAgainstAverage, false) === 'home') goalHome++;
  else if (determineWinner(homeStats.goaltending.goalsAgainstAverage, awayStats.goaltending.goalsAgainstAverage, false) === 'away') goalAway++;

  categories.goaltending = goalHome > goalAway ? 'home' : goalAway > goalHome ? 'away' : 'tie';

  // Discipline (lower penalties is better)
  let discHome = 0;
  let discAway = 0;
  if (determineWinner(homeStats.discipline.penaltiesPerGame, awayStats.discipline.penaltiesPerGame, false) === 'home') discHome++;
  else if (determineWinner(homeStats.discipline.penaltiesPerGame, awayStats.discipline.penaltiesPerGame, false) === 'away') discAway++;

  if (determineWinner(homeStats.discipline.penaltyMinutes, awayStats.discipline.penaltyMinutes, false) === 'home') discHome++;
  else if (determineWinner(homeStats.discipline.penaltyMinutes, awayStats.discipline.penaltyMinutes, false) === 'away') discAway++;

  categories.discipline = discHome > discAway ? 'home' : discAway > discHome ? 'away' : 'tie';

  return categories;
}

/**
 * Format stat value for display
 */
export function formatStatValue(
  value: number,
  format: 'number' | 'percentage' | 'decimal' | 'saveFraction' = 'number',
  decimals: number = 1
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return 'N/A';

  switch (format) {
    case 'saveFraction':
      return value.toFixed(3).replace(/^0\./, '.');
    case 'percentage':
      return `${value.toFixed(decimals)}%`;
    case 'decimal':
      return value.toFixed(decimals);
    case 'number':
    default:
      return value.toFixed(decimals);
  }
}
