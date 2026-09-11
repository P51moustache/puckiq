/**
 * Sync exact-period NHL club player stats to Supabase.
 *
 * Usage:
 *   node scripts/sync/sync-players.mjs
 *   node scripts/sync/sync-players.mjs --season 20252026
 */

import { pathToFileURL } from 'node:url';

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { ALL_TEAMS, getCurrentSeason, fetchWithRetry, sleep, endpoints, parseSeasonArg } from './nhl-api.mjs';
import {
  clubTeamsForSeason,
  normalizeClubStats,
  upsertBatches,
  writeSyncLog,
} from './ingestion-contracts.mjs';

async function recordPlayerSync({ season, startedAt, status, upserted, errors, metadata, errorMessage }) {
  try {
    await writeSyncLog(supabase, {
      sync_type: 'player_stats',
      status,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      records_processed: upserted,
      error_message: errorMessage ?? null,
      metadata: { season, game_type: 2, ...metadata },
    });
    return errors;
  } catch (error) {
    console.error(`[sync-players] ${error.message}`);
    return errors + 1;
  }
}

export async function syncPlayerStats(seasonOverride) {
  const startedAt = new Date().toISOString();
  const season = seasonOverride || getCurrentSeason();
  let teams;
  try {
    teams = clubTeamsForSeason(season, ALL_TEAMS);
  } catch (error) {
    const errors = await recordPlayerSync({
      season,
      startedAt,
      status: 'failed',
      upserted: 0,
      errors: 1,
      metadata: { teams_expected: 0, teams_fetched: 0, failed_teams: [], skaters_fetched: 0, goalies_fetched: 0, skaters_upserted: 0, goalies_upserted: 0 },
      errorMessage: error.message,
    });
    console.error(`[sync-players] ${error.message}`);
    return { upserted: 0, errors };
  }
  console.log(`[sync-players] Fetching player stats for season ${season}`);

  const skaterRows = [];
  const goalieRows = [];
  const failedTeams = [];

  for (let index = 0; index < teams.length; index++) {
    const team = teams[index];
    try {
      const payload = await fetchWithRetry(endpoints.teamStats(team, season));
      const normalized = normalizeClubStats(payload, team, season);
      skaterRows.push(...normalized.skaters);
      goalieRows.push(...normalized.goalies);
    } catch (error) {
      failedTeams.push(team);
      console.warn(`  [sync-players] Failed ${team}: ${error.message}`);
    }

    const teamsAttempted = index + 1;
    if (teamsAttempted % 8 === 0) {
      console.log(`  Fetched ${teamsAttempted}/${teams.length} teams (${skaterRows.length} skaters, ${goalieRows.length} goalies)`);
    }
    await sleep(100);
  }

  const sourceRows = skaterRows.length + goalieRows.length;
  const coverage = {
    teams_expected: teams.length,
    teams_fetched: teams.length - failedTeams.length,
    failed_teams: failedTeams,
    skaters_fetched: skaterRows.length,
    goalies_fetched: goalieRows.length,
  };

  if (failedTeams.length > 0 || sourceRows === 0) {
    const sourceErrors = Math.max(failedTeams.length, 1);
    const errorMessage = failedTeams.length > 0
      ? `${failedTeams.length} of ${teams.length} club snapshots failed; no season rows published`
      : 'Club snapshots contained no players; no season rows published';
    const errors = await recordPlayerSync({
      season,
      startedAt,
      status: 'failed',
      upserted: 0,
      errors: sourceErrors,
      metadata: { ...coverage, skaters_upserted: 0, goalies_upserted: 0 },
      errorMessage,
    });
    console.error(`[sync-players] Failed: ${errorMessage}`);
    return { upserted: 0, errors };
  }

  let errors = 0;
  let skatersUpserted = 0;
  let goaliesUpserted = 0;

  try {
    skatersUpserted = await upsertBatches(
      supabase,
      'skater_season_stats',
      skaterRows,
      'player_id,season,team_abbrev',
    );
  } catch (error) {
    skatersUpserted = error.rowsUpserted ?? 0;
    errors += 1;
    console.error(`  [sync-players] ${error.message}`);
  }

  try {
    goaliesUpserted = await upsertBatches(
      supabase,
      'goalie_season_stats',
      goalieRows,
      'player_id,season,team_abbrev',
    );
  } catch (error) {
    goaliesUpserted = error.rowsUpserted ?? 0;
    errors += 1;
    console.error(`  [sync-players] ${error.message}`);
  }

  const upserted = skatersUpserted + goaliesUpserted;
  errors = await recordPlayerSync({
    season,
    startedAt,
    status: errors === 0 ? 'completed' : 'failed',
    upserted,
    errors,
    metadata: { ...coverage, skaters_upserted: skatersUpserted, goalies_upserted: goaliesUpserted },
    errorMessage: errors > 0 ? `${errors} player-stat write errors` : null,
  });

  console.log(`[sync-players] Done: ${upserted}/${sourceRows} rows upserted, ${errors} errors`);
  return { upserted, errors };
}

async function main() {
  const { season: parsedSeason } = parseSeasonArg();
  const hasSeasonFlag = process.argv.includes('--season') || process.argv.some(argument => argument.startsWith('--season='));
  const seasonOverride = hasSeasonFlag ? parsedSeason : null;

  logConnectionInfo();
  if (seasonOverride) console.log(`[sync-players] Using season override: ${seasonOverride}`);

  const result = await syncPlayerStats(seasonOverride);
  if (result.errors > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('[sync-players] Fatal error:', error);
    process.exitCode = 1;
  });
}
