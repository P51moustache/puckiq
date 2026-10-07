/**
 * Supabase rows (snake_case) ⇄ League Room types. Defensive on the way in: a row the app can't
 * use maps to null and is dropped, and jsonb columns are sanitised with the same rules the app
 * applies to its own data (slots, scoring, league size, rosters).
 *
 * jsonb shapes: `slots`, `scoring` and `roster` hold the app's own camelCase objects; only `dues`
 * uses snake_case keys (`amount, currency, deadline, payouts, pot_link`).
 */

import type { FantasyPlatform, LineupSlots, ScoringWeights } from '../../types/fantasy';
import {
  ROOM_REACTIONS,
  type Room,
  type RoomCurrency,
  type RoomDues,
  type RoomDuesStatus,
  type RoomMember,
  type RoomPayout,
  type RoomReaction,
  type RoomReactionRow,
} from '../../types/league';
import { sanitizeSlots } from '../fantasy/lineup';
import { sanitizeScoring } from '../fantasy/scoring';
import { sanitizeLeagueSize } from '../teams';
import { isHttpsLink, isIsoDate } from './dues';
import { FALLBACK_TEAM_NAME } from './moderation';
import { sanitizeRoster } from './roster';

/** Columns read from each table — the app's half of the schema contract. */
export const ROOM_COLUMNS = 'id, code, name, platform, league_size, slots, scoring, owner_id, dues, created_at, updated_at';
export const MEMBER_COLUMNS = 'room_id, user_id, team_name, roster, roster_updated_at, opponent_user_id, joined_at';
export const DUES_STATUS_COLUMNS = 'room_id, user_id, paid, updated_at';
export const REACTION_COLUMNS = 'id, room_id, from_user_id, to_user_id, emoji, created_at';

/** `rooms.dues` as stored, and as `update_room(p_dues)` expects it. */
export interface RoomDuesJson {
  amount: number | null;
  currency: RoomCurrency;
  deadline: string | null;
  payouts: RoomPayout[];
  pot_link: string | null;
}

type Row = Record<string, unknown>;

const PLATFORMS: readonly FantasyPlatform[] = ['yahoo', 'espn', 'fantrax', 'other'];
const CURRENCIES: readonly RoomCurrency[] = ['USD', 'CAD'];

function asRow(raw: unknown): Row | null {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Row) : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** PostgREST returns a set as an array and a single composite as an object; accept either. */
export function rowsOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  return data === null || data === undefined ? [] : [data];
}

export function firstRow(data: unknown): unknown {
  return rowsOf(data)[0] ?? null;
}

/** Scoring keys are camelCase like ScoringWeights; snake_case aliases are read too, in case the server normalises them. */
function scoringInput(raw: unknown): Partial<ScoringWeights> | null {
  const row = asRow(raw);
  if (!row) return null;
  return { ...row, plusMinus: row.plusMinus ?? row.plus_minus, goalsAgainst: row.goalsAgainst ?? row.goals_against } as Partial<ScoringWeights>;
}

function toPayouts(raw: unknown): RoomPayout[] {
  if (!Array.isArray(raw)) return [];
  const byPlace = new Map<number, RoomPayout>();
  for (const entry of raw) {
    const row = asRow(entry);
    const place = Number(row?.place);
    const amount = Number(row?.amount);
    if (!Number.isInteger(place) || place < 1 || !Number.isFinite(amount) || amount < 0 || byPlace.has(place)) continue;
    byPlace.set(place, { place, amount });
  }
  return [...byPlace.values()].sort((a, b) => a.place - b.place);
}

export function toRoomDues(raw: unknown): RoomDues {
  const row = asRow(raw) ?? {};
  const amount = typeof row.amount === 'number' && Number.isFinite(row.amount) && row.amount >= 0 ? row.amount : null;
  const deadline = typeof row.deadline === 'string' && isIsoDate(row.deadline) ? row.deadline : null;
  const link = row.pot_link ?? row.potLink;
  return {
    amount,
    currency: CURRENCIES.includes(row.currency as RoomCurrency) ? (row.currency as RoomCurrency) : 'USD',
    deadline,
    payouts: toPayouts(row.payouts),
    potLink: typeof link === 'string' && isHttpsLink(link.trim()) ? link.trim() : null,
  };
}

export function fromRoomDues(dues: RoomDues): RoomDuesJson {
  return {
    amount: dues.amount,
    currency: dues.currency,
    deadline: dues.deadline,
    payouts: dues.payouts.map((payout) => ({ place: payout.place, amount: payout.amount })),
    pot_link: dues.potLink,
  };
}

export function toRoom(raw: unknown): Room | null {
  const row = asRow(raw);
  const id = text(row?.id);
  const code = text(row?.code);
  if (!row || !id || !code) return null;
  return {
    id,
    code: code.toUpperCase(),
    name: text(row.name) ?? '',
    platform: PLATFORMS.includes(row.platform as FantasyPlatform) ? (row.platform as FantasyPlatform) : 'other',
    leagueSize: sanitizeLeagueSize(row.league_size),
    slots: sanitizeSlots(asRow(row.slots) as Partial<LineupSlots> | null),
    scoring: sanitizeScoring(scoringInput(row.scoring)),
    ownerId: text(row.owner_id),
    dues: toRoomDues(row.dues),
    createdAt: text(row.created_at) ?? '',
    updatedAt: text(row.updated_at) ?? '',
  };
}

export function toRoomMember(raw: unknown): RoomMember | null {
  const row = asRow(raw);
  const roomId = text(row?.room_id);
  const userId = text(row?.user_id);
  if (!row || !roomId || !userId) return null;
  const joinedAt = text(row.joined_at) ?? '';
  return {
    roomId,
    userId,
    teamName: text(row.team_name)?.trim() || FALLBACK_TEAM_NAME,
    roster: sanitizeRoster(row.roster),
    rosterUpdatedAt: text(row.roster_updated_at) ?? joinedAt,
    opponentUserId: text(row.opponent_user_id),
    joinedAt,
  };
}

export function toRoomDuesStatus(raw: unknown): RoomDuesStatus | null {
  const row = asRow(raw);
  const roomId = text(row?.room_id);
  const userId = text(row?.user_id);
  if (!row || !roomId || !userId) return null;
  return { roomId, userId, paid: row.paid === true, updatedAt: text(row.updated_at) ?? '' };
}

/** Reactions outside the preset set are dropped, never shown. */
export function toRoomReaction(raw: unknown): RoomReactionRow | null {
  const row = asRow(raw);
  const id = Number(row?.id);
  const roomId = text(row?.room_id);
  const fromUserId = text(row?.from_user_id);
  const toUserId = text(row?.to_user_id);
  const emoji = row?.emoji as RoomReaction;
  if (!row || !Number.isFinite(id) || !roomId || !fromUserId || !toUserId || !ROOM_REACTIONS.includes(emoji)) return null;
  return { id, roomId, fromUserId, toUserId, emoji, createdAt: text(row.created_at) ?? '' };
}
