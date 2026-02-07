/**
 * Model-Aware Prediction Service
 * Wraps existing prediction functions to use custom model weights
 */

import type {
  PredictionModel,
  PlayerWeights,
  ConfidenceWeights,
  GameData,
  StandingsData,
  TeamStandings,
  EnrichedGame,
  RecentFormStats,
  SituationalFactors,
  TeamPredictionStats,
  PlayerPredictionFactors,
} from '../types/predictions';
import {
  createStandingsMap,
  CONFIDENCE_WEIGHTS,
  PLAYER_WEIGHTS,
} from '../utils/predictionUtils';
import { getMatchupRecentForm } from '../utils/recentForm';
import { calculateSituationalFactors } from '../utils/situationalFactors';
import { fetchAllTeamStats } from '../utils/teamStatsForPrediction';
import { getPlayerPredictionFactors } from './playerPrediction';

/**
 * Calculate confidence score with custom weights (including player weights)
 * This is a model-aware version that accepts both confidence weights and player weights
 */
export function calculateConfidenceScoreWithModel(
  game: GameData,
  homeTeam: TeamStandings | null,
  awayTeam: TeamStandings | null,
  weights: ConfidenceWeights,
  playerWeights: PlayerWeights,
  recentForm?: { home: RecentFormStats; away: RecentFormStats },
  situationalFactors?: SituationalFactors,
  teamStats?: { home: TeamPredictionStats | null; away: TeamPredictionStats | null },
  playerFactors?: PlayerPredictionFactors
): number {
  let score = 50; // Base score

  if (!homeTeam || !awayTeam) return score;

  // Factor 1: Standings differential (season-long stats)
  const pointDiff = (homeTeam.pointPctg || 0.5) - (awayTeam.pointPctg || 0.5);
  score += pointDiff * weights.standingsDifferential;

  // Factor 2: Home ice advantage
  score += weights.homeIceAdvantage;

  // Factor 3: Win streaks
  const homeStreakValue = getStreakValue(homeTeam.streakCode);
  const awayStreakValue = getStreakValue(awayTeam.streakCode);
  score += (homeStreakValue - awayStreakValue) * weights.streakImpact;

  // Factor 4: Goal differential per game
  const homeGDPerGame = getGoalDifferentialPerGame(homeTeam);
  const awayGDPerGame = getGoalDifferentialPerGame(awayTeam);
  score += (homeGDPerGame - awayGDPerGame) * weights.goalDifferentialImpact;

  // Factor 5: Recent form (L5/L10 games)
  if (recentForm && recentForm.home.gamesPlayed > 0 && recentForm.away.gamesPlayed > 0) {
    const recentFormDiff = recentForm.home.pointPctg - recentForm.away.pointPctg;
    score += recentFormDiff * weights.recentFormImpact;
  }

  // Factor 6: Situational factors (back-to-back, rest days)
  if (situationalFactors) {
    // Apply back-to-back penalty
    if (situationalFactors.homeBackToBack && !situationalFactors.awayBackToBack) {
      score -= weights.backToBackPenalty;
    } else if (situationalFactors.awayBackToBack && !situationalFactors.homeBackToBack) {
      score += weights.backToBackPenalty;
    }

    // Apply rest advantage
    const restDaysDiff = situationalFactors.homeRestDays - situationalFactors.awayRestDays;
    score += Math.min(Math.max(restDaysDiff, -3), 3) * weights.restAdvantage;
  }

  // Factor 7: Special Teams (PP% + PK%) - Real NHL data
  if (teamStats?.home && teamStats?.away) {
    const homeSpecialTeams = (teamStats.home.powerPlayPct + teamStats.home.penaltyKillPct) / 2;
    const awaySpecialTeams = (teamStats.away.powerPlayPct + teamStats.away.penaltyKillPct) / 2;
    const specialTeamsDiff = homeSpecialTeams - awaySpecialTeams;
    score += specialTeamsDiff * weights.specialTeamsImpact;
  }

  // Factor 8: Shot Differential - Real NHL data
  if (teamStats?.home && teamStats?.away) {
    const homeNetShots = teamStats.home.shotsForPerGame - teamStats.home.shotsAgainstPerGame;
    const awayNetShots = teamStats.away.shotsForPerGame - teamStats.away.shotsAgainstPerGame;
    const shotDiff = homeNetShots - awayNetShots;
    score += (shotDiff * 0.5) * weights.shotDifferentialImpact;
  }

  // Factor 9: Player-based factors (using MODEL's player weights)
  if (playerFactors) {
    // Goalie matchup impact
    if (playerFactors.goalieMatchup) {
      score += playerFactors.goalieMatchup.confidenceImpact * playerWeights.goalieMatchupImpact;
    }

    // Hot/cold players differential
    if (playerFactors.homeHotPlayers && playerFactors.awayHotPlayers) {
      const heatDiff = playerFactors.homeHotPlayers.overallHeatIndex - playerFactors.awayHotPlayers.overallHeatIndex;
      score += heatDiff * playerWeights.hotPlayersImpact;
    }
  }

  // Normalize to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Extract numeric value from streak code with diminishing returns scaling
 */
function getStreakValue(streakCode?: string): number {
  if (!streakCode) return 0;

  const isWin = streakCode.startsWith('W');
  const isLoss = streakCode.startsWith('L');
  const streakNum = parseInt(streakCode.substring(1)) || 0;

  const cappedStreak = Math.min(streakNum, 10);
  const scaledImpact = Math.pow(cappedStreak, 0.8);

  if (isWin) return scaledImpact;
  if (isLoss) return -scaledImpact;
  return 0;
}

/**
 * Calculate goal differential per game
 */
function getGoalDifferentialPerGame(team: TeamStandings): number {
  const gamesPlayed = team.gamesPlayed || 1;
  const goalDiff = (team.goalFor || 0) - (team.goalAgainst || 0);
  return goalDiff / gamesPlayed;
}

/**
 * Predict with a specific model
 * Returns the confidence score for a single game using the model's weights
 */
export async function predictWithModel(
  model: PredictionModel,
  game: GameData,
  standings: StandingsData | null
): Promise<number> {
  if (!standings?.standings) {
    return 50;
  }

  const standingsMap = createStandingsMap(standings);
  const homeAbbrev = game.homeTeam?.abbrev || '';
  const awayAbbrev = game.awayTeam?.abbrev || '';
  const gameDate = game.startTimeUTC?.split('T')[0] || '';

  const homeTeam = standingsMap.get(homeAbbrev);
  const awayTeam = standingsMap.get(awayAbbrev);

  if (!homeTeam || !awayTeam) {
    return 50;
  }

  try {
    // Fetch all enhanced data
    const allTeamStats = await fetchAllTeamStats();
    const recentFormData = await getMatchupRecentForm(homeAbbrev, awayAbbrev, 10);
    const situationalData = gameDate
      ? calculateSituationalFactors(gameDate, recentFormData.homeGames, recentFormData.awayGames)
      : undefined;
    const teamStats = {
      home: allTeamStats.get(homeAbbrev) || null,
      away: allTeamStats.get(awayAbbrev) || null,
    };
    const playerFactors = await getPlayerPredictionFactors(homeAbbrev, awayAbbrev);

    // Calculate with model weights
    return calculateConfidenceScoreWithModel(
      game,
      homeTeam,
      awayTeam,
      model.weights,
      model.playerWeights,
      recentFormData,
      situationalData,
      teamStats,
      playerFactors
    );
  } catch (error) {
    console.error('[MODEL_PREDICTION] Error in predictWithModel:', error);
    // Fallback to basic calculation with model weights
    return calculateConfidenceScoreWithModel(
      game,
      homeTeam,
      awayTeam,
      model.weights,
      model.playerWeights
    );
  }
}

/**
 * Get Lock of the Day using a specific model's weights
 */
export async function getLockWithModel(
  model: PredictionModel,
  games: GameData[],
  standings: StandingsData | null
): Promise<EnrichedGame | null> {
  if (!games || games.length === 0 || !standings?.standings) {
    return null;
  }

  const standingsMap = createStandingsMap(standings);
  let bestGame: EnrichedGame | null = null;
  let highestScore = 0;

  const allTeamStats = await fetchAllTeamStats();

  for (const game of games) {
    const homeAbbrev = game.homeTeam?.abbrev || '';
    const awayAbbrev = game.awayTeam?.abbrev || '';
    const gameDate = game.startTimeUTC?.split('T')[0] || '';

    const homeTeam = standingsMap.get(homeAbbrev);
    const awayTeam = standingsMap.get(awayAbbrev);

    if (homeTeam && awayTeam && gameDate) {
      try {
        const recentFormData = await getMatchupRecentForm(homeAbbrev, awayAbbrev, 10);
        const situationalData = calculateSituationalFactors(
          gameDate,
          recentFormData.homeGames,
          recentFormData.awayGames
        );
        const teamStats = {
          home: allTeamStats.get(homeAbbrev) || null,
          away: allTeamStats.get(awayAbbrev) || null,
        };
        const playerFactors = await getPlayerPredictionFactors(homeAbbrev, awayAbbrev);

        // Use model weights instead of defaults
        const confidenceScore = calculateConfidenceScoreWithModel(
          game,
          homeTeam,
          awayTeam,
          model.weights,
          model.playerWeights,
          recentFormData,
          situationalData,
          teamStats,
          playerFactors
        );

        if (confidenceScore > highestScore) {
          highestScore = confidenceScore;
          bestGame = {
            ...game,
            confidenceScore,
            homeTeam: { ...homeTeam, abbrev: homeAbbrev },
            awayTeam: { ...awayTeam, abbrev: awayAbbrev },
          };
        }
      } catch (error) {
        console.error(`[MODEL_PREDICTION] Error processing game ${game.id}:`, error);
        const confidenceScore = calculateConfidenceScoreWithModel(
          game,
          homeTeam,
          awayTeam,
          model.weights,
          model.playerWeights
        );
        if (confidenceScore > highestScore) {
          highestScore = confidenceScore;
          bestGame = {
            ...game,
            confidenceScore,
            homeTeam: { ...homeTeam, abbrev: homeAbbrev },
            awayTeam: { ...awayTeam, abbrev: awayAbbrev },
          };
        }
      }
    }
  }

  return bestGame;
}

/**
 * Get Smart Picks using a specific model's weights
 */
export async function getSmartPicksWithModel(
  model: PredictionModel,
  games: GameData[],
  standings: StandingsData | null,
  count: number = 4,
  excludeGameId?: string | number | null
): Promise<EnrichedGame[]> {
  if (!games || games.length === 0 || !standings?.standings) {
    return [];
  }

  const standingsMap = createStandingsMap(standings);
  const scoredGames: EnrichedGame[] = [];

  const allTeamStats = await fetchAllTeamStats();

  for (const game of games) {
    // Skip excluded game (usually the lock of the day)
    if (excludeGameId && String(game.id) === String(excludeGameId)) {
      continue;
    }

    const homeAbbrev = game.homeTeam?.abbrev || '';
    const awayAbbrev = game.awayTeam?.abbrev || '';
    const gameDate = game.startTimeUTC?.split('T')[0] || '';

    const homeTeam = standingsMap.get(homeAbbrev);
    const awayTeam = standingsMap.get(awayAbbrev);

    if (homeTeam && awayTeam && gameDate) {
      try {
        const recentFormData = await getMatchupRecentForm(homeAbbrev, awayAbbrev, 10);
        const situationalData = calculateSituationalFactors(
          gameDate,
          recentFormData.homeGames,
          recentFormData.awayGames
        );
        const teamStats = {
          home: allTeamStats.get(homeAbbrev) || null,
          away: allTeamStats.get(awayAbbrev) || null,
        };
        const playerFactors = await getPlayerPredictionFactors(homeAbbrev, awayAbbrev);

        const confidenceScore = calculateConfidenceScoreWithModel(
          game,
          homeTeam,
          awayTeam,
          model.weights,
          model.playerWeights,
          recentFormData,
          situationalData,
          teamStats,
          playerFactors
        );

        scoredGames.push({
          ...game,
          confidenceScore,
          homeTeam: { ...homeTeam, abbrev: homeAbbrev },
          awayTeam: { ...awayTeam, abbrev: awayAbbrev },
        });
      } catch (error) {
        console.error(`[MODEL_PREDICTION] Error processing game ${game.id}:`, error);
        const confidenceScore = calculateConfidenceScoreWithModel(
          game,
          homeTeam,
          awayTeam,
          model.weights,
          model.playerWeights
        );
        scoredGames.push({
          ...game,
          confidenceScore,
          homeTeam: { ...homeTeam, abbrev: homeAbbrev },
          awayTeam: { ...awayTeam, abbrev: awayAbbrev },
        });
      }
    }
  }

  return scoredGames
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, count);
}

/**
 * Create a "Classic" model that uses default weights
 * This can be used to compare custom models against the baseline
 */
export function createClassicModel(): PredictionModel {
  const now = new Date().toISOString();
  return {
    id: 'classic',
    name: 'PuckIQ Classic',
    createdAt: now,
    updatedAt: now,
    weights: { ...CONFIDENCE_WEIGHTS },
    playerWeights: {
      goalieMatchupImpact: PLAYER_WEIGHTS.goalieMatchupImpact,
      hotPlayersImpact: PLAYER_WEIGHTS.hotPlayersImpact,
    },
    isActive: true,
    isDefault: true,
  };
}

// ============================================
// Factor Breakdown Types and Functions
// ============================================

/**
 * Individual factor's contribution to the prediction
 */
export interface FactorBreakdownItem {
  factorKey: string;
  factorName: string;
  homeValue: number | string;
  awayValue: number | string;
  impact: number;           // Points added/subtracted to confidence score
  favoredTeam: 'home' | 'away' | 'neutral';
}

/**
 * Prediction result with detailed factor breakdown
 */
export interface PredictionWithBreakdown extends EnrichedGame {
  factorBreakdown: FactorBreakdownItem[];
  predictedWinner: string;
  predictedWinnerAbbrev: string;
}

/**
 * Calculate detailed breakdown of each factor's contribution
 */
export function calculateFactorBreakdown(
  homeTeam: TeamStandings,
  awayTeam: TeamStandings,
  weights: ConfidenceWeights,
  playerWeights: PlayerWeights,
  recentForm?: { home: RecentFormStats; away: RecentFormStats },
  situationalFactors?: SituationalFactors,
  teamStats?: { home: TeamPredictionStats | null; away: TeamPredictionStats | null },
  playerFactors?: PlayerPredictionFactors
): FactorBreakdownItem[] {
  const breakdown: FactorBreakdownItem[] = [];

  // Factor 1: Standings Differential
  const homePointPct = homeTeam.pointPctg || 0.5;
  const awayPointPct = awayTeam.pointPctg || 0.5;
  const pointDiff = homePointPct - awayPointPct;
  const standingsImpact = pointDiff * weights.standingsDifferential;
  breakdown.push({
    factorKey: 'standingsDifferential',
    factorName: 'Standings',
    homeValue: `${(homePointPct * 100).toFixed(1)}%`,
    awayValue: `${(awayPointPct * 100).toFixed(1)}%`,
    impact: Math.round(standingsImpact * 10) / 10,
    favoredTeam: standingsImpact > 0.5 ? 'home' : standingsImpact < -0.5 ? 'away' : 'neutral',
  });

  // Factor 2: Home Ice Advantage
  breakdown.push({
    factorKey: 'homeIceAdvantage',
    factorName: 'Home Ice',
    homeValue: 'Home',
    awayValue: 'Away',
    impact: weights.homeIceAdvantage,
    favoredTeam: 'home',
  });

  // Factor 3: Streaks
  const homeStreakValue = getStreakValue(homeTeam.streakCode);
  const awayStreakValue = getStreakValue(awayTeam.streakCode);
  const streakDiff = homeStreakValue - awayStreakValue;
  const streakImpact = streakDiff * weights.streakImpact;
  breakdown.push({
    factorKey: 'streakImpact',
    factorName: 'Momentum',
    homeValue: homeTeam.streakCode || 'N/A',
    awayValue: awayTeam.streakCode || 'N/A',
    impact: Math.round(streakImpact * 10) / 10,
    favoredTeam: streakImpact > 0.5 ? 'home' : streakImpact < -0.5 ? 'away' : 'neutral',
  });

  // Factor 4: Goal Differential
  const homeGDPerGame = getGoalDifferentialPerGame(homeTeam);
  const awayGDPerGame = getGoalDifferentialPerGame(awayTeam);
  const gdDiff = homeGDPerGame - awayGDPerGame;
  const gdImpact = gdDiff * weights.goalDifferentialImpact;
  breakdown.push({
    factorKey: 'goalDifferentialImpact',
    factorName: 'Goal Diff',
    homeValue: homeGDPerGame >= 0 ? `+${homeGDPerGame.toFixed(2)}` : homeGDPerGame.toFixed(2),
    awayValue: awayGDPerGame >= 0 ? `+${awayGDPerGame.toFixed(2)}` : awayGDPerGame.toFixed(2),
    impact: Math.round(gdImpact * 10) / 10,
    favoredTeam: gdImpact > 0.5 ? 'home' : gdImpact < -0.5 ? 'away' : 'neutral',
  });

  // Factor 5: Recent Form
  if (recentForm && recentForm.home.gamesPlayed > 0 && recentForm.away.gamesPlayed > 0) {
    const recentFormDiff = recentForm.home.pointPctg - recentForm.away.pointPctg;
    const recentFormImpact = recentFormDiff * weights.recentFormImpact;
    breakdown.push({
      factorKey: 'recentFormImpact',
      factorName: 'Recent Form',
      homeValue: `${(recentForm.home.pointPctg * 100).toFixed(0)}%`,
      awayValue: `${(recentForm.away.pointPctg * 100).toFixed(0)}%`,
      impact: Math.round(recentFormImpact * 10) / 10,
      favoredTeam: recentFormImpact > 0.5 ? 'home' : recentFormImpact < -0.5 ? 'away' : 'neutral',
    });
  }

  // Factor 6: Back-to-Back
  if (situationalFactors) {
    let b2bImpact = 0;
    if (situationalFactors.homeBackToBack && !situationalFactors.awayBackToBack) {
      b2bImpact = -weights.backToBackPenalty;
    } else if (situationalFactors.awayBackToBack && !situationalFactors.homeBackToBack) {
      b2bImpact = weights.backToBackPenalty;
    }
    breakdown.push({
      factorKey: 'backToBackPenalty',
      factorName: 'Back-to-Back',
      homeValue: situationalFactors.homeBackToBack ? 'Yes' : 'No',
      awayValue: situationalFactors.awayBackToBack ? 'Yes' : 'No',
      impact: b2bImpact,
      favoredTeam: b2bImpact > 0.5 ? 'home' : b2bImpact < -0.5 ? 'away' : 'neutral',
    });

    // Factor 7: Rest Advantage
    const restDaysDiff = situationalFactors.homeRestDays - situationalFactors.awayRestDays;
    const cappedRestDiff = Math.min(Math.max(restDaysDiff, -3), 3);
    const restImpact = cappedRestDiff * weights.restAdvantage;
    breakdown.push({
      factorKey: 'restAdvantage',
      factorName: 'Rest Days',
      homeValue: `${situationalFactors.homeRestDays}d`,
      awayValue: `${situationalFactors.awayRestDays}d`,
      impact: Math.round(restImpact * 10) / 10,
      favoredTeam: restImpact > 0.5 ? 'home' : restImpact < -0.5 ? 'away' : 'neutral',
    });
  }

  // Factor 8: Special Teams
  if (teamStats?.home && teamStats?.away) {
    const homeSpecialTeams = (teamStats.home.powerPlayPct + teamStats.home.penaltyKillPct) / 2;
    const awaySpecialTeams = (teamStats.away.powerPlayPct + teamStats.away.penaltyKillPct) / 2;
    const specialTeamsDiff = homeSpecialTeams - awaySpecialTeams;
    const specialTeamsImpact = specialTeamsDiff * weights.specialTeamsImpact;
    breakdown.push({
      factorKey: 'specialTeamsImpact',
      factorName: 'Special Teams',
      homeValue: `${(homeSpecialTeams * 100).toFixed(1)}%`,
      awayValue: `${(awaySpecialTeams * 100).toFixed(1)}%`,
      impact: Math.round(specialTeamsImpact * 10) / 10,
      favoredTeam: specialTeamsImpact > 0.5 ? 'home' : specialTeamsImpact < -0.5 ? 'away' : 'neutral',
    });

    // Factor 9: Shot Differential
    const homeNetShots = teamStats.home.shotsForPerGame - teamStats.home.shotsAgainstPerGame;
    const awayNetShots = teamStats.away.shotsForPerGame - teamStats.away.shotsAgainstPerGame;
    const shotDiff = homeNetShots - awayNetShots;
    const shotImpact = (shotDiff * 0.5) * weights.shotDifferentialImpact;
    breakdown.push({
      factorKey: 'shotDifferentialImpact',
      factorName: 'Shot Diff',
      homeValue: homeNetShots >= 0 ? `+${homeNetShots.toFixed(1)}` : homeNetShots.toFixed(1),
      awayValue: awayNetShots >= 0 ? `+${awayNetShots.toFixed(1)}` : awayNetShots.toFixed(1),
      impact: Math.round(shotImpact * 10) / 10,
      favoredTeam: shotImpact > 0.5 ? 'home' : shotImpact < -0.5 ? 'away' : 'neutral',
    });
  }

  // Factor 10: Goalie Matchup
  if (playerFactors?.goalieMatchup) {
    const goalieImpact = playerFactors.goalieMatchup.confidenceImpact * playerWeights.goalieMatchupImpact;
    breakdown.push({
      factorKey: 'goalieMatchupImpact',
      factorName: 'Goalie Matchup',
      homeValue: playerFactors.goalieMatchup.homeGoalie?.name || 'TBD',
      awayValue: playerFactors.goalieMatchup.awayGoalie?.name || 'TBD',
      impact: Math.round(goalieImpact * 10) / 10,
      favoredTeam: playerFactors.goalieMatchup.advantage,
    });
  }

  // Factor 11: Hot/Cold Players
  if (playerFactors?.homeHotPlayers && playerFactors?.awayHotPlayers) {
    const heatDiff = playerFactors.homeHotPlayers.overallHeatIndex - playerFactors.awayHotPlayers.overallHeatIndex;
    const heatImpact = heatDiff * playerWeights.hotPlayersImpact;
    breakdown.push({
      factorKey: 'hotPlayersImpact',
      factorName: 'Hot Players',
      homeValue: playerFactors.homeHotPlayers.overallHeatIndex >= 0
        ? `+${playerFactors.homeHotPlayers.overallHeatIndex}`
        : `${playerFactors.homeHotPlayers.overallHeatIndex}`,
      awayValue: playerFactors.awayHotPlayers.overallHeatIndex >= 0
        ? `+${playerFactors.awayHotPlayers.overallHeatIndex}`
        : `${playerFactors.awayHotPlayers.overallHeatIndex}`,
      impact: Math.round(heatImpact * 10) / 10,
      favoredTeam: heatImpact > 0.5 ? 'home' : heatImpact < -0.5 ? 'away' : 'neutral',
    });
  }

  return breakdown;
}

/**
 * Predict with a model and return detailed factor breakdown
 * Shows users WHY a prediction was made
 */
export async function predictWithModelAndBreakdown(
  model: PredictionModel,
  game: GameData,
  standings: StandingsData | null
): Promise<PredictionWithBreakdown | null> {
  if (!standings?.standings) {
    return null;
  }

  const standingsMap = createStandingsMap(standings);
  const homeAbbrev = game.homeTeam?.abbrev || '';
  const awayAbbrev = game.awayTeam?.abbrev || '';
  const gameDate = game.startTimeUTC?.split('T')[0] || '';

  const homeTeam = standingsMap.get(homeAbbrev);
  const awayTeam = standingsMap.get(awayAbbrev);

  if (!homeTeam || !awayTeam) {
    return null;
  }

  try {
    // Fetch all enhanced data
    const allTeamStats = await fetchAllTeamStats();
    const recentFormData = await getMatchupRecentForm(homeAbbrev, awayAbbrev, 10);
    const situationalData = gameDate
      ? calculateSituationalFactors(gameDate, recentFormData.homeGames, recentFormData.awayGames)
      : undefined;
    const teamStats = {
      home: allTeamStats.get(homeAbbrev) || null,
      away: allTeamStats.get(awayAbbrev) || null,
    };
    const playerFactors = await getPlayerPredictionFactors(homeAbbrev, awayAbbrev);

    // Calculate confidence score
    const confidenceScore = calculateConfidenceScoreWithModel(
      game,
      homeTeam,
      awayTeam,
      model.weights,
      model.playerWeights,
      recentFormData,
      situationalData,
      teamStats,
      playerFactors
    );

    // Calculate factor breakdown
    const factorBreakdown = calculateFactorBreakdown(
      homeTeam,
      awayTeam,
      model.weights,
      model.playerWeights,
      recentFormData,
      situationalData,
      teamStats,
      playerFactors
    );

    // Determine predicted winner (score > 50 = home, < 50 = away)
    const predictedWinnerAbbrev = confidenceScore >= 50 ? homeAbbrev : awayAbbrev;
    const predictedWinner = confidenceScore >= 50 ? 'home' : 'away';

    return {
      ...game,
      confidenceScore,
      homeTeam: { ...homeTeam, abbrev: homeAbbrev },
      awayTeam: { ...awayTeam, abbrev: awayAbbrev },
      factorBreakdown,
      predictedWinner,
      predictedWinnerAbbrev,
    };
  } catch (error) {
    console.error('[MODEL_PREDICTION] Error in predictWithModelAndBreakdown:', error);

    // Fallback with basic breakdown
    const confidenceScore = calculateConfidenceScoreWithModel(
      game,
      homeTeam,
      awayTeam,
      model.weights,
      model.playerWeights
    );

    const factorBreakdown = calculateFactorBreakdown(
      homeTeam,
      awayTeam,
      model.weights,
      model.playerWeights
    );

    const predictedWinnerAbbrev = confidenceScore >= 50 ? homeAbbrev : awayAbbrev;
    const predictedWinner = confidenceScore >= 50 ? 'home' : 'away';

    return {
      ...game,
      confidenceScore,
      homeTeam: { ...homeTeam, abbrev: homeAbbrev },
      awayTeam: { ...awayTeam, abbrev: awayAbbrev },
      factorBreakdown,
      predictedWinner,
      predictedWinnerAbbrev,
    };
  }
}

/**
 * Get the top N factors contributing to a prediction
 * Sorted by absolute impact value
 */
export function getTopFactors(breakdown: FactorBreakdownItem[], count: number = 5): FactorBreakdownItem[] {
  return [...breakdown]
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, count);
}
