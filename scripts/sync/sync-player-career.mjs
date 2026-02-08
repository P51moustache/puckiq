/**
 * Sync player career data from NHL API to Supabase.
 *
 * For each active player, fetches the /player/{id}/landing endpoint
 * and upserts season totals, career totals, awards, last 5 games,
 * and featured stats into the `player_career_data` table.
 *
 * This is heavier than other sync modules (~900 API calls) so it
 * runs on the weekly schedule by default. Can be triggered daily
 * with --daily flag if needed.
 *
 * Usage:
 *   node scripts/sync/sync-player-career.mjs
 */

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { fetchWithRetry, sleep, endpoints } from './nhl-api.mjs';

const BATCH_SIZE = 100;
const DELAY_BETWEEN_REQUESTS_MS = 500;

async function syncPlayerCareer() {
  console.log('[sync-player-career] Fetching active player list from Supabase...');

  // Get distinct player IDs from both skater and goalie season stats tables
  const { data: skaters, error: skaterErr } = await supabase
    .from('skater_season_stats')
    .select('player_id');

  const { data: goalies, error: goalieErr } = await supabase
    .from('goalie_season_stats')
    .select('player_id');

  if (skaterErr) console.warn(`[sync-player-career] skater_season_stats query error: ${skaterErr.message}`);
  if (goalieErr) console.warn(`[sync-player-career] goalie_season_stats query error: ${goalieErr.message}`);

  // Deduplicate player IDs
  const playerIdSet = new Set();
  for (const s of (skaters || [])) playerIdSet.add(s.player_id);
  for (const g of (goalies || [])) playerIdSet.add(g.player_id);

  const playerIds = [...playerIdSet].sort((a, b) => a - b);
  console.log(`[sync-player-career] Found ${playerIds.length} active players to sync`);

  if (playerIds.length === 0) {
    console.log('[sync-player-career] No players found. Run sync-players first.');
    return { upserted: 0, errors: 0 };
  }

  const rows = [];
  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < playerIds.length; i++) {
    const playerId = playerIds[i];

    try {
      const data = await fetchWithRetry(endpoints.playerLanding(playerId));
      if (!data) {
        skipped++;
        continue;
      }

      rows.push({
        player_id: playerId,
        season_totals: data.seasonTotals || null,
        career_totals: data.careerTotals || null,
        awards: data.awards || null,
        last_5_games: data.last5Games || null,
        featured_stats: data.featuredStats || null,
        fetched_at: new Date().toISOString(),
      });

      fetched++;
    } catch (err) {
      // Non-fatal — some players may not have landing pages
      skipped++;
    }

    await sleep(DELAY_BETWEEN_REQUESTS_MS);

    // Progress logging every 50 players
    if ((i + 1) % 50 === 0 || i === playerIds.length - 1) {
      console.log(`  [sync-player-career] Progress: ${i + 1}/${playerIds.length} (${fetched} fetched, ${skipped} skipped)`);
    }

    // Batch upsert periodically to avoid holding too many rows in memory
    if (rows.length >= BATCH_SIZE) {
      const batchErrors = await upsertBatch(rows);
      errors += batchErrors;
      rows.length = 0;
    }
  }

  // Flush remaining rows
  if (rows.length > 0) {
    const batchErrors = await upsertBatch(rows);
    errors += batchErrors;
  }

  // Log to sync_log
  try {
    await supabase.from('sync_log').insert({
      sync_type: 'player_career',
      status: errors > 0 ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      records_processed: fetched,
      error_message: errors > 0 ? `${errors} batch errors` : null,
    });
  } catch { /* sync_log may not exist yet */ }

  console.log(`[sync-player-career] Done: ${fetched} fetched, ${skipped} skipped, ${errors} errors`);
  return { upserted: fetched, errors };
}

async function upsertBatch(rows) {
  let batchErrors = 0;
  const batchSize = 200;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from('player_career_data')
      .upsert(batch, { onConflict: 'player_id' });

    if (error) {
      if (error.message.includes('does not exist')) {
        console.warn('  [sync-player-career] `player_career_data` table not yet created — run migrations first');
        break;
      }
      console.error(`  [sync-player-career] batch upsert error at ${i}: ${error.message}`);
      batchErrors++;
    }
  }

  return batchErrors;
}

// Main
logConnectionInfo();

try {
  const result = await syncPlayerCareer();
  if (result.errors > 0) process.exit(1);
} catch (err) {
  console.error('[sync-player-career] Fatal error:', err);
  process.exit(1);
}
