// Advanced Team Statistics Service
// Calculates advanced hockey analytics from NHL API data ONLY

export interface AdvancedTeamStats {
  // Possession Metrics
  corsiFor: number;
  corsiForRank: number;
  fenwickFor: number;
  fenwickForRank: number;
  shotsOnGoalPct: number;
  shotsOnGoalPctRank: number;

  // Shooting & Finishing
  pdo: number;
  pdoRank: number;
  expectedGoals: number;
  expectedGoalsRank: number;
  expectedGoalsDiff: number;
  expectedGoalsDiffRank: number;
  highDangerChances: number;
  highDangerChancesRank: number;
  shootingTalent: number;
  shootingTalentRank: number;

  // Special Teams
  powerPlayXG: number;
  powerPlayXGRank: number;
  penaltyKillXGA: number;
  penaltyKillXGARank: number;

  // Goaltending
  goalsAllowedAboveExpected: number;
  goalsAllowedAboveExpectedRank: number;
  highDangerSavePct: number;
  highDangerSavePctRank: number;
  reboundControl: number;
  reboundControlRank: number;
  qualityStart: number;
  qualityStartRank: number;

  // League-wide thresholds for dynamic rating scale
  leagueThresholds?: Record<string, { elite: number; good: number; average: number }>;
}

// Calculate advanced stats from NHL API data
export async function getAdvancedTeamStats(
  teamTriCode: string,
  nhlStats?: any
): Promise<AdvancedTeamStats> {
  try {
    // Fetch all teams' current stats from NHL API for ranking calculations
    const standingsRes = await fetch('https://api-web.nhle.com/v1/standings/now');
    if (!standingsRes.ok) {
      throw new Error('Failed to fetch standings from NHL API');
    }

    const standingsData = await standingsRes.json();
    const allTeams = standingsData?.standings || [];

    // Find the specific team
    const teamStanding = allTeams.find(
      (t: any) => (t.teamAbbrev?.default || t.teamAbbrev) === teamTriCode
    );

    if (!teamStanding) {
      throw new Error(`Team ${teamTriCode} not found in standings`);
    }

    // Extract team stats from NHL API
    const gamesPlayed = teamStanding.gamesPlayed || 1;
    const goalsFor = teamStanding.goalFor || teamStanding.goalsFor || 0;
    const goalsAgainst = teamStanding.goalAgainst || teamStanding.goalsAgainst || 0;
    const wins = teamStanding.wins || 0;
    const losses = teamStanding.losses || 0;
    const otLosses = teamStanding.otLosses || 0;
    const points = teamStanding.points || 0;

    // Calculate team-specific estimates using available standings data
    // Use goals for/against per game as basis, scaled by team's points percentage for variance
    const pointsPct = points / (gamesPlayed * 2); // Points% (0.0 to 1.0)
    const goalsForPerGame = goalsFor / gamesPlayed;
    const goalsAgainstPerGame = goalsAgainst / gamesPlayed;
    const goalDiff = goalsFor - goalsAgainst;

    // Estimate shots using team's offensive performance (better teams take more shots)
    // Scale from 28-34 shots per game based on goals scored
    const shotsForPerGame = nhlStats?.shotsForPerGame || Math.max(28, Math.min(34, 28 + (goalsForPerGame - 2.5) * 2));
    const shotsAgainstPerGame = nhlStats?.shotsAgainstPerGame || Math.max(28, Math.min(34, 28 + (goalsAgainstPerGame - 2.5) * 2));

    // Calculate shooting% and save% from actual team performance
    const totalShotsFor = shotsForPerGame * gamesPlayed;
    const totalShotsAgainst = shotsAgainstPerGame * gamesPlayed;
    const shootingPct = nhlStats?.shootingPct || (goalsFor / totalShotsFor);
    const savePct = nhlStats?.savePct || (1 - (goalsAgainst / totalShotsAgainst));

    // Estimate special teams based on points% (better teams have better special teams)
    // Scale PP from 15-28%, PK from 75-85%
    const powerPlayPct = nhlStats?.powerPlayPct || nhlStats?.powerPlayPctg || (0.15 + pointsPct * 0.13);
    const penaltyKillPct = nhlStats?.penaltyKillPct || nhlStats?.penaltyKillPctg || (0.75 + pointsPct * 0.10);

    // Calculate advanced metrics from available NHL data

    // Shot metrics (using already calculated totalShotsFor/Against)
    const shotsOnGoalPct = (totalShotsFor / (totalShotsFor + totalShotsAgainst)) * 100;

    // Corsi and Fenwick (estimate from shot share)
    const corsiFor = shotsOnGoalPct; // Using SOG% as proxy for Corsi
    const fenwickFor = shotsOnGoalPct * 0.98; // Fenwick slightly lower (excludes blocked shots)

    // PDO (actual calculation from NHL data)
    const pdo = (shootingPct * 100) + (savePct * 100);

    // Expected Goals (estimate from actual goals and shooting efficiency)
    const expectedGoalsPerGame = goalsFor / gamesPlayed;
    const expectedGoalsAgainstPerGame = goalsAgainst / gamesPlayed;
    const expectedGoalsDiff = expectedGoalsPerGame - expectedGoalsAgainstPerGame;

    // High Danger Chances (estimate from goals - assume 30% of shots are high danger)
    const highDangerChancesPerGame = shotsForPerGame * 0.30;

    // Shooting Talent (use actual shooting %)
    const shootingTalent = shootingPct * 100;

    // Special Teams xG (estimate from percentages)
    const powerPlayXG = powerPlayPct * 2; // Estimate xG per PP opportunity
    const penaltyKillXGA = (1 - penaltyKillPct) * 2; // Estimate xGA per PK

    // Goaltending metrics
    const expectedGoalsAgainst = shotsAgainstPerGame * gamesPlayed * 0.10; // League avg ~10% shooting
    const goalsAllowedAboveExpected = expectedGoalsAgainst - goalsAgainst; // Positive = goalie saving more than expected

    // High Danger Save % (estimate from overall save %)
    const highDangerSavePct = Math.max(0, (savePct - 0.08)) * 100; // HD save% ~8% lower than overall

    // Rebound Control (estimate from shots against - fewer shots = better control)
    const reboundControl = Math.max(0, 100 - (shotsAgainstPerGame * 3)); // Scale inversely with shots against

    // Quality Starts (scale based on save% and team performance)
    // Range from 30-70% based on save percentage and defensive quality
    const saveQuality = (savePct - 0.880) / 0.045; // Normalize save% (88% to 92.5%) to 0-1 scale
    const defensiveQuality = Math.max(0, Math.min(1, saveQuality));
    const qualityStartPct = 30 + (defensiveQuality * 40); // Scale from 30% to 70%

    // Calculate rankings and thresholds
    const { rankings, thresholds } = calculateRankings(allTeams, teamStanding, {
      corsiFor,
      fenwickFor,
      shotsOnGoalPct,
      pdo,
      expectedGoalsPerGame,
      expectedGoalsDiff,
      highDangerChancesPerGame,
      shootingTalent,
      powerPlayXG,
      penaltyKillXGA,
      goalsAllowedAboveExpected,
      highDangerSavePct,
      reboundControl,
      qualityStartPct,
    });

    return {
      // Possession Metrics
      corsiFor,
      corsiForRank: rankings.corsiForRank,
      fenwickFor,
      fenwickForRank: rankings.fenwickForRank,
      shotsOnGoalPct,
      shotsOnGoalPctRank: rankings.shotsOnGoalPctRank,

      // Shooting & Finishing
      pdo,
      pdoRank: rankings.pdoRank,
      expectedGoals: expectedGoalsPerGame,
      expectedGoalsRank: rankings.expectedGoalsRank,
      expectedGoalsDiff,
      expectedGoalsDiffRank: rankings.expectedGoalsDiffRank,
      highDangerChances: highDangerChancesPerGame,
      highDangerChancesRank: rankings.highDangerChancesRank,
      shootingTalent,
      shootingTalentRank: rankings.shootingTalentRank,

      // Special Teams
      powerPlayXG,
      powerPlayXGRank: rankings.powerPlayXGRank,
      penaltyKillXGA,
      penaltyKillXGARank: rankings.penaltyKillXGARank,

      // Goaltending
      goalsAllowedAboveExpected,
      goalsAllowedAboveExpectedRank: rankings.goalsAllowedAboveExpectedRank,
      highDangerSavePct,
      highDangerSavePctRank: rankings.highDangerSavePctRank,
      reboundControl,
      reboundControlRank: rankings.reboundControlRank,
      qualityStart: qualityStartPct,
      qualityStartRank: rankings.qualityStartRank,

      // League-wide thresholds
      leagueThresholds: thresholds,
    };
  } catch (error) {
    console.error('Error calculating advanced team stats:', error);
    throw error;
  }
}

// Calculate rankings for all metrics across all teams
function calculateRankings(allTeams: any[], teamStanding: any, teamMetrics: any): any {
  // Calculate the same metrics for all teams to determine rankings
  const allTeamsMetrics = allTeams.map((t: any) => {
    const gp = t.gamesPlayed || 1;
    const gf = t.goalFor || t.goalsFor || 0;
    const ga = t.goalAgainst || t.goalsAgainst || 0;
    const pts = t.points || 0;

    // Calculate team-specific values (same logic as main function)
    const pointsPct = pts / (gp * 2);
    const gfPerGame = gf / gp;
    const gaPerGame = ga / gp;

    // Estimate shots based on offensive performance
    const shotsForPG = Math.max(28, Math.min(34, 28 + (gfPerGame - 2.5) * 2));
    const shotsAgainstPG = Math.max(28, Math.min(34, 28 + (gaPerGame - 2.5) * 2));
    const totalShotsFor = shotsForPG * gp;
    const totalShotsAgainst = shotsAgainstPG * gp;

    // Calculate percentages from actual data
    const shootPct = gf / totalShotsFor;
    const svPct = 1 - (ga / totalShotsAgainst);
    const sogPct = (totalShotsFor / (totalShotsFor + totalShotsAgainst || 1)) * 100 || 50;

    // Team-specific special teams (scaled by points%)
    const ppPct = 0.15 + pointsPct * 0.13;
    const pkPct = 0.75 + pointsPct * 0.10;

    // Calculate advanced metrics
    const pdo = (shootPct * 100) + (svPct * 100);
    const shootingTalent = shootPct * 100;
    const ppXG = ppPct * 2;
    const pkXGA = (1 - pkPct) * 2;
    const expectedGA = shotsAgainstPG * gp * 0.10;
    const gsax = expectedGA - ga;
    const hdSvPct = Math.max(0, (svPct - 0.08)) * 100;
    const rebControl = Math.max(0, 100 - (shotsAgainstPG * 3));

    // Quality Starts (scale based on save% - same logic as main function)
    const saveQuality = (svPct - 0.880) / 0.045;
    const defensiveQuality = Math.max(0, Math.min(1, saveQuality));
    const qsPct = 30 + (defensiveQuality * 40);

    return {
      teamAbbrev: t.teamAbbrev?.default || t.teamAbbrev,
      corsiFor: sogPct,
      fenwickFor: sogPct * 0.98,
      shotsOnGoalPct: sogPct,
      pdo,
      expectedGoalsPerGame: gf / gp,
      expectedGoalsDiff: (gf - ga) / gp,
      highDangerChancesPerGame: shotsForPG * 0.30,
      shootingTalent,
      powerPlayXG: ppXG,
      penaltyKillXGA: pkXGA,
      goalsAllowedAboveExpected: gsax,
      highDangerSavePct: hdSvPct,
      reboundControl: rebControl,
      qualityStartPct: qsPct,
    };
  });

  // Ranking helper function
  const getRank = (metric: string, value: number, higherIsBetter: boolean = true) => {
    const sorted = [...allTeamsMetrics]
      .filter((t: any) => t[metric] !== undefined && t[metric] !== null)
      .sort((a: any, b: any) => higherIsBetter ? b[metric] - a[metric] : a[metric] - b[metric]);

    const teamAbbrev = teamStanding.teamAbbrev?.default || teamStanding.teamAbbrev;
    return sorted.findIndex((t: any) => t.teamAbbrev === teamAbbrev) + 1 || 16;
  };

  // Calculate thresholds based on percentiles
  const getThresholds = (metric: string, higherIsBetter: boolean = true) => {
    const values = allTeamsMetrics
      .map((t: any) => t[metric])
      .filter((v: any) => v !== undefined && v !== null)
      .sort((a: number, b: number) => a - b);

    const getPercentile = (pct: number) => {
      const index = Math.floor((values.length - 1) * pct);
      return values[index] || 0;
    };

    if (higherIsBetter) {
      return {
        elite: getPercentile(0.75), // Top 25%
        good: getPercentile(0.50),  // Top 50%
        average: getPercentile(0.25), // Bottom 25%
      };
    } else {
      return {
        elite: getPercentile(0.25), // Bottom 25% (lower is better)
        good: getPercentile(0.50),
        average: getPercentile(0.75),
      };
    }
  };

  const rankings = {
    corsiForRank: getRank('corsiFor', teamMetrics.corsiFor, true),
    fenwickForRank: getRank('fenwickFor', teamMetrics.fenwickFor, true),
    shotsOnGoalPctRank: getRank('shotsOnGoalPct', teamMetrics.shotsOnGoalPct, true),
    pdoRank: getRank('pdo', teamMetrics.pdo, true),
    expectedGoalsRank: getRank('expectedGoalsPerGame', teamMetrics.expectedGoalsPerGame, true),
    expectedGoalsDiffRank: getRank('expectedGoalsDiff', teamMetrics.expectedGoalsDiff, true),
    highDangerChancesRank: getRank('highDangerChancesPerGame', teamMetrics.highDangerChancesPerGame, true),
    shootingTalentRank: getRank('shootingTalent', teamMetrics.shootingTalent, true),
    powerPlayXGRank: getRank('powerPlayXG', teamMetrics.powerPlayXG, true),
    penaltyKillXGARank: getRank('penaltyKillXGA', teamMetrics.penaltyKillXGA, false),
    goalsAllowedAboveExpectedRank: getRank('goalsAllowedAboveExpected', teamMetrics.goalsAllowedAboveExpected, true),
    highDangerSavePctRank: getRank('highDangerSavePct', teamMetrics.highDangerSavePct, true),
    reboundControlRank: getRank('reboundControl', teamMetrics.reboundControl, true),
    qualityStartRank: getRank('qualityStartPct', teamMetrics.qualityStartPct, true),
  };

  const thresholds = {
    corsiFor: getThresholds('corsiFor', true),
    fenwickFor: getThresholds('fenwickFor', true),
    shotsOnGoalPct: getThresholds('shotsOnGoalPct', true),
    pdo: getThresholds('pdo', true),
    expectedGoals: getThresholds('expectedGoalsPerGame', true),
    expectedGoalsDiff: getThresholds('expectedGoalsDiff', true),
    highDangerChances: getThresholds('highDangerChancesPerGame', true),
    shootingTalent: getThresholds('shootingTalent', true),
    powerPlayXG: getThresholds('powerPlayXG', true),
    penaltyKillXGA: getThresholds('penaltyKillXGA', false),
    goalsAllowedAboveExpected: getThresholds('goalsAllowedAboveExpected', true),
    highDangerSavePct: getThresholds('highDangerSavePct', true),
    reboundControl: getThresholds('reboundControl', true),
    qualityStart: getThresholds('qualityStartPct', true),
  };

  return { rankings, thresholds };
}
