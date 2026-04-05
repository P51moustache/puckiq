/**
 * Fantasy Hockey Types
 * Types for fantasy roster management and player projections
 */

export type ScoringFormat = 'yahoo' | 'espn';
export type RosterPosition = 'C' | 'LW' | 'RW' | 'D' | 'G' | 'BN' | 'IR';
export type StartSitRec = 'START' | 'SIT' | 'UPSIDE' | 'FLEX';

export interface FantasyPlayer {
  playerId: number;
  playerName: string;
  teamAbbrev: string;
  position: string;        // NHL position (C, LW, RW, D, G)
  rosterPosition: RosterPosition;  // Fantasy roster slot
}

export interface FantasyRoster {
  id: string;
  name: string;
  scoringFormat: ScoringFormat;
  players: FantasyPlayer[];
  createdAt: string;
  updatedAt: string;
}

export interface PlayerProjection {
  playerId: number;
  playerName: string;
  teamAbbrev: string;
  position: string;
  fantasyPoints: number;
  floor: number;
  ceiling: number;
  predGoals: number;
  predAssists: number;
  predSog: number;
  predHits: number;
  predBlocks: number;
  recommendation: StartSitRec;
  confidence: string;
  reason: string;
  gameId: number;
  opponentAbbrev: string;
  isHome: boolean;
}
