/**
 * Sync health check — verifies data freshness and completeness.
 *
 * Checks all tables from the comprehensive schema:
 * - game_results (legacy)
 * - games (new comprehensive)
 * - standings
 * - teams / players
 * - skater_season_stats / goalie_season_stats
 * - sync_log (last sync times)
 *
 * Usage:
 *   node scripts/sync/sync-health.mjs
 *   node scripts/sync/sync-health.mjs --json    # Machine-readable output
 */

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { getCurrentSeason, getCurrentSeasonStr } from './nhl-api.mjs';

const jsonOutput = process.argv.includes('--json');

async function checkTable(table, filterColumn, filterValue, label) {
  const result = { table, label, status: 'UNKNOWN', details: {} };

  try {
    let query = supabase.from(table).select('*', { count: 'exact', head: true });
    if (filterColumn && filterValue !== undefined) {
      query = query.eq(filterColumn, filterValue);
    }
    const { count, error } = await query;

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        result.status = 'NOT_CREATED';
        result.details.error = 'Table does not exist — run migrations';
        return result;
      }
      result.status = 'ERROR';
      result.details.error = error.message;
      return result;
    }

    result.details.rowCount = count ?? 0;

    if ((count ?? 0) === 0) {
      result.status = 'EMPTY';
      return result;
    }

    result.status = 'OK';
    return result;
  } catch (err) {
    result.status = 'ERROR';
    result.details.error = err.message;
    return result;
  }
}

async function checkSyncLog() {
  const result = { table: 'sync_log', label: 'Last Syncs', status: 'UNKNOWN', details: {} };

  try {
    const { data, error } = await supabase
      .from('sync_log')
      .select('sync_type, status, completed_at, records_processed')
      .order('completed_at', { ascending: false })
      .limit(10);

    if (error) {
      if (error.message.includes('does not exist')) {
        result.status = 'NOT_CREATED';
        return result;
      }
      result.status = 'ERROR';
      result.details.error = error.message;
      return result;
    }

    if (!data || data.length === 0) {
      result.status = 'EMPTY';
      result.details.message = 'No sync runs recorded yet';
      return result;
    }

    // Group by sync_type, show most recent
    const byType = {};
    for (const row of data) {
      if (!byType[row.sync_type]) {
        byType[row.sync_type] = row;
      }
    }
    result.details.lastSyncs = byType;
    result.status = 'OK';
    return result;
  } catch (err) {
    result.status = 'ERROR';
    result.details.error = err.message;
    return result;
  }
}

async function main() {
  logConnectionInfo();
  const season = getCurrentSeason();
  const seasonStr = getCurrentSeasonStr();
  console.log(`\n[Health Check] Season: ${season}\n`);

  const checks = [
    await checkTable('game_results', 'season', seasonStr, 'Game Results (legacy)'),
    await checkTable('games', 'season', season, 'Games (comprehensive)'),
    await checkTable('teams', null, undefined, 'Teams'),
    await checkTable('players', null, undefined, 'Players'),
    await checkTable('standings', 'season', season, 'Standings'),
    await checkTable('skater_season_stats', 'season', season, 'Skater Season Stats'),
    await checkTable('goalie_season_stats', 'season', season, 'Goalie Season Stats'),
    await checkSyncLog(),
  ];

  if (jsonOutput) {
    console.log(JSON.stringify({ season, timestamp: new Date().toISOString(), checks }, null, 2));
    return;
  }

  const statusIcons = {
    OK: 'OK  ',
    EMPTY: 'EMPTY',
    NOT_CREATED: 'SKIP',
    ERROR: 'FAIL',
    UNKNOWN: '??  ',
  };

  for (const check of checks) {
    const icon = statusIcons[check.status] || '??  ';
    const rows = check.details.rowCount !== undefined ? ` (${check.details.rowCount} rows)` : '';
    const errMsg = check.details.error ? ` — ${check.details.error}` : '';

    if (check.table === 'sync_log' && check.details.lastSyncs) {
      console.log(`  [${icon}] ${check.label}:`);
      for (const [type, info] of Object.entries(check.details.lastSyncs)) {
        const age = info.completed_at
          ? `${Math.round((Date.now() - new Date(info.completed_at).getTime()) / (1000 * 60 * 60) * 10) / 10}h ago`
          : 'unknown';
        console.log(`         ${type}: ${info.status} (${info.records_processed} records, ${age})`);
      }
    } else {
      console.log(`  [${icon}] ${check.label}: ${check.status}${rows}${errMsg}`);
    }
  }

  const notCreated = checks.filter(c => c.status === 'NOT_CREATED');
  const empty = checks.filter(c => c.status === 'EMPTY');
  const errors = checks.filter(c => c.status === 'ERROR');

  console.log('');
  if (notCreated.length > 0) {
    console.log(`  Tables not created: ${notCreated.map(c => c.table).join(', ')}`);
    console.log('  Run the comprehensive migration first.');
  }
  if (empty.length > 0) {
    console.log(`  Empty tables: ${empty.map(c => c.table).join(', ')}`);
    console.log('  Run: npm run seed:all');
  }
  if (errors.length > 0) {
    console.log(`  Errors: ${errors.map(c => c.table).join(', ')}`);
  }
  if (notCreated.length === 0 && empty.length === 0 && errors.length === 0) {
    console.log('  All tables healthy.');
  }
}

main().catch(err => {
  console.error('[Health Check] Fatal error:', err);
  process.exit(1);
});
