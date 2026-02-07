/**
 * Seed player game logs from the Web API.
 * Fetches /player/{id}/game-log/{season}/{game-type} for each player.
 * Stores the full game log as JSONB for easy chronological queries.
 *
 * This provides a clean per-player game-by-game view that's easier
 * to query than joining boxscores, and may include additional fields.
 *
 * Run: node scripts/seed-player-game-logs.mjs
 */

import {
  supabase, fetchNHL, batchUpsert, startSync, completeSync, failSync,
  sleep, progress,
  SEASON, SEASON_STR,
} from './seed-utils.mjs';

async function main() {
  console.log('=== Seeding Player Game Logs ===');
  console.log(`  Season: ${SEASON_STR}`);
  const syncId = await startSync('player_game_logs');

  try {
    // Get all player IDs from the players table
    const { data: players, error: playersErr } = await supabase
      .from('players')
      .select('id')
      .order('id');

    if (playersErr) throw new Error(`Failed to fetch players: ${playersErr.message}`);
    if (!players || players.length === 0) {
      console.log('  No players found. Run seed-players.mjs first.');
      await completeSync(syncId, 0);
      return;
    }

    console.log(`  Found ${players.length} players to fetch game logs for`);

    const allLogs = [];
    let playersSkipped = 0;

    for (let i = 0; i < players.length; i++) {
      const playerId = players[i].id;

      try {
        // Fetch regular season game log
        const data = await fetchNHL(`/player/${playerId}/game-log/${SEASON_STR}/2`);

        if (data && data.gameLog && data.gameLog.length > 0) {
          allLogs.push({
            player_id: playerId,
            season: SEASON,
            game_type: 2,
            data: data.gameLog,
            fetched_at: new Date().toISOString(),
          });
        } else {
          playersSkipped++;
        }
      } catch (err) {
        playersSkipped++;
      }

      if ((i + 1) % 50 === 0 || i === players.length - 1) {
        progress(i + 1, players.length, 'player game logs');
      }

      // Batch upsert periodically to avoid holding too many rows in memory
      if (allLogs.length >= 100) {
        await batchUpsert('player_game_logs', allLogs, 'player_id,season,game_type');
        allLogs.length = 0;
      }
    }

    // Flush remaining
    if (allLogs.length > 0) {
      await batchUpsert('player_game_logs', allLogs, 'player_id,season,game_type');
    }

    const totalRecords = players.length - playersSkipped;
    await completeSync(syncId, totalRecords);

    console.log(`\n=== Player game logs complete ===`);
    console.log(`  Players processed: ${players.length}`);
    console.log(`  With game logs: ${totalRecords}`);
    console.log(`  Skipped (no data): ${playersSkipped}`);
  } catch (err) {
    console.error('\nPlayer game logs seeding FAILED:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
