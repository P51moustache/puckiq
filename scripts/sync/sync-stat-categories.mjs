/**
 * Sync exact regular-season team stat categories from the NHL Stats API.
 *
 * Usage:
 *   node scripts/sync/sync-stat-categories.mjs
 *   node scripts/sync/sync-stat-categories.mjs --season 20252026
 */

import { pathToFileURL } from 'node:url';

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { fetchWithRetry, sleep, parseSeasonArg, endpoints } from './nhl-api.mjs';
import { normalizeTeamCategory, upsertBatches, writeSyncLog } from './ingestion-contracts.mjs';

const CATEGORIES = ['powerplay', 'penaltykill', 'summary', 'penalties'];
const DELAY_MS = 1500;

async function recordCategorySync({ season, startedAt, status, upserted, errors, metadata, errorMessage }) {
  try {
    await writeSyncLog(supabase, {
      sync_type: 'stat_categories',
      status,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      records_processed: upserted,
      error_message: errorMessage ?? null,
      metadata: { season, game_type: 2, ...metadata },
    });
    return errors;
  } catch (error) {
    console.error(`[sync-stat-categories] ${error.message}`);
    return errors + 1;
  }
}

export async function syncStatCategories(season) {
  const startedAt = new Date().toISOString();
  console.log(`[sync-stat-categories] Syncing ${CATEGORIES.length} categories for season ${season}`);
  const { data: teams, error: teamError } = await supabase.from('teams').select('id, abbrev');

  if (teamError || !Array.isArray(teams) || teams.length === 0) {
    const errorMessage = `Failed to load team mapping: ${teamError?.message ?? 'no teams returned'}`;
    const errors = await recordCategorySync({
      season,
      startedAt,
      status: 'failed',
      upserted: 0,
      errors: 1,
      metadata: { categories_expected: CATEGORIES.length, categories_fetched: 0, rows_fetched: 0, rows_upserted: 0 },
      errorMessage,
    });
    console.error(`[sync-stat-categories] ${errorMessage}`);
    return { upserted: 0, errors };
  }

  const teamMap = new Map(teams.map(team => [team.id, team.abbrev]));
  let totalFetched = 0;
  let totalUpserted = 0;
  let categoriesFetched = 0;
  let errors = 0;

  for (const category of CATEGORIES) {
    try {
      const payload = await fetchWithRetry(endpoints.teamStatCategory(category, season));
      const rows = normalizeTeamCategory(payload, category, season, teamMap, new Date().toISOString());
      if (rows.length === 0) throw new Error(`No ${category} rows returned`);
      categoriesFetched += 1;
      totalFetched += rows.length;

      try {
        const count = await upsertBatches(
          supabase,
          'team_stat_categories',
          rows,
          'team_abbrev,season,stat_category',
          50,
        );
        totalUpserted += count;
        console.log(`  [${category}] ${count} teams synced`);
      } catch (error) {
        totalUpserted += error.rowsUpserted ?? 0;
        errors += 1;
        console.error(`  [${category}] ${error.message}`);
      }
    } catch (error) {
      errors += 1;
      console.error(`  [${category}] FAILED: ${error.message}`);
    }
    await sleep(DELAY_MS);
  }

  errors = await recordCategorySync({
    season,
    startedAt,
    status: errors === 0 && categoriesFetched === CATEGORIES.length ? 'completed' : 'failed',
    upserted: totalUpserted,
    errors,
    metadata: {
      categories_expected: CATEGORIES.length,
      categories_fetched: categoriesFetched,
      team_map_size: teamMap.size,
      rows_fetched: totalFetched,
      rows_upserted: totalUpserted,
    },
    errorMessage: errors > 0 ? `${errors} category fetch, validation, or write errors` : null,
  });

  console.log(`[sync-stat-categories] Done: ${totalUpserted}/${totalFetched} upserted, ${errors} errors`);
  return { upserted: totalUpserted, errors };
}

async function main() {
  const { season } = parseSeasonArg();
  logConnectionInfo();
  const result = await syncStatCategories(season);
  if (result.errors > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('[sync-stat-categories] Fatal error:', error);
    process.exitCode = 1;
  });
}
