/**
 * Sync player career data from NHL API to Supabase.
 *
 * For each active player, fetches the /player/{id}/landing endpoint
 * and upserts season totals, career totals, awards, last 5 games,
 * and featured stats into the `player_career_data` table.
 *
 * Full mode (~900 API calls) runs weekly. Incremental mode (~40-80 calls)
 * syncs only players who appeared in games in the last 2 days.
 *
 * Usage:
 *   node scripts/sync/sync-player-career.mjs                  # Full sync (weekly)
 *   node scripts/sync/sync-player-career.mjs --incremental    # Recently-active players only (daily)
 */

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { fetchWithRetry, sleep, endpoints } from './nhl-api.mjs';

const BATCH_SIZE = 100;
const DELAY_BETWEEN_REQUESTS_MS = 250;
const isIncremental = process.argv.includes('--incremental');

/**
 * Get player IDs who appeared in games in the last 2 days.
 * Uses games table to find recent game IDs, then queries boxscore tables.
 */
async function getRecentlyActivePlayerIds() {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const dateStr = twoDaysAgo.toISOString().split('T')[0];

  // Get recent game IDs from the games table
  const { data: recentGames, error: gamesErr } = await supabase
    .from('games')
    .select('id')
    .gte('game_date', dateStr);

  if (gamesErr) {
    console.warn(`[sync-player-career] games query error: ${gamesErr.message}`);
    return [];
  }

  const gameIds = (recentGames || []).map(g => g.id);
  if (gameIds.length === 0) {
    console.log('[sync-player-career] No recent games found');
    return [];
  }

  // Get player IDs from boxscore tables for those games
  const { data: skaters } = await supabase
    .from('game_skater_stats')
    .select('player_id')
    .in('game_id', gameIds);

  const { data: goalies } = await supabase
    .from('game_goalie_stats')
    .select('player_id')
    .in('game_id', gameIds);

  const ids = new Set();
  for (const s of (skaters || [])) ids.add(s.player_id);
  for (const g of (goalies || [])) ids.add(g.player_id);
  return [...ids].sort((a, b) => a - b);
}

/**
 * Get all active player IDs from season stats tables.
 */
async function getAllActivePlayerIds() {
  const { data: skaters, error: skaterErr } = await supabase
    .from('skater_season_stats')
    .select('player_id');

  const { data: goalies, error: goalieErr } = await supabase
    .from('goalie_season_stats')
    .select('player_id');

  if (skaterErr) console.warn(`[sync-player-career] skater_season_stats query error: ${skaterErr.message}`);
  if (goalieErr) console.warn(`[sync-player-career] goalie_season_stats query error: ${goalieErr.message}`);

  const playerIdSet = new Set();
  for (const s of (skaters || [])) playerIdSet.add(s.player_id);
  for (const g of (goalies || [])) playerIdSet.add(g.player_id);
  return [...playerIdSet].sort((a, b) => a - b);
}

async function syncPlayerCareer() {
  const mode = isIncremental ? 'INCREMENTAL' : 'FULL';
  console.log(`[sync-player-career] Mode: ${mode} — fetching player list from Supabase...`);

  const playerIds = isIncremental
    ? await getRecentlyActivePlayerIds()
    : await getAllActivePlayerIds();

  console.log(`[sync-player-career] Found ${playerIds.length} players to sync (${mode})`);

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
      sync_type: isIncremental ? 'player_career_incremental' : 'player_career',
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
