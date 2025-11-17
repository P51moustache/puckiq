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

// Map team abbreviation to team ID (NHL API uses IDs for some endpoints)
const TEAM_ID_MAP: Record<string, number> = {
  'ANA': 24, 'BOS': 6, 'BUF': 7, 'CAR': 12, 'CBJ': 29, 'CGY': 20,
  'CHI': 16, 'COL': 21, 'DAL': 25, 'DET': 17, 'EDM': 22, 'FLA': 13,
  'LAK': 26, 'MIN': 30, 'MTL': 8, 'NJD': 1, 'NSH': 18, 'NYI': 2,
  'NYR': 3, 'OTT': 9, 'PHI': 4, 'PIT': 5, 'SEA': 55, 'SJS': 28,
  'STL': 19, 'TBL': 14, 'TOR': 10, 'VAN': 23, 'VGK': 54, 'WPG': 52,
  'WSH': 15, 'ARI': 53,
};

/**
 * Fetch comprehensive team statistics for comparison
 */
export async function getTeamComparisonData(
  teamAbbrev: string,
  standingsData?: any
): Promise<TeamComparisonStats> {
  try {
    const teamId = TEAM_ID_MAP[teamAbbrev];
    if (!teamId) {
      throw new Error(`Unknown team abbreviation: ${teamAbbrev}`);
    }

    // Fetch team comparison data and standings (if not provided)
    const [comparisonRes, standingsRes] = await Promise.allSettled([
      fetch(`https://api-web.nhle.com/v1/edge/team-comparison/${teamId}/now`),
      standingsData ? Promise.resolve({ ok: true, json: async () => standingsData }) : fetch('https://api-web.nhle.com/v1/standings/now'),
    ]);

    let comparisonData = null;
    let standings = null;

    // Extract comparison data if successful
    if (comparisonRes.status === 'fulfilled' && comparisonRes.value.ok) {
      comparisonData = await comparisonRes.value.json();
    }

    // Extract standings data if successful
    if (standingsRes.status === 'fulfilled' && standingsRes.value.ok) {
      const data = await standingsRes.value.json();
      standings = data.standings || data;
    }

    // Find team in standings for basic stats
    const teamStanding = standings?.find(
      (t: any) => (t.teamAbbrev?.default || t.teamAbbrev) === teamAbbrev
    );

    // Build stats object from available data sources
    return buildTeamStats(teamId, teamAbbrev, comparisonData, teamStanding);
  } catch (error) {
    console.error(`[TEAM COMPARISON] Error fetching data for ${teamAbbrev}:`, error);
    throw error;
  }
}

/**
 * Build team stats from API data
 */
function buildTeamStats(
  teamId: number,
  teamAbbrev: string,
  comparisonData: any,
  standingData: any
): TeamComparisonStats {
  const gamesPlayed = standingData?.gamesPlayed || 1;
  const goalsFor = standingData?.goalFor || standingData?.goalsFor || 0;
  const goalsAgainst = standingData?.goalAgainst || standingData?.goalsAgainst || 0;

  // Extract data from comparison API (if available)
  const stats = comparisonData?.stats || {};

  // Offense stats
  const offense: OffenseStats = {
    goalsPerGame: goalsFor / gamesPlayed,
    goalsPerGameRank: stats.goalsPerGameRank,
    shotsPerGame: stats.shotsForPerGame || (standingData?.shotsForPer60 || 30),
    shotsPerGameRank: stats.shotsForPerGameRank,
    shootingPct: stats.shootingPct || ((goalsFor / (stats.shotsForPerGame * gamesPlayed || 1)) * 100),
    shootingPctRank: stats.shootingPctRank,
    powerPlayGoals: stats.powerPlayGoals || 0,
    powerPlayGoalsRank: stats.powerPlayGoalsRank,
    powerPlayPct: (standingData?.powerPlayPct || standingData?.powerPlayPctg || 0) * 100,
    powerPlayPctRank: stats.powerPlayPctRank,
    scoringFirst: stats.scoringFirstPct || 0,
    scoringFirstRank: stats.scoringFirstRank,
  };

  // Defense stats
  const defense: DefenseStats = {
    goalsAgainstPerGame: goalsAgainst / gamesPlayed,
    goalsAgainstPerGameRank: stats.goalsAgainstPerGameRank,
    shotsAgainstPerGame: stats.shotsAgainstPerGame || (standingData?.shotsAgainstPer60 || 30),
    shotsAgainstPerGameRank: stats.shotsAgainstPerGameRank,
    penaltyKillPct: (standingData?.penaltyKillPct || standingData?.penaltyKillPctg || 0) * 100,
    penaltyKillPctRank: stats.penaltyKillPctRank,
    blockedShots: stats.blockedShots || 0,
    blockedShotsRank: stats.blockedShotsRank,
    takeaways: stats.takeaways || 0,
    takeawaysRank: stats.takeawaysRank,
    hits: stats.hits || 0,
    hitsRank: stats.hitsRank,
  };

  // Special Teams stats
  const specialTeams: SpecialTeamsStats = {
    powerPlayOpportunities: stats.powerPlayOpportunities || 0,
    powerPlayOpportunitiesRank: stats.powerPlayOpportunitiesRank,
    powerPlayPct: offense.powerPlayPct,
    powerPlayPctRank: offense.powerPlayPctRank,
    penaltyKillPct: defense.penaltyKillPct,
    penaltyKillPctRank: defense.penaltyKillPctRank,
    shorthandedGoals: stats.shorthandedGoals || 0,
    shorthandedGoalsRank: stats.shorthandedGoalsRank,
    powerPlayGoalsFor: offense.powerPlayGoals,
    powerPlayGoalsForRank: offense.powerPlayGoalsRank,
    powerPlayGoalsAgainst: stats.powerPlayGoalsAgainst || 0,
    powerPlayGoalsAgainstRank: stats.powerPlayGoalsAgainstRank,
  };

  // Advanced stats
  const advanced: AdvancedStats = {
    corsiForPct: stats.corsiForPct || 50.0,
    corsiForPctRank: stats.corsiForPctRank,
    fenwickForPct: stats.fenwickForPct || 50.0,
    fenwickForPctRank: stats.fenwickForPctRank,
    pdo: stats.pdo || 100.0,
    pdoRank: stats.pdoRank,
    expectedGoalsFor: stats.expectedGoalsFor || offense.goalsPerGame,
    expectedGoalsForRank: stats.expectedGoalsForRank,
    expectedGoalsAgainst: stats.expectedGoalsAgainst || defense.goalsAgainstPerGame,
    expectedGoalsAgainstRank: stats.expectedGoalsAgainstRank,
    highDangerChancesFor: stats.highDangerChancesFor || 0,
    highDangerChancesForRank: stats.highDangerChancesForRank,
    highDangerChancesAgainst: stats.highDangerChancesAgainst || 0,
    highDangerChancesAgainstRank: stats.highDangerChancesAgainstRank,
    shotQuality: stats.shotQuality || offense.shootingPct,
    shotQualityRank: stats.shotQualityRank,
  };

  // Goaltending stats
  const calculatedSavePct = stats.savePct || (1 - (goalsAgainst / (defense.shotsAgainstPerGame * gamesPlayed || 1)));

  const goaltending: GoaltendingStats = {
    savePct: calculatedSavePct,
    savePctRank: stats.savePctRank,
    goalsAgainstAverage: defense.goalsAgainstPerGame,
    goalsAgainstAverageRank: defense.goalsAgainstPerGameRank,
    shutouts: stats.shutouts || 0,
    shutoutsRank: stats.shutoutsRank,
    qualityStarts: stats.qualityStarts || 0,
    qualityStartsRank: stats.qualityStartsRank,
    highDangerSavePct: stats.highDangerSavePct || (calculatedSavePct - 0.08),
    highDangerSavePctRank: stats.highDangerSavePctRank,
    reboundControl: stats.reboundControl || 50,
    reboundControlRank: stats.reboundControlRank,
  };

  // Discipline stats
  const discipline: DisciplineStats = {
    penaltiesPerGame: stats.penaltiesPerGame || 0,
    penaltiesPerGameRank: stats.penaltiesPerGameRank,
    penaltyMinutes: stats.penaltyMinutes || 0,
    penaltyMinutesRank: stats.penaltyMinutesRank,
    minorPenalties: stats.minorPenalties || 0,
    minorPenaltiesRank: stats.minorPenaltiesRank,
    majorPenalties: stats.majorPenalties || 0,
    majorPenaltiesRank: stats.majorPenaltiesRank,
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
 * Determine which team wins a specific stat comparison
 */
export function determineWinner(
  homeValue: number,
  awayValue: number,
  higherIsBetter: boolean
): 'home' | 'away' | 'tie' {
  const diff = Math.abs(homeValue - awayValue);

  // Consider values within 0.5% as a tie
  const threshold = Math.max(homeValue, awayValue) * 0.005;
  if (diff < threshold) return 'tie';

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
  let defenseHome = 0;
  let defenseAway = 0;
  if (determineWinner(homeStats.defense.goalsAgainstPerGame, awayStats.defense.goalsAgainstPerGame, false) === 'home') defenseHome++;
  else if (determineWinner(homeStats.defense.goalsAgainstPerGame, awayStats.defense.goalsAgainstPerGame, false) === 'away') defenseAway++;

  if (determineWinner(homeStats.defense.penaltyKillPct, awayStats.defense.penaltyKillPct, true) === 'home') defenseHome++;
  else if (determineWinner(homeStats.defense.penaltyKillPct, awayStats.defense.penaltyKillPct, true) === 'away') defenseAway++;

  if (determineWinner(homeStats.defense.blockedShots, awayStats.defense.blockedShots, true) === 'home') defenseHome++;
  else if (determineWinner(homeStats.defense.blockedShots, awayStats.defense.blockedShots, true) === 'away') defenseAway++;

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
  format: 'number' | 'percentage' | 'decimal' = 'number',
  decimals: number = 1
): string {
  if (value === undefined || value === null || isNaN(value)) return 'N/A';

  switch (format) {
    case 'percentage':
      return `${value.toFixed(decimals)}%`;
    case 'decimal':
      return value.toFixed(decimals);
    case 'number':
    default:
      return value.toFixed(decimals);
  }
}
