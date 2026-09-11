import { fileURLToPath } from 'node:url';
import { parseSeasonArg, standingsSnapshotDate } from './nhl-api.mjs';
export function loadSyncEnv() {
  try { process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
export function writerConfig(env) {
  const serverUrl = env.SUPABASE_URL?.replace(/\/$/, '');
  const clientUrl = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (serverUrl && clientUrl && serverUrl !== clientUrl) throw new Error('Server and app Supabase URLs must match.');
  if (!(serverUrl || clientUrl) || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Sync requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Public app keys cannot be used for writes.');
  return {url:serverUrl || clientUrl,key:env.SUPABASE_SERVICE_ROLE_KEY};
}
export function childInvocation(executable, script, args) { return {command:executable,args:[script,...args]}; }
export function syncPeriods(calendarSeason, standingsRows) {
  const {season} = parseSeasonArg(['--season',String(standingsRows[0]?.seasonId)]);
  if (season > calendarSeason || season < calendarSeason - 10001) throw new Error('Standings source is outside the current/prior season window. Use an explicit historical override for backfills.');
  standingsSnapshotDate(standingsRows, season);
  return {games:calendarSeason,stats:season};
}
