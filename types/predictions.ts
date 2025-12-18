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
  recentFormImpact: number;       // Multiplier for recent form difference (L5/L10)
  backToBackPenalty: number;      // Penalty for playing back-to-back games
  restAdvantage: number;          // Bonus per extra rest day
  specialTeamsImpact: number;     // Multiplier for PP% + PK% combined differential
  shotDifferentialImpact: number; // Multiplier for net shots per game differential
}

// Team stats for prediction (real NHL API data)
export interface TeamPredictionStats {
  powerPlayPct: number;        // Power play percentage (0-1, e.g., 0.22 = 22%)
  penaltyKillPct: number;      // Penalty kill percentage (0-1, e.g., 0.82 = 82%)
  shotsForPerGame: number;     // Average shots taken per game
  shotsAgainstPerGame: number; // Average shots allowed per game
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

// Recent form tracking
export interface RecentGame {
  id: number;
  gameDate: string;
  isHomeGame: boolean;
  opponent: string;
  goalsFor: number;
  goalsAgainst: number;
  won: boolean;
}

export interface RecentFormStats {
  wins: number;
  losses: number;
  pointPctg: number;
  goalDifferential: number;
  gamesPlayed: number;
}

// Situational factors
export interface SituationalFactors {
  homeBackToBack: boolean;
  awayBackToBack: boolean;
  homeRestDays: number;
  awayRestDays: number;
  restAdvantage: 'home' | 'away' | 'neutral';
}

// Accuracy tracking
export interface DailyAccuracy {
  date: string;
  lockCorrect: boolean | null;
  smartPicksCorrect: number;
  smartPicksTotal: number;
  overallAccuracy: number;
}

export interface AccuracyTrend {
  currentAccuracy: number;
  last7DaysAvg: number;
  last30DaysAvg: number;
  trend: 'improving' | 'declining' | 'stable';
  history: DailyAccuracy[];
}

// Weight calibration
export interface AccuracyByRange {
  range: string;
  predictions: number;
  correct: number;
  accuracy: number;
}

export interface WeightAnalysis {
  currentWeights: ConfidenceWeights;
  accuracyByRange: AccuracyByRange[];
  suggestedWeights: ConfidenceWeights;
  improvements: string[];
}
