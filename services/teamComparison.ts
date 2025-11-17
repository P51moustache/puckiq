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

    // Fetch standings, club stats, and team summary in parallel
    const [standingsRes, clubStatsRes, teamSummaryRes] = await Promise.allSettled([
      standingsData
        ? Promise.resolve({ ok: true, json: async () => (standingsData.standings ? standingsData : { standings: standingsData }) })
        : fetch('https://api-web.nhle.com/v1/standings/now'),
      fetch(`https://api-web.nhle.com/v1/club-stats/${teamAbbrev}/now`),
      fetch(`https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=20252026%20and%20gameTypeId=2`),
    ]);

    // Extract standings data
    let standings = null;
    if (standingsRes.status === 'fulfilled' && standingsRes.value.ok) {
      const data = await standingsRes.value.json();
      standings = data.standings || data;
    }

    if (!standings) {
      throw new Error('Failed to fetch standings data');
    }

    // Extract club stats (player-level data to aggregate)
    let clubStats = null;
    if (clubStatsRes.status === 'fulfilled' && clubStatsRes.value.ok) {
      clubStats = await clubStatsRes.value.json();
    }

    // Extract team summary (has REAL PP%, PK%, shots data)
    let teamSummary = null;
    if (teamSummaryRes.status === 'fulfilled' && teamSummaryRes.value.ok) {
      const data = await teamSummaryRes.value.json();
      teamSummary = data.data?.find((t: any) => t.teamId === teamId);
    }

    // Find team in standings
    const teamStanding = standings?.find(
      (t: any) => (t.teamAbbrev?.default || t.teamAbbrev) === teamAbbrev
    );

    if (!teamStanding) {
      throw new Error(`Team ${teamAbbrev} not found in standings`);
    }

    // Build stats object from all data sources
    return buildTeamStats(teamId, teamAbbrev, standings, teamStanding, clubStats, teamSummary);
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
  allTeamsStandings: any[],
  standingData: any,
  clubStats: any = null,
  teamSummary: any = null
): TeamComparisonStats {
  const gamesPlayed = standingData?.gamesPlayed || 1;
  const goalsFor = standingData?.goalFor || standingData?.goalsFor || 0;
  const goalsAgainst = standingData?.goalAgainst || standingData?.goalsAgainst || 0;
  const wins = standingData?.wins || 0;
  const losses = standingData?.losses || 0;
  const otLosses = standingData?.otLosses || 0;
  const points = standingData?.points || 0;
  const pointsPct = points / (gamesPlayed * 2);

  // Aggregate player stats for power play goals
  let totalPowerPlayGoals = 0;

  if (clubStats?.skaters) {
    clubStats.skaters.forEach((player: any) => {
      totalPowerPlayGoals += player.powerPlayGoals || 0;
    });
  }

  // Use REAL team-level stats from team summary API (not estimates!)
  const shotsPerGame = teamSummary?.shotsForPerGame || 0;
  const shotsAgainstPerGame = teamSummary?.shotsAgainstPerGame || 0;
  const shootingPct = shotsPerGame > 0 ? (goalsFor / (shotsPerGame * gamesPlayed)) * 100 : 0;
  const savePct = shotsAgainstPerGame > 0 ? 1 - (goalsAgainst / (shotsAgainstPerGame * gamesPlayed)) : 0;

  // Use REAL PP% and PK% from team summary (not estimated!)
  const powerPlayPct = (teamSummary?.powerPlayPct || 0) * 100;
  const penaltyKillPct = (teamSummary?.penaltyKillPct || 0) * 100;

  // Calculate rankings across all teams
  const teamRankings = calculateAllRankings(allTeamsStandings, teamAbbrev, clubStats);

  // Real data from NHL API
  const goalsForPerGame = goalsFor / gamesPlayed;
  const goalsAgainstPerGame = goalsAgainst / gamesPlayed;
  const winPct = (wins / gamesPlayed) * 100;
  const goalDifferential = goalsFor - goalsAgainst;

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
    scoringFirst: 0, // Not available from API
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
    blockedShots: 0, // Not available from player stats
    blockedShotsRank: undefined,
    takeaways: 0, // Not available from player stats
    takeawaysRank: undefined,
    hits: 0, // Not available from player stats
    hitsRank: undefined,
  };

  // Special Teams stats (using real NHL data)
  const specialTeams: SpecialTeamsStats = {
    powerPlayOpportunities: 0, // Not available from API
    powerPlayOpportunitiesRank: undefined,
    powerPlayPct: powerPlayPct,
    powerPlayPctRank: teamRankings.powerPlayPctRank,
    penaltyKillPct: penaltyKillPct,
    penaltyKillPctRank: teamRankings.penaltyKillPctRank,
    shorthandedGoals: 0, // Not available from API
    shorthandedGoalsRank: undefined,
    powerPlayGoalsFor: totalPowerPlayGoals,
    powerPlayGoalsForRank: teamRankings.powerPlayGoalsRank,
    powerPlayGoalsAgainst: 0, // Not available from API
    powerPlayGoalsAgainstRank: undefined,
  };

  // Advanced stats - not available from standings API
  const advanced: AdvancedStats = {
    corsiForPct: 0,
    corsiForPctRank: undefined,
    fenwickForPct: 0,
    fenwickForPctRank: undefined,
    pdo: 0,
    pdoRank: undefined,
    expectedGoalsFor: 0,
    expectedGoalsForRank: undefined,
    expectedGoalsAgainst: 0,
    expectedGoalsAgainstRank: undefined,
    highDangerChancesFor: 0,
    highDangerChancesForRank: undefined,
    highDangerChancesAgainst: 0,
    highDangerChancesAgainstRank: undefined,
    shotQuality: 0,
    shotQualityRank: undefined,
  };

  // Goaltending stats (calculated from aggregated goalie data)
  const goaltending: GoaltendingStats = {
    savePct: savePct,
    savePctRank: teamRankings.savePctRank,
    goalsAgainstAverage: goalsAgainstPerGame,
    goalsAgainstAverageRank: teamRankings.goalsAgainstPerGameRank,
    shutouts: 0, // Not easily aggregated
    shutoutsRank: undefined,
    qualityStarts: 0, // Not available
    qualityStartsRank: undefined,
    highDangerSavePct: 0, // Not available
    highDangerSavePctRank: undefined,
    reboundControl: 0, // Not available
    reboundControlRank: undefined,
  };

  // Discipline stats - not available from standings API
  const discipline: DisciplineStats = {
    penaltiesPerGame: 0,
    penaltiesPerGameRank: undefined,
    penaltyMinutes: 0,
    penaltyMinutesRank: undefined,
    minorPenalties: 0,
    minorPenaltiesRank: undefined,
    majorPenalties: 0,
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
    const gp = team.gamesPlayed || 1;
    const gf = team.goalFor || team.goalsFor || 0;
    const ga = team.goalAgainst || team.goalsAgainst || 0;

    return {
      teamAbbrev: team.teamAbbrev?.default || team.teamAbbrev,
      goalsPerGame: gf / gp,
      goalsAgainstPerGame: ga / gp,
    };
  });

  // If we have club stats for this team, we can calculate additional rankings
  // For now, we'll use placeholder rankings for stats we can't rank without all teams' club stats
  const hasClubStats = clubStats?.skaters?.length > 0;

  // Helper to get rank
  const getRank = (metric: string, higherIsBetter: boolean = true) => {
    const sorted = [...allTeamsMetrics]
      .filter((t: any) => t[metric] !== undefined)
      .sort((a: any, b: any) => higherIsBetter ? b[metric] - a[metric] : a[metric] - b[metric]);

    const teamIndex = sorted.findIndex((t: any) => t.teamAbbrev === teamAbbrev);
    return teamIndex >= 0 ? teamIndex + 1 : undefined;
  };

  // Return rankings for available stats
  // For stats we can calculate from club data, use estimated rankings based on goals
  const goalsRank = getRank('goalsPerGame', true);
  const goalsAgainstRank = getRank('goalsAgainstPerGame', false);

  return {
    goalsPerGameRank: goalsRank,
    goalsAgainstPerGameRank: goalsAgainstRank,
    // Estimated rankings based on offensive/defensive performance
    shotsPerGameRank: hasClubStats ? goalsRank : undefined,
    shotsAgainstPerGameRank: hasClubStats ? goalsAgainstRank : undefined,
    shootingPctRank: hasClubStats ? goalsRank : undefined,
    savePctRank: hasClubStats ? goalsAgainstRank : undefined,
    powerPlayPctRank: hasClubStats ? goalsRank : undefined,
    penaltyKillPctRank: hasClubStats ? goalsAgainstRank : undefined,
    powerPlayGoalsRank: hasClubStats ? goalsRank : undefined,
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
