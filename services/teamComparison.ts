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

    // Fetch standings data if not provided
    let standings = null;
    if (standingsData) {
      standings = standingsData.standings || standingsData;
    } else {
      const standingsRes = await fetch('https://api-web.nhle.com/v1/standings/now');
      if (standingsRes.ok) {
        const data = await standingsRes.json();
        standings = data.standings || [];
      }
    }

    // Find team in standings
    const teamStanding = standings?.find(
      (t: any) => (t.teamAbbrev?.default || t.teamAbbrev) === teamAbbrev
    );

    if (!teamStanding) {
      throw new Error(`Team ${teamAbbrev} not found in standings`);
    }

    // Build stats object from standings data (NHL API only provides basic stats)
    return buildTeamStats(teamId, teamAbbrev, standings, teamStanding);
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
  standingData: any
): TeamComparisonStats {
  const gamesPlayed = standingData?.gamesPlayed || 1;
  const goalsFor = standingData?.goalFor || standingData?.goalsFor || 0;
  const goalsAgainst = standingData?.goalAgainst || standingData?.goalsAgainst || 0;
  const wins = standingData?.wins || 0;
  const losses = standingData?.losses || 0;
  const otLosses = standingData?.otLosses || 0;
  const points = standingData?.points || 0;
  const pointsPct = points / (gamesPlayed * 2);

  // Calculate rankings across all teams
  const teamRankings = calculateAllRankings(allTeamsStandings, teamAbbrev);

  // Estimate shots based on goals (NHL API doesn't provide shot data in standings)
  // Better offensive teams generally take more shots
  const goalsForPerGame = goalsFor / gamesPlayed;
  const goalsAgainstPerGame = goalsAgainst / gamesPlayed;
  const shotsForPerGame = Math.max(28, Math.min(34, 28 + (goalsForPerGame - 2.5) * 2));
  const shotsAgainstPerGame = Math.max(28, Math.min(34, 28 + (goalsAgainstPerGame - 2.5) * 2));

  // Calculate shooting and save percentages
  const totalShotsFor = shotsForPerGame * gamesPlayed;
  const totalShotsAgainst = shotsAgainstPerGame * gamesPlayed;
  const shootingPct = (goalsFor / totalShotsFor) * 100;
  const savePct = 1 - (goalsAgainst / totalShotsAgainst);

  // Special teams percentages (from standings API)
  const powerPlayPct = (standingData?.powerPlayPct || standingData?.powerPlayPctg || 0) * 100;
  const penaltyKillPct = (standingData?.penaltyKillPct || standingData?.penaltyKillPctg || 0) * 100;

  // Estimate PP and PK opportunities based on games played
  const avgPPOpportunitiesPerGame = 3.5;
  const totalPPOpportunities = gamesPlayed * avgPPOpportunitiesPerGame;
  const powerPlayGoals = Math.round((powerPlayPct / 100) * totalPPOpportunities);

  // Offense stats
  const offense: OffenseStats = {
    goalsPerGame: goalsForPerGame,
    goalsPerGameRank: teamRankings.goalsPerGameRank,
    shotsPerGame: shotsForPerGame,
    shotsPerGameRank: teamRankings.shotsPerGameRank,
    shootingPct: shootingPct,
    shootingPctRank: teamRankings.shootingPctRank,
    powerPlayGoals: powerPlayGoals,
    powerPlayGoalsRank: teamRankings.powerPlayGoalsRank,
    powerPlayPct: powerPlayPct,
    powerPlayPctRank: teamRankings.powerPlayPctRank,
    scoringFirst: wins / gamesPlayed * 100, // Estimate based on win rate
    scoringFirstRank: teamRankings.scoringFirstRank,
  };

  // Defense stats
  const defense: DefenseStats = {
    goalsAgainstPerGame: goalsAgainstPerGame,
    goalsAgainstPerGameRank: teamRankings.goalsAgainstPerGameRank,
    shotsAgainstPerGame: shotsAgainstPerGame,
    shotsAgainstPerGameRank: teamRankings.shotsAgainstPerGameRank,
    penaltyKillPct: penaltyKillPct,
    penaltyKillPctRank: teamRankings.penaltyKillPctRank,
    blockedShots: gamesPlayed * 15, // Estimate: ~15 blocks per game
    blockedShotsRank: teamRankings.blockedShotsRank,
    takeaways: gamesPlayed * 8, // Estimate: ~8 takeaways per game
    takeawaysRank: teamRankings.takeawaysRank,
    hits: gamesPlayed * 22, // Estimate: ~22 hits per game
    hitsRank: teamRankings.hitsRank,
  };

  // Special Teams stats
  const totalPKOpportunities = gamesPlayed * avgPPOpportunitiesPerGame; // Opponents' PP opportunities
  const shorthandedGoals = Math.round(gamesPlayed * 0.2); // Estimate: ~0.2 SH goals per game for good teams

  const specialTeams: SpecialTeamsStats = {
    powerPlayOpportunities: totalPPOpportunities,
    powerPlayOpportunitiesRank: teamRankings.powerPlayOpportunitiesRank,
    powerPlayPct: powerPlayPct,
    powerPlayPctRank: teamRankings.powerPlayPctRank,
    penaltyKillPct: penaltyKillPct,
    penaltyKillPctRank: teamRankings.penaltyKillPctRank,
    shorthandedGoals: shorthandedGoals,
    shorthandedGoalsRank: teamRankings.shorthandedGoalsRank,
    powerPlayGoalsFor: powerPlayGoals,
    powerPlayGoalsForRank: teamRankings.powerPlayGoalsRank,
    powerPlayGoalsAgainst: Math.round((1 - penaltyKillPct / 100) * totalPKOpportunities),
    powerPlayGoalsAgainstRank: teamRankings.powerPlayGoalsAgainstRank,
  };

  // Advanced stats (estimated from available data)
  const shotsOnGoalPct = (totalShotsFor / (totalShotsFor + totalShotsAgainst)) * 100;
  const pdo = shootingPct + (savePct * 100);

  const advanced: AdvancedStats = {
    corsiForPct: shotsOnGoalPct, // Using SOG% as proxy for Corsi
    corsiForPctRank: teamRankings.corsiForPctRank,
    fenwickForPct: shotsOnGoalPct * 0.98, // Fenwick slightly lower
    fenwickForPctRank: teamRankings.fenwickForPctRank,
    pdo: pdo,
    pdoRank: teamRankings.pdoRank,
    expectedGoalsFor: goalsForPerGame, // Using actual goals as proxy for xG
    expectedGoalsForRank: teamRankings.expectedGoalsForRank,
    expectedGoalsAgainst: goalsAgainstPerGame,
    expectedGoalsAgainstRank: teamRankings.expectedGoalsAgainstRank,
    highDangerChancesFor: shotsForPerGame * 0.30, // ~30% of shots are high danger
    highDangerChancesForRank: teamRankings.highDangerChancesForRank,
    highDangerChancesAgainst: shotsAgainstPerGame * 0.30,
    highDangerChancesAgainstRank: teamRankings.highDangerChancesAgainstRank,
    shotQuality: shootingPct,
    shotQualityRank: teamRankings.shotQualityRank,
  };

  // Goaltending stats
  const goaltending: GoaltendingStats = {
    savePct: savePct,
    savePctRank: teamRankings.savePctRank,
    goalsAgainstAverage: goalsAgainstPerGame,
    goalsAgainstAverageRank: teamRankings.goalsAgainstPerGameRank,
    shutouts: Math.round(gamesPlayed * 0.08), // Estimate: ~8% of games are shutouts for good teams
    shutoutsRank: teamRankings.shutoutsRank,
    qualityStarts: Math.round(gamesPlayed * 0.55), // Estimate: ~55% quality start rate
    qualityStartsRank: teamRankings.qualityStartsRank,
    highDangerSavePct: Math.max(0, savePct - 0.08), // HD save% ~8% lower than overall
    highDangerSavePctRank: teamRankings.highDangerSavePctRank,
    reboundControl: 50 + (savePct - 0.91) * 200, // Normalized around 50
    reboundControlRank: teamRankings.reboundControlRank,
  };

  // Discipline stats (estimated based on team performance)
  const penaltiesPerGame = 3.0 + (1 - pointsPct) * 0.5; // More penalties for worse teams
  const discipline: DisciplineStats = {
    penaltiesPerGame: penaltiesPerGame,
    penaltiesPerGameRank: teamRankings.penaltiesPerGameRank,
    penaltyMinutes: penaltiesPerGame * gamesPlayed * 2, // ~2 mins per penalty
    penaltyMinutesRank: teamRankings.penaltyMinutesRank,
    minorPenalties: Math.round(penaltiesPerGame * gamesPlayed * 0.85), // 85% are minors
    minorPenaltiesRank: teamRankings.minorPenaltiesRank,
    majorPenalties: Math.round(penaltiesPerGame * gamesPlayed * 0.05), // 5% are majors
    majorPenaltiesRank: teamRankings.majorPenaltiesRank,
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
function calculateAllRankings(allTeamsStandings: any[], teamAbbrev: string): any {
  // Calculate metrics for all teams
  const allTeamsMetrics = allTeamsStandings.map((team: any) => {
    const gp = team.gamesPlayed || 1;
    const gf = team.goalFor || team.goalsFor || 0;
    const ga = team.goalAgainst || team.goalsAgainst || 0;
    const pts = team.points || 0;
    const wins = team.wins || 0;
    const ppPct = (team.powerPlayPct || team.powerPlayPctg || 0) * 100;
    const pkPct = (team.penaltyKillPct || team.penaltyKillPctg || 0) * 100;

    const goalsPerGame = gf / gp;
    const goalsAgainstPerGame = ga / gp;
    const shotsForPerGame = Math.max(28, Math.min(34, 28 + (goalsPerGame - 2.5) * 2));
    const shotsAgainstPerGame = Math.max(28, Math.min(34, 28 + (goalsAgainstPerGame - 2.5) * 2));
    const totalShotsFor = shotsForPerGame * gp;
    const totalShotsAgainst = shotsAgainstPerGame * gp;
    const shootingPct = (gf / totalShotsFor) * 100;
    const savePct = 1 - (ga / totalShotsAgainst);
    const sogPct = (totalShotsFor / (totalShotsFor + totalShotsAgainst)) * 100;
    const pdo = shootingPct + (savePct * 100);
    const pointsPct = pts / (gp * 2);
    const penaltiesPerGame = 3.0 + (1 - pointsPct) * 0.5;

    return {
      teamAbbrev: team.teamAbbrev?.default || team.teamAbbrev,
      goalsPerGame,
      goalsAgainstPerGame,
      shotsPerGame: shotsForPerGame,
      shotsAgainstPerGame,
      shootingPct,
      savePct,
      powerPlayPct: ppPct,
      penaltyKillPct: pkPct,
      powerPlayGoals: Math.round((ppPct / 100) * gp * 3.5),
      sogPct,
      pdo,
      penaltiesPerGame,
      penaltyMinutes: penaltiesPerGame * gp * 2,
    };
  });

  // Helper to get rank
  const getRank = (metric: string, higherIsBetter: boolean = true) => {
    const sorted = [...allTeamsMetrics]
      .filter((t: any) => t[metric] !== undefined)
      .sort((a: any, b: any) => higherIsBetter ? b[metric] - a[metric] : a[metric] - b[metric]);

    const teamIndex = sorted.findIndex((t: any) => t.teamAbbrev === teamAbbrev);
    return teamIndex >= 0 ? teamIndex + 1 : undefined;
  };

  return {
    goalsPerGameRank: getRank('goalsPerGame', true),
    goalsAgainstPerGameRank: getRank('goalsAgainstPerGame', false),
    shotsPerGameRank: getRank('shotsPerGame', true),
    shotsAgainstPerGameRank: getRank('shotsAgainstPerGame', false),
    shootingPctRank: getRank('shootingPct', true),
    savePctRank: getRank('savePct', true),
    powerPlayPctRank: getRank('powerPlayPct', true),
    penaltyKillPctRank: getRank('penaltyKillPct', true),
    powerPlayGoalsRank: getRank('powerPlayGoals', true),
    powerPlayOpportunitiesRank: undefined, // Not available
    shorthandedGoalsRank: undefined,
    powerPlayGoalsAgainstRank: undefined,
    scoringFirstRank: undefined,
    blockedShotsRank: undefined,
    takeawaysRank: undefined,
    hitsRank: undefined,
    corsiForPctRank: getRank('sogPct', true),
    fenwickForPctRank: getRank('sogPct', true),
    pdoRank: getRank('pdo', true),
    expectedGoalsForRank: getRank('goalsPerGame', true),
    expectedGoalsAgainstRank: getRank('goalsAgainstPerGame', false),
    highDangerChancesForRank: undefined,
    highDangerChancesAgainstRank: undefined,
    shotQualityRank: getRank('shootingPct', true),
    shutoutsRank: undefined,
    qualityStartsRank: undefined,
    highDangerSavePctRank: undefined,
    reboundControlRank: undefined,
    penaltiesPerGameRank: getRank('penaltiesPerGame', false),
    penaltyMinutesRank: getRank('penaltyMinutes', false),
    minorPenaltiesRank: undefined,
    majorPenaltiesRank: undefined,
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
