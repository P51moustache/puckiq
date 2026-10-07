/**
 * League Room types — the contract between the Supabase schema (snake_case rows) and the app.
 * See docs/plans/2026-10-06-season-two.md for the RPCs that read and write these.
 */

import type { FantasyPlatform, FantasyPlayer, LineupSlots, ScoringWeights } from './fantasy';

/** Preset reactions only. No free text keeps rooms out of chat moderation (App Review 1.2). */
export const ROOM_REACTIONS = ['🔥', '🚨', '😂', '🧂', '🥶', '👏'] as const;
export type RoomReaction = (typeof ROOM_REACTIONS)[number];

/** Invite codes avoid look-alike characters (no I, O, 0, 1). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const ROOM_NAME_MAX = 40;

export type RoomCurrency = 'USD' | 'CAD';

export interface RoomPayout {
  /** 1 = champion. */
  place: number;
  amount: number;
}

/** Dues are tracking only — PuckIQ never holds or moves money. */
export interface RoomDues {
  /** Per member, whole currency units. Null = no dues. */
  amount: number | null;
  currency: RoomCurrency;
  /** YYYY-MM-DD. */
  deadline: string | null;
  payouts: RoomPayout[];
  /** Optional https link to where the pot is held (e.g. LeagueSafe). */
  potLink: string | null;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  platform: FantasyPlatform;
  leagueSize: number;
  slots: LineupSlots;
  scoring: ScoringWeights;
  ownerId: string | null;
  dues: RoomDues;
  createdAt: string;
  updatedAt: string;
}

export interface RoomMember {
  roomId: string;
  userId: string;
  teamName: string;
  roster: FantasyPlayer[];
  rosterUpdatedAt: string;
  /** Who this member plays this week (another member's userId). */
  opponentUserId: string | null;
  joinedAt: string;
}

export interface RoomDuesStatus {
  roomId: string;
  userId: string;
  paid: boolean;
  updatedAt: string;
}

export interface RoomReactionRow {
  id: number;
  roomId: string;
  fromUserId: string;
  toUserId: string;
  emoji: RoomReaction;
  createdAt: string;
}

/** Everything a member can see about one room, plus who "me" is. */
export interface RoomSnapshot {
  room: Room;
  members: RoomMember[];
  dues: RoomDuesStatus[];
  reactions: RoomReactionRow[];
  me: string;
}

export const EMPTY_DUES: RoomDues = { amount: null, currency: 'USD', deadline: null, payouts: [], potLink: null };
