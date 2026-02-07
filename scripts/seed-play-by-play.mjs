/**
 * Seed play-by-play events for all completed games.
 * Fetches /gamecenter/{id}/play-by-play for each finished game
 * and stores every event with x/y coordinates for shot maps.
 *
 * Run: node scripts/seed-play-by-play.mjs
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
  console.log('=== Seeding Play-by-Play ===');
  const syncId = await startSync('play_by_play');

  try {
    // Get all completed game IDs from the games table
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

    // Check which games already have play-by-play data to avoid re-fetching
    // Use distinct game_id query
    const { data: existing } = await supabase
      .rpc('get_distinct_game_ids_pbp')
      .catch(() => ({ data: null }));

    // Fallback: query a sample if RPC doesn't exist
    let existingIds = new Set();
    if (existing) {
      existingIds = new Set(existing.map(g => g.game_id));
    } else {
      // Query game_play_by_play for distinct game_ids (limited approach)
      const { data: sample } = await supabase
        .from('game_play_by_play')
        .select('game_id')
        .limit(1);
      if (sample && sample.length > 0) {
        // Table has data, get all distinct game_ids in batches
        for (let offset = 0; ; offset += 1000) {
          const { data: batch } = await supabase
            .from('game_play_by_play')
            .select('game_id')
            .range(offset, offset + 999);
          if (!batch || batch.length === 0) break;
          for (const row of batch) existingIds.add(row.game_id);
        }
      }
    }

    const newGames = games.filter(g => !existingIds.has(g.id));

    console.log(`  Found ${games.length} completed games, ${newGames.length} need play-by-play fetch`);

    if (newGames.length === 0) {
      console.log('  All games already have play-by-play data. Done.');
      await completeSync(syncId, 0);
      return;
    }

    let totalEvents = 0;
    let gamesProcessed = 0;
    let gamesSkipped = 0;

    for (let i = 0; i < newGames.length; i++) {
      const gameId = newGames[i].id;

      try {
        const data = await fetchWithRetry(`/gamecenter/${gameId}/play-by-play`);
        const plays = data?.plays || [];

        if (plays.length === 0) {
          gamesSkipped++;
          continue;
        }

        const rows = [];
        for (const play of plays) {
          const details = play.details || {};

          // Determine primary player from details
          let playerId = details.scoringPlayerId
            || details.shootingPlayerId
            || details.hittingPlayerId
            || details.winningPlayerId
            || details.playerId
            || null;

          // Get team abbrev from event owner team ID
          let teamAbbrev = null;
          if (details.eventOwnerTeamId) {
            if (data.awayTeam && data.awayTeam.id === details.eventOwnerTeamId) {
              teamAbbrev = data.awayTeam.abbrev;
            } else if (data.homeTeam && data.homeTeam.id === details.eventOwnerTeamId) {
              teamAbbrev = data.homeTeam.abbrev;
            }
          }

          rows.push({
            game_id: gameId,
            event_id: play.eventId,
            period: play.periodDescriptor?.number || null,
            period_type: play.periodDescriptor?.periodType || null,
            time_in_period: play.timeInPeriod || null,
            time_remaining: play.timeRemaining || null,
            situation_code: play.situationCode || null,
            event_type: play.typeDescKey || play.typeCode?.toString() || 'unknown',
            type_desc: play.typeDescKey || null,
            x_coord: details.xCoord ?? null,
            y_coord: details.yCoord ?? null,
            zone_code: details.zoneCode || null,
            player_id: playerId,
            player_name: null,
            team_abbrev: teamAbbrev,
            detail: Object.keys(details).length > 0 ? details : null,
          });
        }

        // Batch insert in groups of 500
        const count = await batchUpsert('game_play_by_play', rows, 'game_id,event_id', 500);
        totalEvents += count;
        gamesProcessed++;
      } catch (err) {
        // Non-fatal — skip games that fail
        gamesSkipped++;
      }

      // Delay between requests
      await sleep(500);

      // Log progress every 25 games
      if ((i + 1) % 25 === 0 || i === newGames.length - 1) {
        progress(i + 1, newGames.length, `games (${totalEvents} events, ${gamesSkipped} skipped)`);
      }
    }

    console.log(`\n  Processed: ${gamesProcessed} games, ${totalEvents} total events`);
    console.log(`  Skipped: ${gamesSkipped} games`);

    await completeSync(syncId, totalEvents);
    console.log('=== Play-by-Play seeding complete ===\n');
  } catch (err) {
    console.error('Play-by-Play seeding failed:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
