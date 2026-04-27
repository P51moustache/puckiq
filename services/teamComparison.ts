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

/**
 * Current NHL season encoded as start-end years (e.g. 20252026).
 * Derived from today's date — Aug→Dec uses next-year suffix; Jan→Jul uses
 * current calendar year as the END year. Matches scripts/sync naming.
 */
function currentSeasonId(): number {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexed
  // NHL season starts in October; treat July (month 6) onward as the "next" season starting.
  if (m >= 6) return Number(`${y}${y + 1}`);
  return Number(`${y - 1}${y}`);
}

/**
 * Fetch comprehensive team statistics for comparison
 */
export async function getTeamComparisonData(
  teamAbbrev: string,
  standingsData?: any
): Promise<TeamComparisonStats> {
  // --- Supabase-first: standings + team summary + skater/goalie aggregates ---
  try {
    const season = currentSeasonId();
    const [standingsRes, summaryRes, penaltiesRes, skatersRes, goaliesRes] = await Promise.all([
      supabase
        .from('standings')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(32),
      supabase
        .from('team_stat_categories')
        .select('data')
        .eq('team_abbrev', teamAbbrev)
        .eq('stat_category', 'summary')
        .limit(1),
      // Authoritative penalty stats from NHL /team/penalties endpoint.
      // Populated by the daily sync-stat-categories job.
      supabase
        .from('team_stat_categories')
        .select('data')
        .eq('team_abbrev', teamAbbrev)
        .eq('stat_category', 'penalties')
        .limit(1),
      // Skater/goalie aggregates only used as a fallback when the
      // penalties category isn't populated yet.
      supabase
        .from('skater_season_stats')
        .select('power_play_goals, pim, games_played')
        .eq('team_abbrev', teamAbbrev)
        .eq('season', season),
      supabase
        .from('goalie_season_stats')
        .select('shutouts, pim')
        .eq('team_abbrev', teamAbbrev)
        .eq('season', season),
    ]);

    if (!standingsRes.error && standingsRes.data && standingsRes.data.length > 0) {
      const allStandings = standingsRes.data;
      const teamStanding = allStandings.find((t: any) => t.team_abbrev === teamAbbrev);

      if (teamStanding) {
        // Extract team summary from team_stat_categories JSONB
        let teamSummary: any = null;
        if (!summaryRes.error && summaryRes.data && summaryRes.data.length > 0) {
          teamSummary = summaryRes.data[0].data;
        }

        // Authoritative penalty stats from NHL /team/penalties endpoint.
        // Keys per the API response:
        //   penalties      — total penalty count this season
        //   penaltyMinutes — total PIM this season
        //   gamesPlayed    — denominator for per-game rates
        // (No timesShortHanded here — that's on /team/penaltykill, which
        // counts opponent PP opportunities, slightly different concept.)
        let realPenaltyCountPerGame: number | null = null;
        let realPenaltyMinutesTotal: number | null = null;
        if (!penaltiesRes.error && penaltiesRes.data && penaltiesRes.data.length > 0) {
          const pData = (penaltiesRes.data[0] as any).data ?? {};
          const count = pData.penalties;
          const gp = pData.gamesPlayed;
          const pim = pData.penaltyMinutes;
          if (typeof count === 'number' && typeof gp === 'number' && gp > 0) {
            realPenaltyCountPerGame = count / gp;
          }
          if (typeof pim === 'number' && pim > 0) {
            realPenaltyMinutesTotal = pim;
          }
        }

        // Aggregate skater + goalie season totals (used for PP goals and
        // as a fallback for PIM if the penalties category isn't synced).
        let clubStats: any = null;
        if (!skatersRes.error && skatersRes.data && skatersRes.data.length > 0) {
          let totalPpGoals = 0;
          let totalSkaterPim = 0;
          for (const s of skatersRes.data as any[]) {
            totalPpGoals += s.power_play_goals || 0;
            totalSkaterPim += s.pim || 0;
          }
          let totalGoaliePim = 0;
          let totalShutouts = 0;
          if (!goaliesRes.error && goaliesRes.data) {
            for (const g of goaliesRes.data as any[]) {
              totalGoaliePim += g.pim || 0;
              totalShutouts += g.shutouts || 0;
            }
          }
          clubStats = {
            powerPlayGoals: totalPpGoals,
            penaltyMinutes: totalSkaterPim + totalGoaliePim,
            shutouts: totalShutouts,
            realPenaltyCountPerGame,
            realPenaltyMinutesTotal,
          };
        }

        // Transform Supabase standings row to NHL API-like shape for buildTeamStats
        const standingsForBuilder = allStandings.map((s: any) => ({
          teamAbbrev: s.team_abbrev,
          teamId: s.team_id,
          gamesPlayed: s.games_played,
          wins: s.wins,
          losses: s.losses,
          otLosses: s.ot_losses,
          points: s.points,
          goalFor: s.goals_for,
          goalAgainst: s.goals_against,
        }));

        const teamStandingMapped = standingsForBuilder.find((t: any) => t.teamAbbrev === teamAbbrev);
        if (teamStandingMapped) {
          const teamId = teamSummary?.teamId ?? teamStanding.team_id ?? 0;
          console.log(`[TEAM COMPARISON] [SUPABASE] Loaded stats for ${teamAbbrev}`);
          return buildTeamStats(teamId, teamAbbrev, standingsForBuilder, teamStandingMapped, clubStats, teamSummary);
        }
      }
    }
    console.warn(`[TEAM COMPARISON] [SUPABASE] No data for ${teamAbbrev}`);
  } catch (sbErr) {
    console.warn(`[TEAM COMPARISON] [SUPABASE] Error querying data`, sbErr);
  }

  // Supabase-only: no NHL API fallback (deprecated service)
  throw new Error(`[TEAM COMPARISON] No Supabase data available for ${teamAbbrev}`);
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

  // Aggregated club stats (computed by the caller from skater + goalie season tables)
  const totalPowerPlayGoals = clubStats?.powerPlayGoals ?? 0;
  const totalPenaltyMinutes = clubStats?.penaltyMinutes ?? 0;
  const totalShutouts = clubStats?.shutouts ?? 0;

  // Authoritative real penalty count + PIM season total from NHL API.
  // Null when team_stat_categories.penalties hasn't synced yet — caller will hide the row.
  const realPenaltyCountPerGame: number | null = clubStats?.realPenaltyCountPerGame ?? null;
  const realPenaltyMinutesTotal: number | null = clubStats?.realPenaltyMinutesTotal ?? null;

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
    shutouts: totalShutouts,
    shutoutsRank: undefined,
    qualityStarts: 0, // Not available
    qualityStartsRank: undefined,
    highDangerSavePct: 0, // Not available
    highDangerSavePctRank: undefined,
    reboundControl: 0, // Not available
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

  // Helper to get rank
  const getRank = (metric: string, higherIsBetter: boolean = true) => {
    const sorted = [...allTeamsMetrics]
      .filter((t: any) => t[metric] !== undefined)
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
