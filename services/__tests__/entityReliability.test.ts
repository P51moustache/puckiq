import { parseEntityId, parseTeamParam } from '../../utils/entityRoutes';
import { sourceFreshness, applyGameFreshness, fetchArenaGameById, fetchArenaPreview } from '../arenaData';
import { getPlayerDetail } from '../playerDetail';
import { formatStatValue, getTeamComparisonData, getTeamComparisonPair } from '../teamComparison';
import type { ArenaGame } from '../../types/arena';
import { supabase } from '../../lib/supabase';

jest.mock('../playerDetail', () => ({ getPlayerDetail: jest.fn() }));

const now = new Date('2026-10-10T12:00:00Z');
const game = { id: 2026020001, game_type: 2, game_state: 'FUT', start_time_utc: '2026-10-10T20:00:00Z', updated_at: now.toISOString(), forecast: { model: 'PuckIQ AI', version: 'v1', homeProbability: .6, predictedAt: '2026-10-01T12:00:00Z' } } as ArenaGame;
test('entity IDs validate scalar parameters without selecting arbitrary array entries', () => {
 expect(parseEntityId('8478402')).toBe(8478402);
 expect(parseEntityId(['8478402','1'])).toBeNull();
 expect(parseEntityId('1x')).toBeNull();
 expect(parseTeamParam('EDM')).toBe('EDM');
 expect(parseTeamParam('edm')).toBe('EDM');
 expect(parseTeamParam('XXX')).toBeNull();
});
test('unknown and stale source age are independent of request time', () => {
 expect(sourceFreshness(null, now).status).toBe('unknown');
 expect(sourceFreshness('2026-10-01T12:00:00Z', now).status).toBe('stale');
 expect(sourceFreshness(now.toISOString(), now).status).toBe('fresh');
});
test('suppresses old upcoming forecasts, retaining historical pregame expectations', () => {
 expect(applyGameFreshness(game, now).forecast).toBeNull();
 expect(applyGameFreshness({...game, game_state: 'OFF'}, now).forecast).toEqual(game.forecast);
 expect(applyGameFreshness({...game, game_state: 'OFF', forecast: {...game.forecast!, predictedAt: '2026-10-11T00:00:00Z'}}, now).forecast).toBeNull();
});
test('formats save fractions and distinguishes zero from absent', () => {
 expect(formatStatValue(.905,'saveFraction')).toBe('.905');
 expect(formatStatValue(0,'percentage')).toBe('0.0%');
 expect(formatStatValue(NaN)).toBe('N/A');
});
test('rejects incompatible standings before combining category data', async () => {
 await expect(getTeamComparisonData('EDM', [{team_abbrev:'EDM',season:20252026,snapshot_date:'2026-04-10'},{team_abbrev:'DAL',season:20242025,snapshot_date:'2025-04-10'}] as never)).rejects.toThrow('coherent');
});
test('malformed game IDs do not query a substitute game', async () => {
 expect(await fetchArenaGameById(-1)).toBeNull();
});
test('game preview excludes mixed game types and conflicting goalie totals', async () => {
 const snapshot = [{team_abbrev:'EDM',season:20252026,snapshot_date:'2026-04-10',games_played:82}];
 const from = jest.spyOn(supabase,'from');
 from.mockImplementation((table: string) => query(table === 'standings' ? snapshot
   : table === 'goalie_season_stats' ? [{player_id:1,team_abbrev:'EDM',games_played:1,save_pctg:.99}]
   : table === 'team_stat_categories' ? [{team_abbrev:'EDM',data:{gamesPlayed:88,powerPlayPct:.9,penaltyKillPct:.8}}]
   : []) as never);
 (getPlayerDetail as jest.Mock).mockResolvedValue({season:20252026,seasonStats:null,seasonStatsIssue:'conflicting_game_records'});
 const result = await fetchArenaPreview({...game,season:20252026,home_team_abbrev:'EDM',away_team_abbrev:'DAL'});
 expect(result.specialTeams).toEqual([]);
 expect(result.goalies).toEqual([]);
 from.mockRestore();
});
test('game preview retains checked goalie statistics and real zero special-team rates', async () => {
 const snapshot = [{team_abbrev:'EDM',season:20252026,snapshot_date:'2026-04-10',games_played:82}];
 const from = jest.spyOn(supabase,'from');
 from.mockImplementation((table: string) => query(table === 'standings' ? snapshot
   : table === 'goalie_season_stats' ? [{player_id:1,team_abbrev:'EDM',games_played:1,save_pctg:.99}]
   : table === 'team_stat_categories' ? [{team_abbrev:'EDM',data:{gamesPlayed:82,powerPlayPct:0,penaltyKillPct:.8}}]
   : []) as never);
 (getPlayerDetail as jest.Mock).mockResolvedValue({season:20252026,asOf:'2026-04-10T12:00:00Z',bio:{fullName:'Test Goalie',position:'G',teamAbbrev:'EDM'},seasonStats:{gamesPlayed:50,savePctg:.905,goalsAgainstAvg:2.4}});
 const result = await fetchArenaPreview({...game,season:20252026,home_team_abbrev:'EDM',away_team_abbrev:'DAL'});
 expect(result.specialTeams).toEqual([{team:'EDM',powerPlay:0,penaltyKill:80}]);
 expect(result.goalies[0]).toMatchObject({games_played:50,save_pctg:.905,goals_against_avg:2.4});
 expect(result.sources?.goalies.asOf).toBe('2026-04-10T12:00:00.000Z');
 (getPlayerDetail as jest.Mock).mockResolvedValue({season:20252026,bio:{fullName:'Test Goalie',position:'G',teamAbbrev:'DAL'},seasonStats:{gamesPlayed:50,savePctg:.905,goalsAgainstAvg:2.4}});
 expect((await fetchArenaPreview({...game,season:20252026,home_team_abbrev:'EDM',away_team_abbrev:'DAL'})).goalies).toEqual([]);
 from.mockRestore();
});

function query(data: unknown[], calls: [string,unknown][] = []) {
 const q: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve({data,error:null}).then(resolve) };
 for (const method of ['select','eq','in','order','limit']) q[method] = jest.fn((...args: unknown[]) => { calls.push([method,args]); return q; });
 return q;
}
test('cold game link resolves exactly its row and its forecast', async () => {
 const calls: [string,unknown][] = [];
 const from = jest.spyOn(supabase,'from');
 from.mockReturnValueOnce(query([{...game,game_state:'OFF'}],calls) as never).mockReturnValueOnce(query([{game_id:game.id,model_type:'game_winner',model_version:'v1',home_win_prob:.6,away_win_prob:.4,predicted_at:'2026-10-01T12:00:00Z'}]) as never);
 expect((await fetchArenaGameById(game.id))?.id).toBe(game.id);
 expect(calls).toContainEqual(['eq',['id',game.id]]);
 from.mockRestore();
});
test('both teams share the exact period; rejects newer category sample and preserves zero penalties', async () => {
 const snapshot = [{team_abbrev:'EDM',season:20252026,snapshot_date:'2026-04-10',games_played:80,goals_for:240,goals_against:228},{team_abbrev:'DAL',season:20252026,snapshot_date:'2026-04-10',games_played:80,goals_for:240,goals_against:228}];
 const calls: [string,unknown][] = [];
 const from = jest.spyOn(supabase,'from');
 from.mockReturnValueOnce(query([snapshot[0]],calls) as never).mockReturnValueOnce(query(snapshot,calls) as never)
 .mockReturnValueOnce(query([{stat_category:'summary',data:{gamesPlayed:82,shotsForPerGame:99}},{stat_category:'summary',data:{gamesPlayed:80,shotsForPerGame:30,shotsAgainstPerGame:30,powerPlayPct:0,penaltyKillPct:.8}},{stat_category:'penalties',data:{gamesPlayed:80,penalties:0,penaltyMinutes:0}}],calls) as never)
 .mockReturnValueOnce(query([],calls) as never);
 const [a,b] = await getTeamComparisonPair('EDM','DAL');
 expect(a.period?.season).toBe(b.period?.season);
 expect(a.period?.snapshotDate).toBe(b.period?.snapshotDate);
 expect(a.offense.shotsPerGame).toBe(30);
 expect(a.offense.powerPlayPct).toBe(0);
 expect(a.discipline.penaltyMinutes).toBe(0);
 expect(Number.isNaN(b.offense.shotsPerGame)).toBe(true);
 expect(calls).toContainEqual(['eq',['season',20252026]]);
 expect(calls).toContainEqual(['eq',['snapshot_date','2026-04-10']]);
 from.mockRestore();
});
