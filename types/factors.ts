export type FactorType =
  | 'GOALIE_EDGE'
  | 'HOME_ICE'
  | 'REST'
  | 'RECENT_FORM'
  | 'SPECIAL_TEAMS'
  | 'HEAD_TO_HEAD'
  | 'BACK_TO_BACK'
  | 'DIVISIONAL';

export interface GameFactor {
  type: FactorType;
  advantage: string; // Team abbrev or 'EVEN'
  description: string;
  detail: string;
  impact: number; // 0-100, used for sorting
}

export interface FactorAnalysisInput {
  abbrev: string;
  homeRecord?: string;
  recentSavePct?: number;
  daysRest?: number;
  recentForm?: string;
  powerPlayPct?: number;
  penaltyKillPct?: number;
}
