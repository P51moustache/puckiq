/**
 * Seed player_career_data table from /player/{id}/landing endpoint.
 * Captures season totals, career totals, awards, last 5 games, featured stats.
 *
 * Run: node scripts/seed-player-career.mjs
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
      const waitMs = (retryAfter + 1) * 1000;
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
  console.log('=== Seeding Player Career Data ===');
  const syncId = await startSync('player_career');

  try {
    // Get all player IDs from the players table
    const { data: players, error: playersErr } = await supabase
      .from('players')
      .select('id')
      .eq('is_active', true)
      .order('id');

    if (playersErr) throw new Error(`Failed to fetch players: ${playersErr.message}`);
    if (!players || players.length === 0) {
      console.log('  No players found. Run seed-players.mjs first.');
      await completeSync(syncId, 0);
      return;
    }

    // Check which players already have career data
    const { data: existing } = await supabase
      .from('player_career_data')
      .select('player_id');

    const existingIds = new Set((existing || []).map(p => p.player_id));
    const newPlayers = players.filter(p => !existingIds.has(p.id));

    console.log(`  Found ${players.length} active players, ${newPlayers.length} need career data fetch`);

    if (newPlayers.length === 0) {
      console.log('  All players already have career data. Done.');
      await completeSync(syncId, 0);
      return;
    }

    const rows = [];
    let fetched = 0;
    let skipped = 0;

    for (let i = 0; i < newPlayers.length; i++) {
      const playerId = newPlayers[i].id;

      try {
        const data = await fetchWithRetry(`/player/${playerId}/landing`);
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
        // Non-fatal — some players may not have full landing pages
        skipped++;
      }

      // Delay between requests
      await sleep(500);

      if ((i + 1) % 25 === 0 || i === newPlayers.length - 1) {
        progress(i + 1, newPlayers.length, `players (${fetched} fetched, ${skipped} skipped)`);
      }

      // Batch upsert periodically
      if (rows.length >= 100) {
        await batchUpsert('player_career_data', rows, 'player_id');
        rows.length = 0;
      }
    }

    // Flush remaining
    if (rows.length > 0) {
      await batchUpsert('player_career_data', rows, 'player_id');
    }

    console.log(`\n  Fetched: ${fetched} players, Skipped: ${skipped}`);
    await completeSync(syncId, fetched);
    console.log('=== Player Career Data seeding complete ===\n');
  } catch (err) {
    console.error('Player Career Data seeding failed:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
