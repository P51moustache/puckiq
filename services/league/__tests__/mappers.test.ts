import { EMPTY_DUES } from '../../../types/league';
import { STANDARD_SLOTS } from '../../fantasy/lineup';
import { DEFAULT_SCORING } from '../../fantasy/scoring';
import {
  firstRow,
  fromRoomDues,
  rowsOf,
  toRoom,
  toRoomDues,
  toRoomDuesStatus,
  toRoomMember,
  toRoomReaction,
} from '../mappers';
import { FALLBACK_TEAM_NAME } from '../moderation';
import { ROOM_ROSTER_MAX, rosterForUpload, sanitizeRoster } from '../roster';
import { player } from './fixtures';

const roomRow = {
  id: 'room-1',
  code: 'abc234',
  name: 'Beer League',
  platform: 'espn',
  league_size: 12,
  slots: { C: 2, LW: 2, RW: 2, F: 0, D: 4, UTIL: 1, G: 2 },
  scoring: { ...DEFAULT_SCORING, goals: 6 },
  owner_id: 'u-owner',
  dues: {
    amount: 50,
    currency: 'CAD',
    deadline: '2026-10-31',
    payouts: [{ place: 2, amount: 150 }, { place: 1, amount: 350 }],
    pot_link: 'https://www.leaguesafe.com/league/42',
  },
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-02T00:00:00Z',
};

describe('toRoom', () => {
  it('maps a snake_case row to a Room', () => {
    expect(toRoom(roomRow)).toEqual({
      id: 'room-1',
      code: 'ABC234',
      name: 'Beer League',
      platform: 'espn',
      leagueSize: 12,
      slots: STANDARD_SLOTS,
      scoring: { ...DEFAULT_SCORING, goals: 6 },
      ownerId: 'u-owner',
      dues: {
        amount: 50,
        currency: 'CAD',
        deadline: '2026-10-31',
        payouts: [{ place: 1, amount: 350 }, { place: 2, amount: 150 }],
        potLink: 'https://www.leaguesafe.com/league/42',
      },
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-02T00:00:00Z',
    });
  });

  it('sanitises junk jsonb and unknown values with the app’s own rules', () => {
    const room = toRoom({ ...roomRow, platform: 'myspace', league_size: 99, slots: 'nope', scoring: { plus_minus: 1, goals_against: -2 }, dues: null, owner_id: null });
    expect(room?.platform).toBe('other');
    expect(room?.leagueSize).toBe(20);
    expect(room?.slots).toEqual(STANDARD_SLOTS);
    expect(room?.scoring).toEqual({ ...DEFAULT_SCORING, plusMinus: 1, goalsAgainst: -2 });
    expect(room?.dues).toEqual(EMPTY_DUES);
    expect(room?.ownerId).toBeNull();
  });

  it('drops rows without an id or code', () => {
    expect(toRoom({ ...roomRow, id: '' })).toBeNull();
    expect(toRoom({ ...roomRow, code: undefined })).toBeNull();
    expect(toRoom(null)).toBeNull();
    expect(toRoom([roomRow])).toBeNull();
  });
});

describe('dues jsonb', () => {
  it('keeps only valid fields, an https pot link and one payout per place', () => {
    expect(
      toRoomDues({
        amount: -5,
        currency: 'EUR',
        deadline: '2026-02-30',
        payouts: [{ place: 1, amount: 100 }, { place: 1, amount: 50 }, { place: 0, amount: 10 }, { place: 2, amount: -1 }, 'x'],
        pot_link: 'http://leaguesafe.com',
      }),
    ).toEqual({ amount: null, currency: 'USD', deadline: null, payouts: [{ place: 1, amount: 100 }], potLink: null });
  });

  it('round-trips through the snake_case shape update_room expects', () => {
    const dues = toRoomDues(roomRow.dues);
    expect(fromRoomDues(dues)).toEqual({
      amount: 50,
      currency: 'CAD',
      deadline: '2026-10-31',
      payouts: [{ place: 1, amount: 350 }, { place: 2, amount: 150 }],
      pot_link: 'https://www.leaguesafe.com/league/42',
    });
    expect(toRoomDues(fromRoomDues(dues))).toEqual(dues);
  });
});

describe('toRoomMember', () => {
  const row = {
    room_id: 'room-1',
    user_id: 'u-ben',
    team_name: '  Ben’s Bombers ',
    roster: [
      player(8470001, 'Connor Star', 'edm', 'C', { eligible: ['C', 'LW', 'XX' as never] }),
      player(8470001, 'Connor Star', 'EDM', 'C'),
      player(8470002, 'Hurt Guy', 'TOR', 'D', { injuredReserve: true }),
      { playerId: 'x', playerName: 'Broken' },
      { playerId: 8470003, playerName: '   ' },
    ],
    roster_updated_at: '2026-10-13T10:00:00Z',
    opponent_user_id: 'u-me',
    joined_at: '2026-10-01T00:00:00Z',
  };

  it('maps the row and sanitises the roster (valid, unique, upper-case team, IR kept)', () => {
    const mapped = toRoomMember(row);
    expect(mapped).toMatchObject({ roomId: 'room-1', userId: 'u-ben', teamName: 'Ben’s Bombers', opponentUserId: 'u-me', rosterUpdatedAt: '2026-10-13T10:00:00Z' });
    expect(mapped?.roster).toEqual([
      { playerId: 8470001, playerName: 'Connor Star', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN', eligible: ['C', 'LW'] },
      { playerId: 8470002, playerName: 'Hurt Guy', teamAbbrev: 'TOR', position: 'D', rosterPosition: 'BN', injuredReserve: true },
    ]);
  });

  it('falls back for a blank name and a missing roster timestamp', () => {
    const mapped = toRoomMember({ ...row, team_name: ' ', roster_updated_at: null, roster: null });
    expect(mapped?.teamName).toBe(FALLBACK_TEAM_NAME);
    expect(mapped?.rosterUpdatedAt).toBe('2026-10-01T00:00:00Z');
    expect(mapped?.roster).toEqual([]);
  });

  it('drops rows without ids', () => {
    expect(toRoomMember({ ...row, user_id: null })).toBeNull();
  });
});

describe('statuses and reactions', () => {
  it('only counts dues as paid when paid is exactly true', () => {
    expect(toRoomDuesStatus({ room_id: 'room-1', user_id: 'u-1', paid: true, updated_at: 'x' })?.paid).toBe(true);
    expect(toRoomDuesStatus({ room_id: 'room-1', user_id: 'u-1', paid: 'yes', updated_at: 'x' })?.paid).toBe(false);
  });

  it('keeps preset reactions and drops anything else', () => {
    const base = { id: 7, room_id: 'room-1', from_user_id: 'u-1', to_user_id: 'u-2', created_at: '2026-10-14T01:00:00Z' };
    expect(toRoomReaction({ ...base, emoji: '🔥' })).toEqual({
      id: 7,
      roomId: 'room-1',
      fromUserId: 'u-1',
      toUserId: 'u-2',
      emoji: '🔥',
      createdAt: '2026-10-14T01:00:00Z',
    });
    expect(toRoomReaction({ ...base, emoji: 'you suck' })).toBeNull();
    expect(toRoomReaction({ ...base, id: 'seven', emoji: '🔥' })).toBeNull();
  });
});

describe('result shapes', () => {
  it('reads PostgREST data as a list or a single row', () => {
    expect(rowsOf([1, 2])).toEqual([1, 2]);
    expect(rowsOf({ id: 1 })).toEqual([{ id: 1 }]);
    expect(rowsOf(null)).toEqual([]);
    expect(firstRow([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 });
    expect(firstRow([])).toBeNull();
  });
});

describe('roster upload', () => {
  it('keeps IR players, leaves out unlinked 2.x names and strips unknown fields', () => {
    const upload = rosterForUpload([
      player(8470001, 'Linked', 'EDM', 'C'),
      player(8470002, 'On IR', 'EDM', 'D', { injuredReserve: true }),
      player(1_756_000_000_000_001, 'Typed Name', '', 'C'),
      { ...player(8470003, 'Extra', 'TOR', 'G'), localNote: 'secret' } as never,
    ]);
    expect(upload.map((p) => p.playerId)).toEqual([8470001, 8470002, 8470003]);
    expect(upload[2]).not.toHaveProperty('localNote');
  });

  it('caps the roster at the room limit', () => {
    const many = Array.from({ length: ROOM_ROSTER_MAX + 5 }, (_, index) => player(8_400_000 + index, `P${index}`, 'EDM', 'C'));
    expect(rosterForUpload(many)).toHaveLength(ROOM_ROSTER_MAX);
    expect(sanitizeRoster(many)).toHaveLength(ROOM_ROSTER_MAX);
    expect(sanitizeRoster('not a list')).toEqual([]);
  });
});
