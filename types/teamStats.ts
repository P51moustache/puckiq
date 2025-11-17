// Team Statistics Type Definitions for Stats Comparison Feature

export interface OffenseStats {
  goalsPerGame: number;
  goalsPerGameRank?: number;
  shotsPerGame: number;
  shotsPerGameRank?: number;
  shootingPct: number;
  shootingPctRank?: number;
  powerPlayGoals: number;
  powerPlayGoalsRank?: number;
  powerPlayPct: number;
  powerPlayPctRank?: number;
  scoringFirst: number;
  scoringFirstRank?: number;
}

export interface DefenseStats {
  goalsAgainstPerGame: number;
  goalsAgainstPerGameRank?: number;
  shotsAgainstPerGame: number;
  shotsAgainstPerGameRank?: number;
  penaltyKillPct: number;
  penaltyKillPctRank?: number;
  blockedShots: number;
  blockedShotsRank?: number;
  takeaways: number;
  takeawaysRank?: number;
  hits: number;
  hitsRank?: number;
}

export interface SpecialTeamsStats {
  powerPlayOpportunities: number;
  powerPlayOpportunitiesRank?: number;
  powerPlayPct: number;
  powerPlayPctRank?: number;
  penaltyKillPct: number;
  penaltyKillPctRank?: number;
  shorthandedGoals: number;
  shorthandedGoalsRank?: number;
  powerPlayGoalsFor: number;
  powerPlayGoalsForRank?: number;
  powerPlayGoalsAgainst: number;
  powerPlayGoalsAgainstRank?: number;
}

export interface AdvancedStats {
  corsiForPct: number;
  corsiForPctRank?: number;
  fenwickForPct: number;
  fenwickForPctRank?: number;
  pdo: number;
  pdoRank?: number;
  expectedGoalsFor: number;
  expectedGoalsForRank?: number;
  expectedGoalsAgainst: number;
  expectedGoalsAgainstRank?: number;
  highDangerChancesFor: number;
  highDangerChancesForRank?: number;
  highDangerChancesAgainst: number;
  highDangerChancesAgainstRank?: number;
  shotQuality: number;
  shotQualityRank?: number;
}

export interface GoaltendingStats {
  savePct: number;
  savePctRank?: number;
  goalsAgainstAverage: number;
  goalsAgainstAverageRank?: number;
  shutouts: number;
  shutoutsRank?: number;
  qualityStarts: number;
  qualityStartsRank?: number;
  highDangerSavePct: number;
  highDangerSavePctRank?: number;
  reboundControl: number;
  reboundControlRank?: number;
}

export interface DisciplineStats {
  penaltiesPerGame: number;
  penaltiesPerGameRank?: number;
  penaltyMinutes: number;
  penaltyMinutesRank?: number;
  minorPenalties: number;
  minorPenaltiesRank?: number;
  majorPenalties: number;
  majorPenaltiesRank?: number;
}

export interface TeamComparisonStats {
  teamId: number;
  teamAbbrev: string;
  offense: OffenseStats;
  defense: DefenseStats;
  specialTeams: SpecialTeamsStats;
  advanced: AdvancedStats;
  goaltending: GoaltendingStats;
  discipline: DisciplineStats;
}

export interface CategoryWinner {
  offense: 'home' | 'away' | 'tie';
  defense: 'home' | 'away' | 'tie';
  specialTeams: 'home' | 'away' | 'tie';
  advanced: 'home' | 'away' | 'tie';
  goaltending: 'home' | 'away' | 'tie';
  discipline: 'home' | 'away' | 'tie';
}

export type StatCategory = 'offense' | 'defense' | 'specialTeams' | 'advanced' | 'goaltending' | 'discipline';

export interface StatDefinition {
  key: string;
  label: string;
  higherIsBetter: boolean;
  format?: 'number' | 'percentage' | 'decimal';
  decimals?: number;
}
