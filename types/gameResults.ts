/**
 * Types for game results, H2H records, and player stats.
 * Used by services/gameResults.ts, services/playerStats.ts, and UI components.
 */

/** A single game result stored in Supabase game_results table */
export interface GameResult {
  id: number;
  game_id: number;
  season: string;
  game_date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  game_state: string;
  created_at: string;
}

/** Head-to-head season series record between two teams */
export interface H2HRecord {
  teamA: string;
  teamB: string;
  teamAWins: number;
  teamBWins: number;
  otLosses: number;
  games: GameResult[];
}

/** Skater season stat line from NHL API /v1/club-stats/{team}/now */
export interface PlayerStatLine {
  playerId: number;
  firstName: string;
  lastName: string;
  positionCode: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  shots: number;
  shootingPctg: number;
}

/** Goalie season stat line from NHL API /v1/club-stats/{team}/now */
export interface GoalieStatLine {
  playerId: number;
  firstName: string;
  lastName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  goalsAgainstAvg: number;
  savePctg: number;
}

/** Combined player stats for a team */
export interface TeamPlayerStats {
  skaters: PlayerStatLine[];
  goalies: GoalieStatLine[];
}

/** Format for NHL API name fields (e.g., { default: "Auston" }) */
export interface NHLNameField {
  default: string;
}

/** Raw skater data from NHL API /v1/club-stats/{team}/now */
export interface NHLRawSkater {
  playerId: number;
  firstName: NHLNameField;
  lastName: NHLNameField;
  positionCode: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  shots: number;
  shootingPctg: number;
}

/** Raw goalie data from NHL API /v1/club-stats/{team}/now */
export interface NHLRawGoalie {
  playerId: number;
  firstName: NHLNameField;
  lastName: NHLNameField;
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  otLosses: number;
  goalsAgainstAvg: number;
  savePctg: number;
}

/** Raw game from NHL API club-schedule-season endpoint */
export interface NHLScheduleGame {
  id: number;
  gameDate: string;
  startTimeUTC: string;
  gameState: string;
  homeTeam: {
    id: number;
    abbrev: string;
    score?: number;
  };
  awayTeam: {
    id: number;
    abbrev: string;
    score?: number;
  };
}
