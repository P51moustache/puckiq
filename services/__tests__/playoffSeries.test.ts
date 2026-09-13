import type { ArenaGame } from '../../types/arena';
import { supabase } from '../../lib/supabase';
import { fetchPlayoffSeries, summarizePlayoffSeries } from '../playoffSeries';

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

let queryResult: { data: unknown[] | null; error: unknown } = { data: [], error: null };
const builder: Record<string, jest.Mock | ((resolve: (value: unknown) => unknown) => Promise<unknown>)> = {};
const select = jest.fn(() => builder);
const eq = jest.fn(() => builder);
const or = jest.fn(() => builder);
const order = jest.fn(() => builder);
Object.assign(builder, {
  select,
  eq,
  or,
  order,
  then: (resolve: (value: unknown) => unknown) => Promise.resolve(queryResult).then(resolve),
});
const from = supabase.from as jest.Mock;
from.mockImplementation(() => builder);

function game(overrides: Partial<ArenaGame> = {}): ArenaGame {
  return {
    id: 2025030001,
    season: 20252026,
    game_date: '2026-04-20',
    start_time_utc: '2026-04-20T23:00:00Z',
    game_type: 3,
    game_state: 'FINAL',
    home_team_abbrev: 'EDM',
    away_team_abbrev: 'LAK',
    home_score: 3,
    away_score: 2,
    venue: null,
    updated_at: '2026-04-21T04:00:00Z',
    forecast: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  queryResult = { data: [], error: null };
});

describe('summarizePlayoffSeries', () => {
  it('counts only known non-tied final results for the exact season and pairing', () => {
    const anchor = game();
    const rows = [
      anchor,
      game({ id: 2025030002, home_team_abbrev: 'LAK', away_team_abbrev: 'EDM', home_score: 4, away_score: 1 }),
      game({ id: 2025030003, home_score: 2, away_score: 2 }),
      game({ id: 2025030004, home_score: null, away_score: null }),
      game({ id: 2025030005, game_state: 'FUT', home_score: 9, away_score: 0 }),
      game({ id: 2025030006, season: 20242025 }),
      game({ id: 2025030007, game_type: 2 }),
      game({ id: 2025030008, away_team_abbrev: 'VGK' }),
    ];

    const result = summarizePlayoffSeries(rows, anchor);
    expect(result.games.map(item => item.id)).toEqual([2025030001, 2025030002, 2025030003, 2025030004, 2025030005]);
    expect(result.awayWins).toBe(1);
    expect(result.homeWins).toBe(1);
  });

  it('counts a consistent duplicate game ID once', () => {
    const anchor = game();
    const result = summarizePlayoffSeries([anchor, { ...anchor }], anchor);
    expect(result.games).toHaveLength(1);
    expect(result).toMatchObject({ awayWins: 0, homeWins: 1 });
  });

  it('preserves a conflicting duplicate game as an unknown result', () => {
    const anchor = game();
    const result = summarizePlayoffSeries([
      anchor,
      { ...anchor, home_score: 1, away_score: 4 },
      game({ id: 0 }),
    ], anchor);
    expect(result.games).toHaveLength(1);
    expect(result.games[0]).toMatchObject({ id: anchor.id, home_score: null, away_score: null });
    expect(result).toMatchObject({ awayWins: 0, homeWins: 0 });
  });
});

describe('fetchPlayoffSeries', () => {
  it('queries exact playoff season and both team orientations', async () => {
    const anchor = game();
    queryResult = { data: [anchor], error: null };

    await expect(fetchPlayoffSeries(anchor)).resolves.toEqual({ games: [anchor], awayWins: 0, homeWins: 1 });
    expect(from).toHaveBeenCalledWith('games');
    expect(eq).toHaveBeenCalledWith('season', 20252026);
    expect(eq).toHaveBeenCalledWith('game_type', 3);
    expect(or).toHaveBeenCalledWith(
      'and(home_team_abbrev.eq.EDM,away_team_abbrev.eq.LAK),and(home_team_abbrev.eq.LAK,away_team_abbrev.eq.EDM)',
    );
    expect(order).toHaveBeenCalledWith('game_date', { ascending: true });
  });

  it('returns null without querying for a non-playoff or invalid anchor', async () => {
    await expect(fetchPlayoffSeries(game({ game_type: 2 }))).resolves.toBeNull();
    await expect(fetchPlayoffSeries(game({ season: 20252027 }))).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('returns null when the Supabase query fails', async () => {
    queryResult = { data: null, error: { message: 'unavailable' } };
    await expect(fetchPlayoffSeries(game())).resolves.toBeNull();
  });
});

it('does not expose impossible final scores for rendering', () => {
  for (const scores of [{home_score:2,away_score:2},{home_score:-1,away_score:3},{home_score:1.5,away_score:3}]) {
    const anchor=game(scores);
    expect(summarizePlayoffSeries([anchor],anchor).games[0]).toMatchObject({home_score:null,away_score:null});
  }
});
