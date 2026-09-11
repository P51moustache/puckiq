/** Read-only ingestion health. Nonzero exit means the feed is not verified. */
import { getCurrentSeason, parseSeasonArg } from './nhl-api.mjs';
import { evaluateHealth, resolveDataSeason } from './health-contract.mjs';

const json = process.argv.includes('--json');
async function main() {
  const {supabase} = await import('./supabase-client.mjs');
  const calendarSeason = getCurrentSeason();
  const requested = process.argv.some(arg => arg === '--season' || arg.startsWith('--season='));
  const parsed = parseSeasonArg();
  const [latest, latestGames] = await Promise.all(['skater_season_stats','games'].map(table => supabase.from(table).select('season').lte('season',calendarSeason).order('season',{ascending:false}).limit(1)));
  const dataSeason = requested ? parsed.season : resolveDataSeason(calendarSeason,latest.data ?? []);
  const storedGameSeason = requested ? parsed.season : resolveDataSeason(calendarSeason,latestGames.data ?? []);
  const tables = await Promise.all(['games','standings','skater_season_stats','goalie_season_stats','team_stat_categories','teams','players'].map(async table => {
    let query = supabase.from(table).select('id',{count:'exact',head:true});
    const season = table === 'games' ? storedGameSeason : dataSeason;
    if (!['teams','players'].includes(table)) query = query.eq('season',season ?? -1);
    const {count,error} = await query;
    return {table,count,season,error:error?.message};
  }));
  const now = new Date();
  const activeGames = await supabase.from('games').select('id').eq('season',calendarSeason).eq('game_type',2)
    .gte('game_date',new Date(now.getTime() - 2 * 86400000).toISOString().slice(0,10))
    .lte('game_date',new Date(now.getTime() + 2 * 86400000).toISOString().slice(0,10)).limit(1);
  const runResults = await Promise.all(['games','standings','player_stats','stat_categories'].map(type => supabase.from('sync_log')
    .select('sync_type,status,started_at,completed_at,records_processed,metadata').eq('sync_type',type)
    .order('started_at',{ascending:false,nullsFirst:false}).limit(1)));
  const report = evaluateHealth({calendarSeason,dataSeason,gameSyncSeason:requested ? parsed.season : calendarSeason,activeRegularSeason:(activeGames.data?.length ?? 0) > 0,tables,runs:runResults.flatMap(r=>r.data ?? [])});
  if (activeGames.error || latest.error || latestGames.error || runResults.some(r=>r.error)) {
    report.ok = false;
    report.checks.push({name:'source_queries',status:'ERROR',detail:'Period or sync metadata could not be read.'});
  }
  if (json) console.log(JSON.stringify(report,null,2));
  else {
    console.log(`Calendar season ${calendarSeason}; checked stored season ${dataSeason ?? 'unavailable'}.`);
    for (const check of report.checks) console.log(`[${check.status}] ${check.name}: ${check.detail}`);
    console.log(report.ok ? 'Ingestion checks passed.' : 'Feed is not verified; inspect failed checks before serving current analytical claims.');
  }
  process.exitCode = report.ok ? 0 : 1;
}
main().catch(error => {
  const report = {ok:false,error:error.message};
  console.log(json ? JSON.stringify(report) : `Health check failed: ${error.message}`);
  process.exitCode = 1;
});
