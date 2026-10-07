/**
 * A roster as the League Room stores it (`room_members.roster`, a `FantasyPlayer[]`). Players
 * are validated with the app's one sanitiser (`sanitizePlayer` in services/teams.ts).
 */

import type { FantasyPlayer } from '../../types/fantasy';
import { isNhlLinked } from '../fantasy/positions';
import { sanitizePlayer } from '../teams';

/** `room_members.roster` holds at most this many players; the backend rejects more. */
export const ROOM_ROSTER_MAX = 30;

/** One player from untrusted JSON, or null when it isn't a usable player. */
export const sanitizeRosterPlayer = sanitizePlayer;

function collectPlayers(raw: unknown, keep: (player: FantasyPlayer) => boolean): FantasyPlayer[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: FantasyPlayer[] = [];
  for (const row of raw) {
    const player = sanitizeRosterPlayer(row);
    if (!player || seen.has(player.playerId) || !keep(player)) continue;
    seen.add(player.playerId);
    out.push(player);
    if (out.length === ROOM_ROSTER_MAX) break;
  }
  return out;
}

/** A roster read from the room: valid players only, first copy of each, at most ROOM_ROSTER_MAX. */
export function sanitizeRoster(raw: unknown): FantasyPlayer[] {
  return collectPlayers(raw, () => true);
}

/**
 * What this device uploads for its team. IR players stay — they're still rostered, so they're
 * still taken. Players typed in PuckIQ 2.x that never linked to an NHL id are left out: their
 * ids are device-local placeholders no other member can plan with or match in Pickups.
 */
export function rosterForUpload(players: FantasyPlayer[]): FantasyPlayer[] {
  return collectPlayers(players, isNhlLinked);
}
