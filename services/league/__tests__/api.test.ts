import { createLeagueApi, DEFAULT_ROOM_NAME, REACTIONS_FETCH_LIMIT } from '../api';
import type { BackendResult, LeagueBackend, LeagueTable, SelectQuery } from '../backend';
import { LeagueError, type LeagueErrorCode } from '../errors';
import { makeTeam, player } from './fixtures';

const roomRow = (patch: Record<string, unknown> = {}) => ({
  id: 'room-1',
  code: 'ABC234',
  name: 'Beer League',
  platform: 'yahoo',
  league_size: 12,
  slots: { C: 2, LW: 2, RW: 2, F: 0, D: 4, UTIL: 1, G: 2 },
  scoring: {},
  owner_id: 'u-me',
  dues: { amount: null, currency: 'USD', deadline: null, payouts: [], pot_link: null },
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...patch,
});

const memberRow = (userId: string, joinedAt: string, patch: Record<string, unknown> = {}) => ({
  room_id: 'room-1',
  user_id: userId,
  team_name: `Team ${userId}`,
  roster: [],
  roster_updated_at: joinedAt,
  opponent_user_id: null,
  joined_at: joinedAt,
  ...patch,
});

const ok = (data: unknown): BackendResult => ({ data, error: null });
const fail = (message: string, code = 'P0001'): BackendResult => ({ data: null, error: { message, code, details: null, hint: null } });

interface FakeOptions {
  userId?: string | null;
  rpc?: (name: string, args: Record<string, unknown>) => BackendResult;
  tables?: Partial<Record<LeagueTable, BackendResult>>;
}

function fakeBackend(options: FakeOptions = {}) {
  const rpc = jest.fn(async (name: string, args: Record<string, unknown>) => options.rpc?.(name, args) ?? ok(null));
  const select = jest.fn(async (query: SelectQuery) => options.tables?.[query.table] ?? ok([]));
  const currentUserId = jest.fn(async () => (options.userId === undefined ? 'u-me' : options.userId));
  const backend: LeagueBackend = { rpc, select, currentUserId };
  return { api: createLeagueApi({ backend, configured: true }), backend, rpc, select, currentUserId };
}

async function codeOf(promise: Promise<unknown>): Promise<LeagueErrorCode> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(LeagueError);
    return (error as LeagueError).code;
  }
  throw new Error('expected a LeagueError');
}

const team = makeTeam({
  name: '  Zach   Attack ',
  players: [
    player(8470001, 'Connor Star', 'EDM', 'C'),
    player(8470002, 'On IR', 'EDM', 'D', { injuredReserve: true }),
    player(1_756_000_000_000_001, 'Typed Name', '', 'C'),
  ],
});

describe('guards', () => {
  it('fails fast without Supabase keys', async () => {
    const { backend, rpc, select } = fakeBackend();
    const api = createLeagueApi({ backend, configured: false });
    expect(await codeOf(api.createRoom(team))).toBe('not_configured');
    expect(await codeOf(api.fetchRoomSnapshot('room-1', 'u-me'))).toBe('not_configured');
    expect(rpc).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it('needs a signed-in user', async () => {
    const { api, rpc } = fakeBackend({ userId: null });
    expect(await codeOf(api.joinRoom('ABC234', team))).toBe('not_signed_in');
    expect(await codeOf(api.fetchRoomSnapshot('room-1', ''))).toBe('not_signed_in');
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('createRoom', () => {
  it('sends the team’s league settings, a tidy team name and the uploadable roster', async () => {
    const { api, rpc } = fakeBackend({ rpc: () => ok(roomRow()) });
    const room = await api.createRoom(team);
    expect(rpc).toHaveBeenCalledWith('create_room', {
      p_name: DEFAULT_ROOM_NAME,
      p_platform: 'yahoo',
      p_league_size: 12,
      p_slots: team.slots,
      p_scoring: team.scoring,
      p_team_name: 'Zach Attack',
      p_roster: [team.players[0], team.players[1]],
    });
    expect(room).toMatchObject({ id: 'room-1', code: 'ABC234', leagueSize: 12, ownerId: 'u-me' });
  });

  it('accepts the room row as a one-element list too', async () => {
    const { api } = fakeBackend({ rpc: () => ok([roomRow({ name: 'Pond Hockey' })]) });
    expect((await api.createRoom(team, { roomName: 'Pond Hockey' })).name).toBe('Pond Hockey');
  });

  it('rejects a blocked room name before calling the server', async () => {
    const { api, rpc } = fakeBackend();
    expect(await codeOf(api.createRoom(team, { roomName: 'Fuck Bettman' }))).toBe('invalid_name');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('treats a reply that isn’t a room as a failed round trip', async () => {
    const { api } = fakeBackend({ rpc: () => ok(null) });
    expect(await codeOf(api.createRoom(team))).toBe('network');
  });
});

describe('joinRoom', () => {
  it('accepts an invite link and sends the canonical code', async () => {
    const { api, rpc } = fakeBackend({ rpc: () => ok(roomRow()) });
    await api.joinRoom('https://p51moustache.github.io/puckiq/join.html?code=abc234', team);
    expect(rpc).toHaveBeenCalledWith('join_room', expect.objectContaining({ p_code: 'ABC234', p_team_name: 'Zach Attack' }));
  });

  it('rejects a malformed code locally', async () => {
    const { api, rpc } = fakeBackend();
    expect(await codeOf(api.joinRoom('ABC1', team))).toBe('invalid_code');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('surfaces the server’s reason with its copy', async () => {
    const { api } = fakeBackend({ rpc: () => fail('room_full') });
    await expect(api.joinRoom('ABC234', team)).rejects.toThrow('That room is full — every team in the league has joined.');
  });

  it('reports a backend that isn’t deployed yet as unavailable', async () => {
    const notDeployed = {
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.join_room(p_code, p_roster, p_team_name) in the schema cache' },
      status: 404,
    };
    expect(await codeOf(fakeBackend({ rpc: () => notDeployed }).api.joinRoom('ABC234', team))).toBe('unavailable');
    // A bare 404 with nothing useful in the body still counts: the status travels with the error.
    const bare = { data: null, error: { message: '' }, status: 404 };
    expect(await codeOf(fakeBackend({ rpc: () => bare }).api.joinRoom('ABC234', team))).toBe('unavailable');
  });

  it('maps a thrown transport error to network', async () => {
    const { api, rpc } = fakeBackend();
    rpc.mockRejectedValueOnce(new TypeError('Network request failed'));
    expect(await codeOf(api.joinRoom('ABC234', team))).toBe('network');
  });
});

describe('fetchRoomSnapshot', () => {
  const tables: Partial<Record<LeagueTable, BackendResult>> = {
    rooms: ok([roomRow()]),
    room_members: ok([memberRow('u-ben', '2026-10-03T00:00:00Z'), memberRow('u-me', '2026-10-01T00:00:00Z')]),
    room_dues_status: ok([{ room_id: 'room-1', user_id: 'u-ben', paid: true, updated_at: '2026-10-04T00:00:00Z' }]),
    room_reactions: ok([
      { id: 2, room_id: 'room-1', from_user_id: 'u-ben', to_user_id: 'u-me', emoji: '🧂', created_at: '2026-10-14T02:00:00Z' },
      { id: 1, room_id: 'room-1', from_user_id: 'u-ben', to_user_id: 'u-me', emoji: 'lol', created_at: '2026-10-14T01:00:00Z' },
    ]),
  };

  it('reads the four tables in parallel, filtered by room', async () => {
    const { api, select } = fakeBackend({ tables });
    await api.fetchRoomSnapshot('room-1', 'u-me');
    const queries = select.mock.calls.map(([query]) => query);
    expect(queries.map((query) => [query.table, query.match])).toEqual([
      ['rooms', { column: 'id', value: 'room-1' }],
      ['room_members', { column: 'room_id', value: 'room-1' }],
      ['room_dues_status', { column: 'room_id', value: 'room-1' }],
      ['room_reactions', { column: 'room_id', value: 'room-1' }],
    ]);
    expect(queries[3]).toMatchObject({ order: { column: 'created_at', ascending: false }, limit: REACTIONS_FETCH_LIMIT });
  });

  it('maps rows, orders members by join time and drops unknown reactions', async () => {
    const { api } = fakeBackend({ tables });
    const snapshot = await api.fetchRoomSnapshot('room-1', 'u-me');
    expect(snapshot.me).toBe('u-me');
    expect(snapshot.room.code).toBe('ABC234');
    expect(snapshot.members.map((member) => member.userId)).toEqual(['u-me', 'u-ben']);
    expect(snapshot.dues).toEqual([{ roomId: 'room-1', userId: 'u-ben', paid: true, updatedAt: '2026-10-04T00:00:00Z' }]);
    expect(snapshot.reactions.map((reaction) => reaction.emoji)).toEqual(['🧂']);
  });

  it('reports not_member when the room is hidden (closed, or I was removed)', async () => {
    expect(await codeOf(fakeBackend({ tables: { ...tables, rooms: ok([]) } }).api.fetchRoomSnapshot('room-1', 'u-me'))).toBe('not_member');
    const withoutMe = { ...tables, room_members: ok([memberRow('u-ben', '2026-10-03T00:00:00Z')]) };
    expect(await codeOf(fakeBackend({ tables: withoutMe }).api.fetchRoomSnapshot('room-1', 'u-me'))).toBe('not_member');
  });

  it('maps a failed select', async () => {
    const { api } = fakeBackend({ tables: { ...tables, room_members: fail('JWT expired', 'PGRST301') } });
    expect(await codeOf(api.fetchRoomSnapshot('room-1', 'u-me'))).toBe('not_signed_in');
  });

  it('reports missing tables as unavailable', async () => {
    const { api } = fakeBackend({ tables: { ...tables, rooms: fail('relation "public.rooms" does not exist', '42P01') } });
    expect(await codeOf(api.fetchRoomSnapshot('room-1', 'u-me'))).toBe('unavailable');
  });
});

describe('membership and room updates', () => {
  it('sends my whole membership, opponent included', async () => {
    const { api, rpc } = fakeBackend();
    await api.updateMembership('room-1', team, 'u-ben');
    expect(rpc).toHaveBeenCalledWith('update_membership', {
      p_room: 'room-1',
      p_team_name: 'Zach Attack',
      p_roster: [team.players[0], team.players[1]],
      p_opponent: 'u-ben',
    });
  });

  it('won’t make me my own opponent', async () => {
    const { api, rpc } = fakeBackend();
    expect(await codeOf(api.updateMembership('room-1', team, 'u-me'))).toBe('invalid_opponent');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sends a clean name and snake_case dues, and returns the room', async () => {
    const { api, rpc } = fakeBackend({ rpc: () => ok(roomRow({ name: 'Pond Hockey' })) });
    const dues = { amount: 50, currency: 'USD' as const, deadline: '2026-10-31', payouts: [{ place: 2, amount: 100 }, { place: 1, amount: 400 }], potLink: ' ' };
    const room = await api.updateRoom('room-1', '  Pond  Hockey ', dues);
    expect(rpc).toHaveBeenCalledWith('update_room', {
      p_room: 'room-1',
      p_name: 'Pond Hockey',
      p_dues: { amount: 50, currency: 'USD', deadline: '2026-10-31', payouts: [{ place: 1, amount: 400 }, { place: 2, amount: 100 }], pot_link: null },
    });
    expect(room.name).toBe('Pond Hockey');
  });

  it('rejects bad dues and bad names locally', async () => {
    const { api, rpc } = fakeBackend();
    const dues = { amount: 50, currency: 'USD' as const, deadline: null, payouts: [], potLink: 'http://pot.example.com' };
    expect(await codeOf(api.updateRoom('room-1', 'Pond Hockey', dues))).toBe('invalid_dues');
    expect(await codeOf(api.updateRoom('room-1', '🔥', { ...dues, potLink: null }))).toBe('invalid_name');
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('owner and member actions', () => {
  it('passes the p_ arguments through', async () => {
    const { api, rpc } = fakeBackend({ rpc: (name) => (name === 'rotate_room_code' ? ok(roomRow({ code: 'XYZ789' })) : ok(null)) });
    await api.leaveRoom('room-1');
    await api.setDuesPaid('room-1', 'u-ben', true);
    await api.removeMember('room-1', 'u-ben');
    await api.react('room-1', 'u-ben', '🔥');
    expect((await api.rotateRoomCode('room-1')).code).toBe('XYZ789');
    expect(rpc.mock.calls).toEqual([
      ['leave_room', { p_room: 'room-1' }],
      ['set_dues_paid', { p_room: 'room-1', p_user: 'u-ben', p_paid: true }],
      ['remove_member', { p_room: 'room-1', p_user: 'u-ben' }],
      ['react', { p_room: 'room-1', p_to_user: 'u-ben', p_emoji: '🔥' }],
      ['rotate_room_code', { p_room: 'room-1' }],
    ]);
  });

  it('never removes yourself and only sends preset reactions', async () => {
    const { api, rpc } = fakeBackend();
    expect(await codeOf(api.removeMember('room-1', 'u-me'))).toBe('cannot_remove_self');
    expect(await codeOf(api.react('room-1', 'u-ben', 'lol' as never))).toBe('invalid_input');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps the rate limit', async () => {
    const { api } = fakeBackend({ rpc: () => fail('rate_limited') });
    expect(await codeOf(api.react('room-1', 'u-ben', '🔥'))).toBe('rate_limited');
  });
});
