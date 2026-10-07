import { isLeagueError, isLeagueUnavailable, LEAGUE_ERROR_CODES, LeagueError, leagueErrorMessage, toLeagueError } from '../errors';

const CLIENT_ONLY = ['not_configured', 'network', 'unavailable'];
const BACKEND_CODES = LEAGUE_ERROR_CODES.filter((code) => !CLIENT_ONLY.includes(code));

describe('toLeagueError', () => {
  it('finds the backend code inside a PostgREST error and carries user-facing copy', () => {
    const error = toLeagueError({ message: 'room_full', code: 'P0001', details: null, hint: null });
    expect(error).toBeInstanceOf(LeagueError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('room_full');
    expect(error.message).toBe('That room is full — every team in the league has joined.');
  });

  it('matches every backend code, however it is wrapped', () => {
    for (const code of BACKEND_CODES) {
      expect(toLeagueError(new Error(`ERROR:  ${code} (SQLSTATE P0001)`)).code).toBe(code);
    }
  });

  it('reads the code from details when the message is generic', () => {
    expect(toLeagueError({ message: 'Request failed', details: 'not_owner' }).code).toBe('not_owner');
  });

  it('reads an expired session as not signed in', () => {
    expect(toLeagueError({ message: 'JWT expired', code: 'PGRST301' }).code).toBe('not_signed_in');
  });

  it('reads malformed-input SQLSTATEs as invalid input', () => {
    expect(toLeagueError({ message: 'invalid input syntax for type uuid: "x"', code: '22P02' }).code).toBe('invalid_input');
  });

  it('treats anything else as network and keeps the original as the cause', () => {
    const original = new TypeError('Network request failed');
    const error = toLeagueError(original);
    expect(error.code).toBe('network');
    expect(error.cause).toBe(original);
    expect(toLeagueError(undefined).code).toBe('network');
  });

  it('accepts plain strings and passes LeagueErrors through untouched', () => {
    expect(toLeagueError('rate_limited').code).toBe('rate_limited');
    const error = new LeagueError('not_owner');
    expect(toLeagueError(error)).toBe(error);
  });
});

describe('backend not deployed yet', () => {
  it.each([
    ['PGRST202', 'Could not find the function public.create_room(p_league_size, p_name, p_platform) in the schema cache'],
    ['PGRST205', 'Could not find the table \'public.room_members\' in the schema cache'],
    ['42P01', 'relation "public.rooms" does not exist'],
    ['42883', 'function public.react(uuid, uuid, text) does not exist'],
  ])('reads %s as unavailable', (code, message) => {
    expect(toLeagueError({ code, message, details: null, hint: null }).code).toBe('unavailable');
    expect(toLeagueError(new Error(message)).code).toBe('unavailable');
  });

  it('reads an HTTP 404 as unavailable, unless the backend named a reason', () => {
    expect(toLeagueError({ message: 'Not Found' }, 404).code).toBe('unavailable');
    expect(toLeagueError({ message: 'room_not_found' }, 404).code).toBe('room_not_found');
    expect(toLeagueError({ message: 'Not Found' }).code).toBe('network');
  });

  it('never treats the word itself as a code', () => {
    expect(toLeagueError(new Error('Service unavailable')).code).toBe('network');
  });

  it('has calm copy and a helper for the "coming soon" state', () => {
    expect(leagueErrorMessage('unavailable')).toBe('League Rooms aren’t switched on yet. Check back soon.');
    expect(isLeagueUnavailable({ code: 'PGRST202', message: 'Could not find the function public.join_room' })).toBe(true);
    expect(isLeagueUnavailable(new LeagueError('unavailable'))).toBe(true);
    expect(isLeagueUnavailable(new LeagueError('room_full'))).toBe(false);
    expect(isLeagueUnavailable(new TypeError('Network request failed'))).toBe(false);
  });
});

describe('leagueErrorMessage', () => {
  it('has copy for every code', () => {
    for (const code of LEAGUE_ERROR_CODES) expect(leagueErrorMessage(code).length).toBeGreaterThan(10);
  });
});

describe('isLeagueError', () => {
  it('checks the type and, optionally, the code', () => {
    const error = new LeagueError('room_full');
    expect(isLeagueError(error)).toBe(true);
    expect(isLeagueError(error, 'room_full')).toBe(true);
    expect(isLeagueError(error, 'network')).toBe(false);
    expect(isLeagueError(new Error('room_full'))).toBe(false);
    expect(error.name).toBe('LeagueError');
  });
});
