import { supabase } from '../../lib/supabase';
import { getLeagueLeaders, getLeaderTrends, getTrendingPlayers, getTrendingGoalies, getPlayerHitRate, getPlayerL10GameStats, getPlayersPlayingTonight, clearTrendsCache, batchGetHitRates } from '../playerTrends';
const season = 20252026;
const seasonRow = (extra: any = {}) => ({ id: 1, player_id: 1, season, team_abbrev: 'EDM', position: 'C', games_played: 20, goals: 4, assists: 16, points: 20, shots: 40, updated_at: '2026-02-01T12:00:00Z', ...extra });
const gameRow = (id: number, extra: any = {}) => ({ game_id: id, player_id: 1, goals: 0, assists: 0, points: 0, shots_on_goal: 0, team_abbrev: 'EDM', games: { season, game_type: 2, game_date: `2026-01-${String(id).padStart(2, '0')}`, game_state: 'OFF' }, ...extra });
let data: Record<string, any[]>;
let errors: Record<string, any>;
let calls: {
  table: string;
  method: string;
  args: any[];
}[];
beforeEach(() => {
  jest.clearAllMocks();
  clearTrendsCache();
  data = { skater_season_stats: [seasonRow()], players: [{ id: 1, first_name: 'Connor', last_name: 'McDavid', current_team_abbrev: 'EDM' }], game_skater_stats: [gameRow(1), gameRow(2)], games: [] };
  errors = {};
  calls = [];
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    const chain: any = {};
    let selection = '';
    let equalities: any[] = [];
    let range: number[] | undefined;
    for (const method of ['select', 'eq', 'in', 'lte', 'order', 'limit', 'range'])
      chain[method] = jest.fn((...args: any[]) => {
        calls.push({ table, method, args });
        if (method === 'select')
          selection = args[0];
        if (method === 'eq')
          equalities.push(args);
        if (method === 'range')
          range = args;
        return chain;
      });
    chain.then = (resolve: any) => {
      let rows = data[table] ?? [];
      for (const [key, value] of equalities)
        if (!key.includes('.'))
          rows = rows.filter(r => r[key] === value);
      if (selection === 'season')
        rows = [...rows].sort((a, b) => b.season - a.season).slice(0, 1);
      if (range)
        rows = rows.slice(range[0], range[1] + 1);
      return Promise.resolve(resolve({ data: rows, error: errors[table] ?? null }));
    };
    return chain;
  });
});
test('leaders aggregate traded splits before ranking and exclude old seasons', async () => {
  data.skater_season_stats = [seasonRow({ points: 10 }), seasonRow({ id: 2, team_abbrev: 'TOR', points: 15 }), seasonRow({ id: 3, player_id: 2, points: 22 }), seasonRow({ season: 20242025, points: 999 })];
  const leaders = await getLeagueLeaders('points', 1);
  expect(leaders).toHaveLength(1);
  expect(leaders[0]).toMatchObject({ playerId: 1, seasonPoints: 25, gamesPlayed: 40, season, gameType: 2, seasonShots: 80 });
});
test.each(['goals', 'assists', 'points', 'shots'] as const)('ranks %s by season count', async (category) => {
  data.skater_season_stats = [seasonRow(), seasonRow({ player_id: 2, [category]: 100 })];
  expect((await getLeagueLeaders(category))[0].playerId).toBe(2);
});
test('regular-season game query uses explicit cutoff and rejects mismatched rows', async () => {
  data.game_skater_stats = [gameRow(1), gameRow(2, { games: { season: 20242025, game_type: 2, game_date: '2025-01-01', game_state: 'OFF' } }), gameRow(3, { games: { season, game_type: 3, game_date: '2026-01-03', game_state: 'OFF' } })];
  const result = await getLeagueLeaders('points');
  expect(result[0].recentSampleSize).toBe(1);
  expect(calls).toContainEqual({ table: 'game_skater_stats', method: 'eq', args: ['games.season', season] });
  expect(calls).toContainEqual({ table: 'game_skater_stats', method: 'eq', args: ['games.game_type', 2] });
  expect(calls).toContainEqual({table:'game_skater_stats',method:'order',args:['games(game_date)',{ascending:false}]});
  expect(calls.some(c => c.method === 'lte' && c.args[0] === 'games.game_date')).toBe(true);
  expect((supabase.from as jest.Mock).mock.calls.some(([t]) => /rolling|hot_cold|pace/.test(t))).toBe(false);
});
test('real zero shots/points remain measured zero; missing recent input is unavailable', async () => {
  let player = (await getLeagueLeaders('points'))[0];
  expect(player).toMatchObject({ recentAvailable: true, avgPoints5g: 0, avgShots5g: 0 });
  clearTrendsCache();
  data.game_skater_stats = [gameRow(1, { points: null })];
  player = (await getLeagueLeaders('points'))[0];
  expect(player.recentAvailable).toBe(false);
  expect(player.recentSampleSize).toBe(0);
  expect(await getLeaderTrends([1])).toEqual(new Map());
});
test('shooting rates have percent display units and shots retain season total', async () => {
  data.game_skater_stats = [gameRow(1, { goals: 1, shots_on_goal: 4 })];
  expect((await getLeagueLeaders('shots'))[0]).toMatchObject({ seasonShots: 40, seasonShotsPerGame: 2, seasonShootingPct: 10, recentShootingPct: 25 });
});
test('missing season is never assigned the current calendar season', async () => {
  data.skater_season_stats = [seasonRow({ season: null })];
  expect(await getLeagueLeaders('points')).toEqual([]);
});
test('empty, errored and thrown data sources degrade to unavailable', async () => {
  data.skater_season_stats = [];
  expect(await getLeagueLeaders('points')).toEqual([]);
  clearTrendsCache();
  errors.skater_season_stats = { message: 'failed' };
  expect(await getLeagueLeaders('points')).toEqual([]);
  (supabase.from as jest.Mock).mockImplementation(() => { throw Error('failed'); });
  expect(await getLeagueLeaders('points')).toEqual([]);
});
test('cache reuses verified data until explicitly cleared', async () => {
  await getLeagueLeaders('points');
  const count = (supabase.from as jest.Mock).mock.calls.length;
  await getLeagueLeaders('points');
  expect((supabase.from as jest.Mock).mock.calls.length).toBe(count);
  clearTrendsCache();
  await getLeagueLeaders('points');
  expect((supabase.from as jest.Mock).mock.calls.length).toBeGreaterThan(count);
});
test('hit rates exclude missing observations from denominator and preserve zero', async () => {
  data.game_skater_stats = [gameRow(1, { points: 1 }), gameRow(2, { points: null }), gameRow(3)];
  expect(await getPlayerHitRate(1, 'points')).toMatchObject({ hit: 1, total: 2, rate: 0.5 });
  expect((await getPlayerL10GameStats(1, 'points')).map(g => g.value)).toEqual([1, 0]);
  expect((await batchGetHitRates([1], 'points')).get(1)?.total).toBe(2);
});
test('trending uses five verified games from the selected season', async () => {
  data.skater_season_stats = [seasonRow({ goals: 5 })];
  data.game_skater_stats = Array.from({ length: 5 }, (_, i) => gameRow(i + 1, { points: 3, goals: 1, assists: 2, shots_on_goal: 4 }));
  expect((await getTrendingPlayers('up'))[0]).toMatchObject({ trendLabel: 'HOT', recentSampleSize: 5 });
  expect(await getTrendingPlayers('down')).toEqual([]);
});
test('conflicting season totals cannot produce leaders or trends', async () => {
  data.skater_season_stats = [seasonRow({ points: 20 })];
  data.game_skater_stats = Array.from({ length: 5 }, (_, i) => gameRow(i + 1, { points: 5 }));
  expect(await getLeagueLeaders('points')).toEqual([]);
  expect(await getTrendingPlayers('up')).toEqual([]);
  expect(await getLeaderTrends([1])).toEqual(new Map());
});
test('unscoped goalie views are not presented as a measured trend', async () => {
  expect(await getTrendingGoalies('up')).toEqual([]);
  expect(supabase.from).not.toHaveBeenCalledWith('goalie_rolling_stats');
});
test('tonight does not combine current schedule with an older season dataset', async () => {
  data.games = [{ id: 2, season: 20262027, game_type: 2, home_team_abbrev: 'EDM', away_team_abbrev: 'TOR' }];
  expect(await getPlayersPlayingTonight()).toEqual([]);
});
test('traded player stays in tonight list under current roster team', async () => {
  const today = new Date().toISOString().slice(0, 10);
  data.games = [{ id: 2, season, game_type: 2, game_date: today, home_team_abbrev: 'EDM', away_team_abbrev: 'TOR' }];
  data.skater_season_stats = [seasonRow({ team_abbrev: 'BOS' }), seasonRow({ id: 2, team_abbrev: 'EDM' })];
  expect((await getPlayersPlayingTonight())[0]).toMatchObject({ playerId: 1, teamAbbrev: 'EDM', seasonPoints: 40, matchup: { gameId: 2, opponent: 'TOR' } });
});
test('streak exhausting the sample is a lower bound; known boundary is exact', async () => {
  data.game_skater_stats = Array.from({ length: 10 }, (_, i) => gameRow(i + 1, { points: 1 }));
  expect((await getLeagueLeaders('points'))[0]).toMatchObject({ pointStreak: 10, pointStreakIsMinimum: true });
  clearTrendsCache();
  data.game_skater_stats[0].points = 0;
  expect((await getLeagueLeaders('points'))[0]).toMatchObject({ pointStreak: 9, pointStreakIsMinimum: false });
});
test('zero shots has no shooting rate while zero goals on positive shots is zero percent', async () => {
  expect((await getLeagueLeaders('points'))[0].recentShootingPct).toBeNull();
  clearTrendsCache();
  data.game_skater_stats = [gameRow(1, { shots_on_goal: 5, goals: 0 })];
  expect((await getLeagueLeaders('points'))[0].recentShootingPct).toBe(0);
});
