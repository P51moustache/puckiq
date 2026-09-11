/**
 * Sync NHL game data to Supabase with exact source-period validation.
 *
 * Usage:
 *   node scripts/sync/sync-games.mjs
 *   node scripts/sync/sync-games.mjs --full
 *   node scripts/sync/sync-games.mjs --full --season 20252026
 */

import { pathToFileURL } from 'node:url';

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { ALL_TEAMS, getCurrentSeason, getCurrentSeasonStr, formatDate, fetchWithRetry, sleep, endpoints, parseSeasonArg } from './nhl-api.mjs';
import { clubTeamsForSeason, normalizeFullSeasonGames, normalizeGames, upsertBatches, writeSyncLog } from './ingestion-contracts.mjs';

async function recordGameSync({ season, startedAt, status, upserted, errors, metadata, errorMessage }) {
  try {
    await writeSyncLog(supabase, {
      sync_type: 'games',
      status,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      records_processed: upserted,
      error_message: errorMessage ?? null,
      metadata: { season, ...metadata },
    });
    return errors;
  } catch (error) {
    console.error(`[sync-games] ${error.message}`);
    return errors + 1;
  }
}

async function publishGames(rawGames, season, startedAt, coverage, sourceErrors = 0) {
  if (sourceErrors > 0) {
    const errorMessage = `${sourceErrors} source fetches failed; no game rows published`;
    const errors = await recordGameSync({
      season,
      startedAt,
      status: 'failed',
      upserted: 0,
      errors: sourceErrors,
      metadata: { ...coverage, raw_games: rawGames.length, normalized_games: 0, game_types: [] },
      errorMessage,
    });
    console.error(`[sync-games] Failed: ${errorMessage}`);
    return { upserted: 0, errors, totalRows: null };
  }

  let rows;
  try {
    rows = coverage.source_mode === 'full'
      ? normalizeFullSeasonGames(rawGames, season)
      : normalizeGames(rawGames, season);
  } catch (error) {
    const errors = await recordGameSync({
      season,
      startedAt,
      status: 'failed',
      upserted: 0,
      errors: 1,
      metadata: { ...coverage, raw_games: rawGames.length, normalized_games: 0, game_types: [] },
      errorMessage: error.message,
    });
    console.error(`[sync-games] Validation failed: ${error.message}`);
    return { upserted: 0, errors, totalRows: null };
  }

  let errors = 0;
  let upserted = 0;
  try {
    upserted = await upsertBatches(supabase, 'games', rows, 'id');
  } catch (error) {
    upserted = error.rowsUpserted ?? 0;
    errors += 1;
    console.error(`[sync-games] ${error.message}`);
  }

  let totalRows = null;
  const { count, error: countError } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .eq('season', season);
  if (countError) {
    errors += 1;
    console.error(`[sync-games] Verification query failed: ${countError.message}`);
  } else {
    totalRows = count;
  }

  const gameTypes = [...new Set(rows.map(row => row.game_type))].sort();
  errors = await recordGameSync({
    season,
    startedAt,
    status: errors === 0 ? 'completed' : 'failed',
    upserted,
    errors,
    metadata: {
      ...coverage,
      raw_games: rawGames.length,
      normalized_games: rows.length,
      game_types: gameTypes,
      rows_upserted: upserted,
    },
    errorMessage: errors > 0 ? `${errors} game write or verification errors` : null,
  });

  console.log(`[sync-games] Done: ${upserted}/${rows.length} games upserted, ${totalRows ?? 'unknown'} stored for season, ${errors} errors`);
  return { upserted, errors, totalRows };
}

export async function syncFullSeason(seasonOverride) {
  const startedAt = new Date().toISOString();
  const { season, seasonStr } = seasonOverride || { season: getCurrentSeason(), seasonStr: getCurrentSeasonStr() };
  let teams;
  try {
    teams = clubTeamsForSeason(season, ALL_TEAMS);
  } catch (error) {
    const errors = await recordGameSync({
      season,
      startedAt,
      status: 'failed',
      upserted: 0,
      errors: 1,
      metadata: { source_mode: 'full', sources_expected: 0, sources_fetched: 0, failed_sources: [], raw_games: 0, normalized_games: 0, game_types: [] },
      errorMessage: error.message,
    });
    console.error(`[sync-games] ${error.message}`);
    return { upserted: 0, errors, totalRows: null };
  }
  console.log(`[sync-games] Full season sync for ${season}`);

  const rawGames = [];
  const failedTeams = [];
  for (let index = 0; index < teams.length; index++) {
    const team = teams[index];
    try {
      const payload = await fetchWithRetry(endpoints.teamScheduleSeason(team, seasonStr));
      if (!Array.isArray(payload?.games)) throw new Error('schedule response has no games array');
      rawGames.push(...payload.games);
    } catch (error) {
      failedTeams.push(team);
      console.warn(`  [sync-games] Failed ${team}: ${error.message}`);
    }

    const teamsAttempted = index + 1;
    if (teamsAttempted % 8 === 0) {
      console.log(`  Fetched ${teamsAttempted}/${teams.length} teams (${rawGames.length} source game rows)`);
    }
    await sleep(100);
  }

  return publishGames(rawGames, season, startedAt, {
    source_mode: 'full',
    sources_expected: teams.length,
    sources_fetched: teams.length - failedTeams.length,
    failed_sources: failedTeams,
  }, failedTeams.length);
}

export async function syncIncremental(seasonOverride) {
  const startedAt = new Date().toISOString();
  const { season } = seasonOverride || { season: getCurrentSeason() };
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dates = [formatDate(yesterday), formatDate(today)];
  console.log(`[sync-games] Incremental sync for dates: ${dates.join(', ')}`);

  const rawGames = [];
  const failedDates = [];
  for (const date of dates) {
    try {
      const payload = await fetchWithRetry(endpoints.scores(date));
      if (!Array.isArray(payload?.games)) throw new Error('score response has no games array');
      rawGames.push(...payload.games);
      console.log(`  ${date}: ${payload.games.length} games found`);
    } catch (error) {
      failedDates.push(date);
      console.warn(`  [sync-games] Failed ${date}: ${error.message}`);
    }
  }

  return publishGames(rawGames, season, startedAt, {
    source_mode: 'incremental',
    sources_expected: dates.length,
    sources_fetched: dates.length - failedDates.length,
    failed_sources: failedDates,
  }, failedDates.length);
}

async function main() {
  const isFullSync = process.argv.includes('--full');
  const parsedSeason = parseSeasonArg();
  const hasSeasonFlag = process.argv.includes('--season') || process.argv.some(argument => argument.startsWith('--season='));
  const seasonOverride = hasSeasonFlag ? parsedSeason : null;

  logConnectionInfo();
  if (seasonOverride) console.log(`[sync-games] Using season override: ${seasonOverride.seasonStr}`);

  const result = isFullSync ? await syncFullSeason(seasonOverride) : await syncIncremental(seasonOverride);
  if (result.errors > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('[sync-games] Fatal error:', error);
    process.exitCode = 1;
  });
}
