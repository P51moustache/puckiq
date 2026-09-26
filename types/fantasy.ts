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
  /** League eligibility when it differs from the NHL position (e.g. Yahoo C/LW). */
  eligible?: SlotPosition[];
  /** On the host's IR slot — never counts toward lineups. */
  injuredReserve?: boolean;
}

/** A fantasy platform. We never write lineups there — we tell you what to change. */
export type FantasyPlatform = 'yahoo' | 'espn' | 'fantrax' | 'other';

/** Positions a player can be eligible for. */
export type SlotPosition = 'C' | 'LW' | 'RW' | 'D' | 'G';

/** Active lineup slot types. F = any forward, UTIL = any skater. */
export type SlotKey = 'C' | 'LW' | 'RW' | 'F' | 'D' | 'UTIL' | 'G';

export type LineupSlots = Record<SlotKey, number>;

/** Points-league weights. Category leagues use these as a rough "value" proxy. */
export interface ScoringWeights {
  goals: number;
  assists: number;
  ppp: number;
  shots: number;
  hits: number;
  blocks: number;
  plusMinus: number;
  wins: number;
  saves: number;
  goalsAgainst: number;
  shutouts: number;
}

/** One fantasy team in one league. Pro can keep several. */
export interface FantasyTeam {
  id: string;
  name: string;
  platform: FantasyPlatform;
  /** Teams in the league — sizes the "likely already rostered" pickup filter. */
  leagueSize: number;
  /** H2H weekly minimum goalie starts (Yahoo's default is 3). 0 = no minimum. */
  minGoalieStarts: number;
  slots: LineupSlots;
  scoring: ScoringWeights;
  players: FantasyPlayer[];
  /** This week's head-to-head opponent (manual). */
  opponentName: string;
  opponent: FantasyPlayer[];
  /** Pickups the user marked as already rostered in their league. */
  hiddenPickupIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamsState {
  activeTeamId: string | null;
  teams: FantasyTeam[];
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
