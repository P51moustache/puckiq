/**
 * TypeScript types for prediction system
 */

export interface TeamStandings {
  teamAbbrev?: string | { default: string };
  pointPctg?: number;
  wins?: number;
  losses?: number;
  otLosses?: number;
  points?: number;
  goalFor?: number;
  goalAgainst?: number;
  gamesPlayed?: number;
  streakCode?: string;
}

export interface StandingsData {
  standings: TeamStandings[] | null;
}

export interface GameData {
  id: number | string;
  homeTeam: {
    abbrev: string;
    score?: number;
  };
  awayTeam: {
    abbrev: string;
    score?: number;
  };
  gameState?: string;
  startTimeUTC?: string;
}

export interface ConfidenceWeights {
  standingsDifferential: number;  // Multiplier for point% difference
  homeIceAdvantage: number;       // Fixed bonus for home team
  streakImpact: number;           // Multiplier for streak difference
  goalDifferentialImpact: number; // Multiplier for GD per game difference
}

export interface PredictionResult {
  predictedWinner: string;
  homeWinProb: number;
  awayWinProb: number;
  confidenceScore: number;
}

export interface EnrichedGame extends GameData {
  confidenceScore: number;
  homeTeam: TeamStandings & { abbrev: string };
  awayTeam: TeamStandings & { abbrev: string };
}
