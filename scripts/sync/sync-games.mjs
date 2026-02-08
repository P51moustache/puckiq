/**
 * Sync game data from NHL API to Supabase `games` table.
 *
 * Two modes:
 * - Full: Fetch all 32 team schedules, upsert all games (initial seed / recovery)
 * - Incremental: Fetch yesterday + today scores only (daily sync)
 *
 * Usage:
 *   node scripts/sync/sync-games.mjs          # Incremental (default)
 *   node scripts/sync/sync-games.mjs --full   # Full season sync
 */

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { ALL_TEAMS, getCurrentSeason, getCurrentSeasonStr, formatDate, fetchWithRetry, sleep, endpoints } from './nhl-api.mjs';

/**
 * Full season sync: fetch all team schedules, upsert all games.
 */
async function syncFullSeason() {
  const season = getCurrentSeason();
  const seasonStr = getCurrentSeasonStr();
  console.log(`[sync-games] Full season sync for ${season}`);

  const gameMap = new Map();
  let teamsDone = 0;

  for (const team of ALL_TEAMS) {
    try {
      const data = await fetchWithRetry(endpoints.teamScheduleSeason(team, seasonStr));
      const games = data.games ?? [];

      for (const game of games) {
        gameMap.set(game.id, game);
      }
    } catch (err) {
      console.warn(`  [sync-games] Failed to fetch ${team}: ${err.message}`);
    }

    teamsDone++;
    if (teamsDone % 8 === 0) {
      console.log(`  Fetched ${teamsDone}/${ALL_TEAMS.length} teams (${gameMap.size} unique games)`);
    }

    await sleep(100);
  }

  return upsertGames(Array.from(gameMap.values()), season, seasonStr);
}

/**
 * Incremental sync: fetch yesterday + today scores only.
 */
async function syncIncremental() {
  const season = getCurrentSeason();
  const seasonStr = getCurrentSeasonStr();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dates = [formatDate(yesterday), formatDate(today)];
  console.log(`[sync-games] Incremental sync for dates: ${dates.join(', ')}`);

  const allGames = [];

  for (const date of dates) {
    try {
      const data = await fetchWithRetry(endpoints.scores(date));
      const games = data.games ?? [];
      allGames.push(...games);
      console.log(`  ${date}: ${games.length} games found`);
    } catch (err) {
      console.warn(`  [sync-games] Failed to fetch scores for ${date}: ${err.message}`);
    }
  }

  return upsertGames(allGames, season, seasonStr);
}

/**
 * Upsert raw NHL game data into the games table.
 */
async function upsertGames(rawGames, season, seasonStr) {
  if (rawGames.length === 0) {
    console.log('[sync-games] No games to upsert');
    return { upserted: 0, errors: 0 };
  }

  let errors = 0;

  // Upsert into games table (all games including future)
  const gamesRows = rawGames.map(game => ({
    id: game.id,
    season,
    game_type: game.gameType ?? 2,
    game_date: game.gameDate,
    start_time_utc: game.startTimeUTC,
    venue: game.venue?.default ?? null,
    game_state: game.gameState,
    game_schedule_state: game.gameScheduleState ?? 'OK',
    away_team_abbrev: game.awayTeam.abbrev,
    away_score: game.awayTeam.score ?? 0,
    away_sog: game.awayTeam.sog ?? null,
    home_team_abbrev: game.homeTeam.abbrev,
    home_score: game.homeTeam.score ?? 0,
    home_sog: game.homeTeam.sog ?? null,
    period: game.periodDescriptor?.number ?? null,
    period_type: game.periodDescriptor?.periodType ?? null,
  }));

  if (gamesRows.length > 0) {
    const batchSize = 200;
    let gamesUpserted = 0;
    for (let i = 0; i < gamesRows.length; i += batchSize) {
      const batch = gamesRows.slice(i, i + batchSize);
      const { error } = await supabase
        .from('games')
        .upsert(batch, { onConflict: 'id' });
      if (error) {
        // Table might not exist yet if backend-engineer's migration hasn't been applied
        if (error.message.includes('relation "games" does not exist')) {
          console.warn('  [sync-games] `games` table not yet created — skipping (run migrations first)');
          break;
        }
        console.error(`  [sync-games] games batch error: ${error.message}`);
        errors++;
      } else {
        gamesUpserted += batch.length;
      }
    }
    if (gamesUpserted > 0) {
      console.log(`  games: ${gamesUpserted} upserted`);
    }
  }

  // Log to sync_log
  await logSync('games', gamesRows.length, errors);

  // Verify
  const { count } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .eq('season', season);

  console.log(`[sync-games] Done: ${rawGames.length} total, ${count} in games, ${errors} errors`);
  return { upserted: gamesRows.length, errors, totalRows: count };
}

/**
 * Write a record to sync_log (if table exists).
 */
async function logSync(syncType, recordsProcessed, errorCount) {
  try {
    await supabase.from('sync_log').insert({
      sync_type: syncType,
      status: errorCount > 0 ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      records_processed: recordsProcessed,
      error_message: errorCount > 0 ? `${errorCount} batch errors` : null,
    });
  } catch {
    // sync_log table may not exist yet
  }
}

// Main
const isFullSync = process.argv.includes('--full');
logConnectionInfo();

try {
  const result = isFullSync ? await syncFullSeason() : await syncIncremental();
  if (result.errors > 0) {
    process.exit(1);
  }
} catch (err) {
  console.error('[sync-games] Fatal error:', err);
  process.exit(1);
}
