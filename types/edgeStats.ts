/**
 * TypeScript types for NHL Edge IQ API responses
 * Maps 1:1 to verified API response shapes (verified 2026-02-04)
 */

// ============================================
// Shared Primitives
// ============================================

export interface NHLNameField {
  default: string;
  cs?: string;
  de?: string;
  es?: string;
  fi?: string;
  fr?: string;
  sk?: string;
  sv?: string;
}

export interface EdgePlayerRef {
  id: number;
  firstName: NHLNameField;
  lastName: NHLNameField;
  position?: string;
  team?: {
    id?: number;
    abbrev: string;
    teamLogo?: string;
  };
  goals?: number;
  assists?: number;
  points?: number;
  gamesPlayed?: number;
}

export interface EdgeTeamRef {
  id: number;
  abbrev: string;
  teamLogo?: string;
}

export interface ImperialMetric {
  imperial: { speed?: number; distance?: number };
  metric?: { speed?: number; distance?: number };
}

// ============================================
// Shot Location / Zone Types
// ============================================

/** One of 17 rink zones for shot/save location data */
export interface ShotLocationZone {
  area: string;
  shots: number;
  shotsPercentile?: number;
  shotsRank?: number;
  goals?: number;
  savePctg?: number;
  saves?: number;
  percentile?: number;
}

/** Summary by shot location category (high/mid/long/all) */
export interface ShotLocationSummary {
  locationCode: 'all' | 'high' | 'mid' | 'long';
  shots: number;
  goals: number;
  shootingPctg: number;
  percentiles?: { shots?: number; goals?: number; shootingPctg?: number };
  shotsRank?: number;
  goalsRank?: number;
  shootingPctgRank?: number;
  goalsAgainst?: number;
  saves?: number;
  savePctg?: number;
}

// ============================================
// Zone Time
// ============================================

export interface ZoneTimeDetail {
  offensiveZonePctg: number;
  neutralZonePctg: number;
  defensiveZonePctg: number;
  offensiveZoneRank?: number;
  defensiveZoneRank?: number;
  neutralZoneRank?: number;
  percentiles?: {
    offensiveZonePctg?: number;
    defensiveZonePctg?: number;
    neutralZonePctg?: number;
  };
  leagueAvg?: {
    offensiveZonePctg?: number;
    defensiveZonePctg?: number;
    neutralZonePctg?: number;
  };
}

// ============================================
// Speed / Distance Stats
// ============================================

export interface SpeedStat {
  imperial: number; // mph
  metric?: number; // km/h
  percentile?: number;
  rank?: number;
  leagueAvg?: { imperial: number; metric?: number };
}

export interface DistanceStat {
  imperial: number; // miles
  metric?: number; // km
  percentile?: number;
  rank?: number;
  leagueAvg?: { imperial: number; metric?: number };
}

// ============================================
// Skater Detail Response
// ============================================

export interface SkaterEdgeDetail {
  player: EdgePlayerRef;
  topShotSpeed: SpeedStat;
  skatingSpeed: {
    speedMax: SpeedStat;
    burstsOver20: { value: number; percentile?: number; leagueAvg?: { value: number } };
  };
  totalDistanceSkated: DistanceStat;
  sogSummary: ShotLocationSummary[];
  sogDetails: ShotLocationZone[];
  zoneTimeDetails: ZoneTimeDetail;
}

// ============================================
// Team Detail Response
// ============================================

export interface TeamEdgeDetail {
  team: {
    id: number;
    abbrev: string;
    wins?: number;
    losses?: number;
    otLosses?: number;
    gamesPlayed?: number;
    points?: number;
  };
  shotSpeed: {
    topShotSpeed: SpeedStat;
    shotAttemptsOver90: { value: number; rank?: number };
  };
  skatingSpeed: {
    speedMax: SpeedStat;
    burstsOver22: { value: number; rank?: number };
  };
  distanceSkated: {
    total: DistanceStat;
  };
  sogSummary: ShotLocationSummary[];
  sogDetails: ShotLocationZone[];
  zoneTimeDetails: ZoneTimeDetail;
}

// ============================================
// Goalie Detail Response
// ============================================

export interface GoalieEdgeDetail {
  player: EdgePlayerRef;
  stats: {
    gaa?: { value: number; percentile?: number; leagueAvg?: { value: number } };
    gamesAbove900?: { value: number; percentile?: number; leagueAvg?: { value: number } };
    goalDiffPer60?: { value: number; percentile?: number; leagueAvg?: { value: number } };
  };
  shotLocationSummary: ShotLocationSummary[];
  shotLocationDetails: ShotLocationZone[];
}

// ============================================
// Landing / Overview Responses
// ============================================

export interface EdgeSkaterLandingEntry {
  player: EdgePlayerRef;
  overlay?: {
    date?: string;
    awayTeam?: { abbrev: string };
    homeTeam?: { abbrev: string };
  };
  shotSpeed?: ImperialMetric;
  skatingSpeed?: ImperialMetric;
  distanceSkated?: ImperialMetric;
}

export interface EdgeSkaterLanding {
  hardestShot: EdgeSkaterLandingEntry;
  maxSkatingSpeed: EdgeSkaterLandingEntry;
  totalDistanceSkated: EdgeSkaterLandingEntry;
  highDangerSOG?: EdgeSkaterLandingEntry;
}

export interface EdgeGoalieLanding {
  highDangerSavePctg: {
    player: EdgePlayerRef;
    savePctg: { value: number };
    shotLocationDetails?: ShotLocationZone[];
  };
}

export interface EdgeTeamLandingEntry {
  team: EdgeTeamRef;
  value: number;
  rank: number;
}

export interface EdgeTeamLanding {
  shotAttemptsOver90: EdgeTeamLandingEntry;
  burstsOver22: EdgeTeamLandingEntry;
  distancePer60: EdgeTeamLandingEntry;
}

// ============================================
// By-The-Numbers Response (Last Game Night)
// ============================================

export interface EdgeByTheNumbers {
  games: number;
  gameDate: string;
  hardestShotSkater: {
    player: EdgePlayerRef;
    shotSpeed: ImperialMetric;
  };
  maxSkatingSpeedSkater: {
    player: EdgePlayerRef;
    skatingSpeed: ImperialMetric;
  };
  totalDistanceSkatedSkater: {
    player: EdgePlayerRef;
    distanceSkated: ImperialMetric;
  };
}

// ============================================
// Team Zone Time Details Response
// ============================================

export interface TeamZoneTimeStrength {
  strength: 'all' | 'es' | 'pp' | 'pk';
  offensiveZonePctg: number;
  neutralZonePctg: number;
  defensiveZonePctg: number;
  rank?: number;
  leagueAvg?: {
    offensiveZonePctg: number;
    neutralZonePctg: number;
    defensiveZonePctg: number;
  };
}

export interface TeamZoneTimeDetails {
  zoneTimeDetails: TeamZoneTimeStrength[];
  shotDifferential?: {
    attemptDiff?: number;
    attemptDiffRank?: number;
    sogDiff?: number;
    sogDiffRank?: number;
  };
}

// ============================================
// Derived / Calculated Stats
// ============================================

/** Momentum trend direction */
export type MomentumTrend = '↑' | '↗' | '→' | '↘' | '↓';

/** 5-game rolling momentum data */
export interface MomentumData {
  score: number; // -10 to +10
  trend: MomentumTrend;
  /** Last 5 game goal differentials */
  history: number[];
  /** Label for display */
  label: string;
}

/** Clutch performance rating */
export type ClutchRatingLevel = 'CLUTCH' | 'CLOSER' | 'ICE COLD' | null;

export interface ClutchRating {
  rating: ClutchRatingLevel;
  oneGoalRecord: string; // e.g., "8-3"
  otRecord: string; // e.g., "2-1"
  thirdPeriodGoalDiff: number;
}

/** Edge stats summary for QuickStatsBar */
export interface EdgeQuickStats {
  topShotSpeed: { value: number; playerName: string } | null;
  hottestMomentum: { value: number; teamAbbrev: string } | null;
  biggestFatigueMismatch: { value: number; matchup: string } | null;
}
