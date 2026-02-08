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
  divisionName?: string;
  teamLogo?: string;
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

/** Full game object from NHL score API (api-web.nhle.com/v1/score/{date}) */
export interface NHLGameSummary {
  id: number;
  homeTeam: {
    id?: number;
    abbrev: string;
    score?: number;
    streakCode?: string;
  };
  awayTeam: {
    id?: number;
    abbrev: string;
    score?: number;
    streakCode?: string;
  };
  gameState: string;
  gameDate?: string;
  startTimeUTC: string;
  period?: number;
  clock?: {
    timeRemaining?: string;
  };
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

// ============================================
// Player Data Types for Predictions
// ============================================

/**
 * Basic player info from roster/landing APIs
 */
export interface PlayerInfo {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbrev: string;
  position: 'C' | 'L' | 'R' | 'D' | 'G';
  positionType: 'F' | 'D' | 'G';
  sweaterNumber?: number;
}

/**
 * Skater stats (forwards and defensemen)
 */
export interface SkaterStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  shots: number;
  shootingPct: number;
  powerPlayGoals: number;
  powerPlayPoints: number;
  gameWinningGoals: number;
  avgTimeOnIce: string;
}

/**
 * Goalie stats
 */
export interface GoalieStats {
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  otLosses: number;
  savePercentage: number;
  goalsAgainstAverage: number;
  shutouts: number;
  shotsAgainst: number;
  saves: number;
  avgTimeOnIce: string;
}

/**
 * Player's recent form (last N games)
 */
export interface PlayerRecentForm {
  playerId: number;
  playerName: string;
  position: string;
  gamesPlayed: number;
  // Skater stats
  goals?: number;
  assists?: number;
  points?: number;
  plusMinus?: number;
  // Goalie stats
  wins?: number;
  savePercentage?: number;
  goalsAgainstAverage?: number;
  // Calculated
  isHot: boolean;  // Performing above season average
  isCold: boolean; // Performing below season average
  hotStreak?: number; // Consecutive games with points (skaters) or wins (goalies)
}

/**
 * Starting goalie information for a game
 */
export interface GoalieMatchup {
  homeGoalie: {
    id: number;
    name: string;
    seasonStats: GoalieStats | null;
    recentForm: PlayerRecentForm | null;
    isConfirmed: boolean; // Whether this is confirmed starter
  } | null;
  awayGoalie: {
    id: number;
    name: string;
    seasonStats: GoalieStats | null;
    recentForm: PlayerRecentForm | null;
    isConfirmed: boolean;
  } | null;
  advantage: 'home' | 'away' | 'neutral';
  confidenceImpact: number; // -15 to +15 impact on confidence score
}

/**
 * Hot/cold players for a team
 */
export interface TeamHotPlayers {
  teamAbbrev: string;
  hotPlayers: PlayerRecentForm[];  // Players on scoring/winning streaks
  coldPlayers: PlayerRecentForm[]; // Players in slumps
  injuredStars: PlayerInfo[];      // Key players out (if available)
  overallHeatIndex: number;        // -10 to +10, positive = team is hot
}

/**
 * Complete player factors for prediction
 */
export interface PlayerPredictionFactors {
  goalieMatchup: GoalieMatchup | null;
  homeHotPlayers: TeamHotPlayers | null;
  awayHotPlayers: TeamHotPlayers | null;
  totalImpact: number; // Combined impact on confidence (-25 to +25)
}

/**
 * Extended confidence weights including player factors
 */
export interface ExtendedConfidenceWeights extends ConfidenceWeights {
  goalieMatchupImpact: number;     // Impact of starting goalie comparison
  hotPlayersImpact: number;        // Impact of hot/cold player differential
  starPlayerImpact: number;        // Impact of star player availability
}

// ============================================
// Prediction Model Types
// ============================================

/**
 * Player-based weight factors for models
 * These control the impact of player-specific prediction factors
 */
export interface PlayerWeights {
  goalieMatchupImpact: number;     // Multiplier for goalie comparison impact (default: 1.0)
  hotPlayersImpact: number;        // Multiplier for hot/cold player differential (default: 1.5)
}

/**
 * Results from backtesting a prediction model against historical data
 */
export interface ModelBacktestResults {
  period: {
    start: string;  // ISO date string (YYYY-MM-DD)
    end: string;    // ISO date string (YYYY-MM-DD)
  };
  totalGames: number;           // Number of games tested
  correctPicks: number;         // Number of correct predictions
  accuracy: number;             // 0-100 percentage accuracy
  baselineAccuracy: number;     // Classic model accuracy for comparison
  ranAt: string;                // ISO timestamp when backtest was executed
}

/**
 * A user-created or system prediction model
 * Models customize the existing CONFIDENCE_WEIGHTS and PLAYER_WEIGHTS
 * to generate different predictions via calculateConfidenceScore()
 */
export interface PredictionModel {
  id: string;                     // Unique identifier (UUID)
  name: string;                   // User-friendly model name
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
  weights: ConfidenceWeights;     // The 9 core prediction factors
  playerWeights: PlayerWeights;   // Player-based weight factors
  isActive: boolean;              // Currently selected model for predictions
  isDefault: boolean;             // System default (Classic) - cannot be deleted
  backtestResults?: ModelBacktestResults;  // Optional backtest results
  type?: 'rule-based' | 'ml';    // Model type — defaults to 'rule-based' for backward compat
  mlMetadata?: {                  // Present only for ML models
    modelVersion: string;
    lastTrained: string;
    accuracy7d: number | null;
    accuracy30d: number | null;
    accuracySeason: number | null;
    brierScore: number | null;
  };
}
