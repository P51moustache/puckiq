import type { FantasyPlayer, FantasyTeam, LineupSlots } from '../../../types/fantasy';
import { EMPTY_DUES, type Room, type RoomMember, type RoomSnapshot } from '../../../types/league';
import type { GameLine } from '../../nhl/gamecenter';
import { STANDARD_SLOTS } from '../../fantasy/lineup';
import { DEFAULT_SCORING } from '../../fantasy/scoring';

export { busyNight, game, player, week } from '../../fantasy/__tests__/fixtures';

export const ROOM_ID = 'room-1';
export const ME = 'u-me';
/** Wednesday of the fixture week; members' rosters were pushed at this moment unless a test says otherwise. */
export const NOW = new Date('2026-10-14T12:00:00.000Z');

export function slotsOf(partial: Partial<LineupSlots>): LineupSlots {
  return { C: 0, LW: 0, RW: 0, F: 0, D: 0, UTIL: 0, G: 0, ...partial };
}

export function makeRoom(patch: Partial<Room> = {}): Room {
  return {
    id: ROOM_ID,
    code: 'ABC234',
    name: 'Beer League',
    platform: 'yahoo',
    leagueSize: 10,
    slots: slotsOf({ C: 1, D: 1, G: 1 }),
    scoring: { ...DEFAULT_SCORING },
    ownerId: ME,
    dues: { ...EMPTY_DUES, payouts: [] },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...patch,
  };
}

export function member(userId: string, teamName: string, roster: FantasyPlayer[] = [], patch: Partial<RoomMember> = {}): RoomMember {
  return {
    roomId: ROOM_ID,
    userId,
    teamName,
    roster,
    rosterUpdatedAt: NOW.toISOString(),
    opponentUserId: null,
    joinedAt: '2026-10-01T00:00:00.000Z',
    ...patch,
  };
}

export function snapshotOf(members: RoomMember[], patch: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return { room: makeRoom(), members, dues: [], reactions: [], me: ME, ...patch };
}

export function makeTeam(patch: Partial<FantasyTeam> = {}): FantasyTeam {
  return {
    id: 'team-1',
    name: 'Zach Attack',
    platform: 'yahoo',
    leagueSize: 12,
    minGoalieStarts: 0,
    slots: STANDARD_SLOTS,
    scoring: { ...DEFAULT_SCORING },
    players: [],
    opponentName: '',
    opponent: [],
    hiddenPickupIds: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...patch,
  };
}

/** A box-score line with every stat at zero unless given. */
export function line(playerId: number, stats: Partial<GameLine> = {}): GameLine {
  return {
    playerId,
    isGoalie: false,
    goals: 0,
    assists: 0,
    points: 0,
    shots: 0,
    hits: 0,
    blocks: 0,
    plusMinus: 0,
    powerPlayGoals: 0,
    pim: 0,
    toi: '15:00',
    saves: 0,
    shotsAgainst: 0,
    goalsAgainst: 0,
    ...stats,
  };
}
