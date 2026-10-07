/**
 * Preset reactions on the game-night board: what each member received lately. Pure.
 */

import { ROOM_REACTIONS, type RoomReaction, type RoomReactionRow } from '../../types/league';

/**
 * Counts cover one game night's worth of reactions; older ones drop off the board (the backend
 * keeps them a week, then purges them).
 */
export const REACTION_WINDOW_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

export interface ReactionCount {
  emoji: RoomReaction;
  count: number;
}

/** Reactions `toUserId` received in the window, in ROOM_REACTIONS order, zeros left out. */
export function reactionCounts(
  reactions: RoomReactionRow[],
  toUserId: string,
  now: Date,
  windowHours: number = REACTION_WINDOW_HOURS,
): ReactionCount[] {
  const since = now.getTime() - windowHours * HOUR_MS;
  const counts = new Map<RoomReaction, number>();
  for (const row of reactions) {
    if (row.toUserId !== toUserId) continue;
    const at = Date.parse(row.createdAt);
    if (!Number.isFinite(at) || at < since) continue;
    counts.set(row.emoji, (counts.get(row.emoji) ?? 0) + 1);
  }
  return ROOM_REACTIONS.filter((emoji) => counts.has(emoji)).map((emoji) => ({ emoji, count: counts.get(emoji) ?? 0 }));
}
