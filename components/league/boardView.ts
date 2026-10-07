/**
 * The game-night board as the screen shows it: positions, the right-hand numbers for the phase
 * (games that count left before puck drop, points and the gap to the leader once box scores are
 * in), why a row may be off (stale or missing roster) and reaction counts. Pure —
 * `buildRoomBoard` (services/league) does the fantasy math.
 */

import type { RoomMember, RoomSnapshot } from '../../types/league';
import { rosterAgeHours, staleMembers, type RoomBoardRow } from '../../services/league';
import { isGameFinal, isGameStarted, type NhlGame } from '../../services/nhl/schedule';
import { gapText, rosterAgeText } from './format';
import { reactionCounts, type ReactionCount } from './reactions';

export interface BoardRowView {
  userId: string;
  teamName: string;
  isMe: boolean;
  /** 1-based, in board order (no shared places, like a timing tower). */
  position: number;
  playingToday: number;
  /** Playing today with no lineup slot left for them. */
  noSlot: number;
  gamesLeft: number;
  livePoints: number | null;
  /** "−3.2" behind the leader, "LEAD", or "—" before box scores. */
  gap: string;
  /** Joined, but no roster in the room yet. */
  noRoster: boolean;
  /** "updated 3 d ago" when the roster may be missing moves. */
  staleNote: string | null;
  reactions: ReactionCount[];
}

function staleNote(member: RoomMember | undefined, stale: boolean, now: Date): string | null {
  return member && stale && member.roster.length > 0 ? rosterAgeText(rosterAgeHours(member, now)) : null;
}

/** `rows` in board order (as `buildRoomBoard` returns them). */
export function boardRowViews(rows: RoomBoardRow[], snapshot: RoomSnapshot, now: Date): BoardRowView[] {
  const members = new Map(snapshot.members.map((member) => [member.userId, member]));
  const stale = new Set(staleMembers(snapshot, now).map((member) => member.userId));
  const points = rows.map((row) => row.livePoints).filter((value): value is number => value !== null);
  const leader = points.length > 0 ? Math.max(...points) : null;
  return rows.map((row, index) => ({
    userId: row.userId,
    teamName: row.teamName,
    isMe: row.isMe,
    position: index + 1,
    playingToday: row.playingToday,
    noSlot: Math.max(0, row.playingToday - row.startersToday),
    gamesLeft: row.gamesThatCountLeft,
    livePoints: row.livePoints,
    gap: gapText(row.livePoints, leader),
    noRoster: (members.get(row.userId)?.roster.length ?? 0) === 0,
    staleNote: staleNote(members.get(row.userId), stale.has(row.userId), now),
    reactions: reactionCounts(snapshot.reactions, row.userId, now),
  }));
}

/** Where tonight stands for the room's games. */
export interface NightSummary {
  games: number;
  live: number;
  final: number;
  upcoming: number;
  /** Earliest puck drop among games not started yet (ISO), or null. */
  firstPuck: string | null;
}

export function nightSummary(games: NhlGame[]): NightSummary {
  const upcoming = games.filter((game) => !isGameStarted(game));
  const firstPuck =
    upcoming
      .map((game) => game.startTimeUTC)
      .filter((time): time is string => !!time)
      .sort()[0] ?? null;
  return {
    games: games.length,
    live: games.filter((game) => isGameStarted(game) && !isGameFinal(game)).length,
    final: games.filter(isGameFinal).length,
    upcoming: upcoming.length,
    firstPuck,
  };
}

/** The board's sub-line for a row: who plays (live) and who has no slot, then any stale note. */
export function rowDetail(row: BoardRowView, live: boolean): string {
  if (row.noRoster) return 'no roster yet';
  const parts: string[] = [];
  if (live) parts.push(`${row.playingToday} playing`);
  if (row.noSlot > 0) parts.push(`${row.noSlot} no slot`);
  if (row.staleNote) parts.push(row.staleNote);
  return parts.join(' · ');
}
