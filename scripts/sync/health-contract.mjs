import { getCurrentSeason } from './nhl-api.mjs';

const validSeason = value => Number.isInteger(value)
  && /^\d{8}$/.test(String(value))
  && value % 10000 === Math.floor(value / 10000) + 1;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  ? Date.parse(value) : null;

export function resolveDataSeason(calendarSeason, rows) {
  return rows.map(row => row.season)
    .filter(season => validSeason(season) && season <= calendarSeason)
    .sort((a, b) => b - a)[0] ?? null;
}

export function evaluateHealth({
  calendarSeason = getCurrentSeason(), dataSeason, gameSyncSeason = calendarSeason,
  activeRegularSeason = false, tables, runs, now = new Date(), maxAgeHours = 36,
}) {
  const checks = [];
  const activeCheckedSeason = activeRegularSeason && gameSyncSeason === calendarSeason;
  const add = (name, status, detail) => checks.push({ name, status, detail });
  if (!validSeason(dataSeason) || dataSeason > calendarSeason) {
    add('data_period', 'ERROR', 'No valid stored data season is available.');
  }
  const requiredTables = ['games', 'standings', 'skater_season_stats', 'goalie_season_stats', 'team_stat_categories', 'teams', 'players'];
  for (const table of requiredTables) {
    const result = tables.find(row => row.table === table);
    if (!result || result.error) add(table, 'ERROR', result?.error ?? 'Table could not be checked.');
    else if (!Number.isInteger(result.count) || result.count <= 0) add(table, 'EMPTY', 'No rows in the requested data period.');
    else add(table, 'OK', `${result.count} rows${['teams', 'players'].includes(table) ? '' : ` in ${result.season ?? dataSeason}`}.`);
  }
  if (activeCheckedSeason && dataSeason !== gameSyncSeason) {
    add('active_stats_period', 'ERROR', 'Regular-season games are scheduled, but statistics are from another season.');
  }

  for (const type of ['games', 'standings', 'player_stats', 'stat_categories']) {
    const latest = runs.filter(run => run.sync_type === type).sort((a, b) =>
      (timestamp(b.started_at) ?? timestamp(b.completed_at) ?? 0)
      - (timestamp(a.started_at) ?? timestamp(a.completed_at) ?? 0))[0];
    const name = `${type}_sync`;
    if (!latest || latest.status !== 'completed') {
      add(name, 'ERROR', latest ? `Latest run is ${latest.status}; completion is unverified.` : 'No completed run found.');
      continue;
    }
    const sourceDate = latest.metadata?.snapshot_date ?? latest.metadata?.snapshotDate;
    if (type === 'standings' && activeCheckedSeason) {
      const sourceTime = timestamp(sourceDate);
      if (sourceTime === null || sourceTime > now.getTime() + 86400000 || now.getTime() - sourceTime > 72 * 3600000) {
        add('standings_source', 'STALE', 'Standings source is missing, invalid or over three days old during regular-season games.');
      }
    }
    const completed = timestamp(latest.completed_at);
    const started = timestamp(latest.started_at);
    if (completed !== null && now.getTime() - completed > maxAgeHours * 3600000) {
      add(name, 'STALE', `Last completed ${latest.completed_at}.`);
    } else if (completed === null || (started !== null && completed < started) || completed > now.getTime() + 300000) {
      add(name, 'ERROR', 'Invalid source completion time.');
    } else if (latest.metadata?.season !== (type === 'games' ? gameSyncSeason : dataSeason)) {
      add(name, 'UNKNOWN', 'Run does not identify the checked data season.');
    } else {
      add(name, 'OK', `Completed ${latest.completed_at} for ${latest.metadata.season}.`);
    }
  }
  return {
    ok: checks.every(check => check.status === 'OK'), calendarSeason, dataSeason,
    gameSyncSeason, activeRegularSeason, checkedAt: now.toISOString(), checks,
  };
}
