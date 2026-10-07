/**
 * The app-wired exports go through lib/supabase: rpc for writes, from().select().eq() for reads,
 * auth.getSession for the signed-in user. jest.setup.js mocks only `from`, so this file brings
 * its own fake client. (jest.mock is hoisted above the imports; the fakes are only read when a
 * test calls the client.)
 */

import { createRoom, fetchRoomSnapshot } from '../api';
import { LeagueError } from '../errors';
import { makeTeam, player } from './fixtures';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockGetSession = jest.fn();

jest.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getSession: () => mockGetSession(), getUser: jest.fn() },
  },
}));

const room = {
  id: 'room-1',
  code: 'ABC234',
  name: 'Beer League',
  platform: 'yahoo',
  league_size: 12,
  slots: {},
  scoring: {},
  owner_id: 'u-me',
  dues: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

const tableData: Record<string, unknown[]> = {
  rooms: [room],
  room_members: [
    { room_id: 'room-1', user_id: 'u-me', team_name: 'Zach Attack', roster: [], roster_updated_at: 'x', opponent_user_id: null, joined_at: 'x' },
  ],
  room_dues_status: [],
  room_reactions: [],
};

interface QueryChain {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise<unknown>;
}

/** A thenable PostgREST-style builder that records its chain. */
function builder(table: string): QueryChain {
  const chain: QueryChain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    then: (resolve, reject) => Promise.resolve({ data: tableData[table], error: null }).then(resolve, reject),
  };
  return chain;
}

beforeEach(() => {
  mockRpc.mockReset();
  mockFrom.mockReset();
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u-me' } } } });
});

describe('app-wired League API', () => {
  it('creates a room through supabase.rpc', async () => {
    mockRpc.mockResolvedValue({ data: room, error: null });
    const team = makeTeam({ players: [player(8470001, 'Connor Star', 'EDM', 'C')] });
    const created = await createRoom(team, { roomName: 'Beer League' });
    expect(created.code).toBe('ABC234');
    expect(mockRpc).toHaveBeenCalledWith('create_room', expect.objectContaining({ p_name: 'Beer League', p_team_name: 'Zach Attack' }));
  });

  it('needs a session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(createRoom(makeTeam())).rejects.toEqual(expect.objectContaining({ code: 'not_signed_in' }));
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('reads the snapshot with RLS-filtered selects', async () => {
    const chains = new Map<string, QueryChain>();
    mockFrom.mockImplementation((table: string) => {
      const chain = builder(table);
      chains.set(table, chain);
      return chain;
    });
    const snapshot = await fetchRoomSnapshot('room-1', 'u-me');
    expect(snapshot.room.id).toBe('room-1');
    expect(snapshot.members.map((member) => member.teamName)).toEqual(['Zach Attack']);
    expect(chains.get('rooms')?.eq).toHaveBeenCalledWith('id', 'room-1');
    expect(chains.get('room_members')?.eq).toHaveBeenCalledWith('room_id', 'room-1');
    expect(chains.get('room_reactions')?.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chains.get('room_reactions')?.limit).toHaveBeenCalledWith(200);
  });

  it('wraps a failing client in a LeagueError', async () => {
    mockRpc.mockRejectedValue(new TypeError('Network request failed'));
    await expect(createRoom(makeTeam())).rejects.toBeInstanceOf(LeagueError);
  });
});
