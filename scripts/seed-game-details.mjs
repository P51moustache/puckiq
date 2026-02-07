/**
 * Seed game_details table from /gamecenter/{gameId}/right-rail endpoint.
 * Captures officials, coaches, scratches, shots by period, season series,
 * team game stats, and game report links.
 *
 * Run: node scripts/seed-game-details.mjs
 */

import {
  supabase, batchUpsert, startSync, completeSync, failSync,
  sleep, progress, NHL_API
} from './seed-utils.mjs';

/** Fetch with 429 retry-after support (up to 5 retries) */
async function fetchWithRetry(path, maxRetries = 5) {
  const url = path.startsWith('http') ? path : `${NHL_API}${path}`;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '15', 10);
      const waitMs = (retryAfter + 1) * 1000; // Add 1s buffer
      if (attempt < maxRetries) {
        console.log(`\n  Rate limited on ${path}, waiting ${waitMs / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(waitMs);
        continue;
      }
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
}

async function main() {
  console.log('=== Seeding Game Details (Right-Rail) ===');
  const syncId = await startSync('game_details');

  try {
    // Get all completed game IDs
    const { data: games, error: gamesErr } = await supabase
      .from('games')
      .select('id')
      .in('game_state', ['FINAL', 'OFF'])
      .order('id');

    if (gamesErr) throw new Error(`Failed to fetch games: ${gamesErr.message}`);
    if (!games || games.length === 0) {
      console.log('  No completed games found. Run seed-games.mjs first.');
      await completeSync(syncId, 0);
      return;
    }

    // Check which games already have details to avoid re-fetching
    const { data: existing } = await supabase
      .from('game_details')
      .select('game_id');

    const existingIds = new Set((existing || []).map(g => g.game_id));
    const newGames = games.filter(g => !existingIds.has(g.id));

    console.log(`  Found ${games.length} completed games, ${newGames.length} need right-rail fetch`);

    if (newGames.length === 0) {
      console.log('  All games already have details. Done.');
      await completeSync(syncId, 0);
      return;
    }

    const rows = [];
    let fetched = 0;
    let skipped = 0;

    for (let i = 0; i < newGames.length; i++) {
      const gameId = newGames[i].id;

      try {
        const data = await fetchWithRetry(`/gamecenter/${gameId}/right-rail`);
        if (!data) {
          skipped++;
          continue;
        }

        rows.push({
          game_id: gameId,
          officials: data.gameInfo?.referees || data.officials || null,
          coaches: data.gameInfo?.awayTeam?.headCoach || data.gameInfo?.homeTeam?.headCoach
            ? {
                away: data.gameInfo?.awayTeam?.headCoach || null,
                home: data.gameInfo?.homeTeam?.headCoach || null,
              }
            : null,
          scratches: data.gameInfo?.awayTeam?.scratches || data.gameInfo?.homeTeam?.scratches
            ? {
                away: data.gameInfo?.awayTeam?.scratches || [],
                home: data.gameInfo?.homeTeam?.scratches || [],
              }
            : null,
          shots_by_period: data.shotsByPeriod || data.linescore?.byPeriod || null,
          season_series: data.seasonSeries || null,
          team_game_stats: data.teamGameStats || null,
          game_reports: data.gameReports || null,
          fetched_at: new Date().toISOString(),
        });

        fetched++;
      } catch (err) {
        // Non-fatal — some games may not have right-rail data
        skipped++;
      }

      // Delay between requests
      await sleep(500);

      if ((i + 1) % 25 === 0 || i === newGames.length - 1) {
        progress(i + 1, newGames.length, `games (${fetched} fetched, ${skipped} skipped)`);
      }

      // Batch upsert periodically to avoid holding too much in memory
      if (rows.length >= 200) {
        await batchUpsert('game_details', rows, 'game_id');
        rows.length = 0;
      }
    }

    // Flush remaining
    if (rows.length > 0) {
      await batchUpsert('game_details', rows, 'game_id');
    }

    console.log(`\n  Fetched: ${fetched} games, Skipped: ${skipped}`);
    await completeSync(syncId, fetched);
    console.log('=== Game Details seeding complete ===\n');
  } catch (err) {
    console.error('Game Details seeding failed:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
