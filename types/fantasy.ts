/**
 * Fantasy Hockey Types
 * Types for fantasy roster management and player projections
 */

export type ScoringFormat = 'yahoo' | 'espn';
export type RosterPosition = 'C' | 'LW' | 'RW' | 'D' | 'G' | 'BN' | 'IR';
export type StartSitRec = 'START' | 'SIT' | 'UPSIDE' | 'FLEX';
export type InjurySignal = 'ok' | 'scratch' | 'dtd' | 'out' | 'unknown';
/** Honest confidence. Confirmed only from an official NHL scratch sheet. Never fake it. */
export type InjuryConfidence = 'confirmed' | 'likely' | 'unknown';
export type FantasyProviderId = 'manual' | 'yahoo' | 'espn';

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

/** Tonight status for one player on MY roster — not a league-wide card. */
export interface TonightPlayerStatus {
  playerId: number;
  playerName: string;
  teamAbbrev: string;
  position: string;
  opponentAbbrev: string | null;
  isHome: boolean | null;
  gameId: number | null;
  startTimeUTC: string | null;
  gameState: string | null;
  injurySignal: InjurySignal;
  injuryNote: string | null;
  /** Confirmed = NHL right-rail scratch. Likely = news language. Else Unknown — including healthy. */
  confidence: InjuryConfidence;
  recommendation: StartSitRec;
  reason: string;
}

export interface MyWeekPlayerGame {
  playerId: number;
  playerName: string;
  teamAbbrev: string;
  opponentAbbrev: string;
  isHome: boolean;
}

export interface MyWeekDay {
  date: string;
  dayAbbrev: string;
  playerCount: number;
  games: MyWeekPlayerGame[];
}

/** Free-tier week of MY games. Not a paywalled host “set lineup for the week”. */
export interface MyWeek {
  startDate: string;
  days: MyWeekDay[];
}

export interface RosterNewsItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  source: string;
  matchedPlayerIds: number[];
  matchedPlayerNames: string[];
}

export interface NhlSearchPlayer {
  playerId: number;
  name: string;
  teamAbbrev: string;
  position: string;
  active: boolean;
}

/** Plug-in point for Yahoo / ESPN league import. v1 ships manual only. */
export interface FantasySyncAdapter {
  id: FantasyProviderId;
  label: string;
  available: boolean;
  reasonUnavailable?: string;
  connectAndImport(): Promise<FantasyPlayer[]>;
}
