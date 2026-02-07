/**
 * Seed per-game ADVANCED skater and goalie stats from the Stats REST API.
 * Uses isGame=true to get per-game metrics NOT available from boxscores:
 *   - puckPossessions: Corsi, Fenwick, zone starts
 *   - percentages: shooting%, on-ice save%, PDO
 *   - scoringRates: goals/60, assists/60, points/60
 *   - timeonice: detailed TOI by situation (EV, PP, SH)
 *   - goalie advanced: quality starts, goals above expected
 *   - goalie savesByStrength: EV/PP/SH save% per game
 *
 * This enables time-series analysis: which skaters are picking up pace,
 * trending up/down over rolling windows, etc.
 *
 * Run: node scripts/seed-player-game-stats.mjs
 */

import {
  supabase, batchUpsert, startSync, completeSync, failSync,
  sleep, progress,
  SEASON, SEASON_STR,
} from './seed-utils.mjs';

// ============================================
// Constants
// ============================================

const STATS_API = 'https://api.nhle.com/stats/rest/en';
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 500;

// Skater categories that provide data NOT in boxscores (high value for trends)
const SKATER_GAME_CATEGORIES = [
  'puckPossessions',   // Corsi, Fenwick, zone start%, sat%
  'percentages',       // shooting%, on-ice shooting%, on-ice save%, PDO
  'scoringRates',      // goals/60, assists/60, points/60, shots/60
  'timeonice',         // EV TOI, PP TOI, SH TOI per game
];

// Goalie categories for per-game advanced metrics
const GOALIE_GAME_CATEGORIES = [
  'advanced',          // quality starts, goals saved above expected
  'savesByStrength',   // EV/PP/SH save% per game
];

// ============================================
// Rate-limited fetch for stats API
// ============================================

let lastFetchTime = 0;

async function fetchStats(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const now = Date.now();
    const elapsed = now - lastFetchTime;
    if (elapsed < REQUEST_DELAY_MS) {
      await sleep(REQUEST_DELAY_MS - elapsed);
    }
    lastFetchTime = Date.now();

    const response = await fetch(url, { redirect: 'follow' });
    if (response.ok) {
      return response.json();
    }
    if (response.status === 429 && attempt < retries) {
      const backoff = (attempt + 1) * 3000;
      console.warn(`      Rate limited (429), waiting ${backoff}ms before retry...`);
      await sleep(backoff);
      continue;
    }
    if (response.status === 404 || response.status === 500) {
      return null; // Category may not support isGame=true
    }
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
}

// ============================================
// Paginated fetch with isGame=true
// ============================================

async function fetchAllGamePages(entity, category) {
  const allData = [];
  let start = 0;
  let total = Infinity;

  while (start < total) {
    const url = `${STATS_API}/${entity}/${category}?cayenneExp=seasonId=${SEASON}&isGame=true&limit=${PAGE_SIZE}&start=${start}`;
    const result = await fetchStats(url);
    if (!result) return null; // Category doesn't support isGame=true
    total = result.total || 0;
    const rows = result.data || [];
    allData.push(...rows);
    start += PAGE_SIZE;

    // Log progress for large datasets
    if (allData.length > 0 && allData.length % 1000 === 0) {
      console.log(`      ...fetched ${allData.length}/${total} rows`);
    }
  }

  return allData;
}

// ============================================
// Phase 1: Skater per-game categories
// ============================================

async function seedSkaterGameCategories() {
  console.log('\n  Phase 1: Skater per-game advanced stats');
  let totalRows = 0;

  for (let i = 0; i < SKATER_GAME_CATEGORIES.length; i++) {
    const cat = SKATER_GAME_CATEGORIES[i];
    try {
      console.log(`    [${cat}] Fetching...`);
      const data = await fetchAllGamePages('skater', cat);

      if (!data || data.length === 0) {
        console.log(`    [${cat}] No data or not supported with isGame=true`);
        continue;
      }

      console.log(`    [${cat}] ${data.length} player-game rows fetched`);

      // Map to table format, batching to avoid memory issues
      const batchSize = 2000;
      let categoryTotal = 0;

      for (let j = 0; j < data.length; j += batchSize) {
        const batch = data.slice(j, j + batchSize);
        const rows = batch.map(row => ({
          player_id: row.playerId,
          player_name: row.skaterFullName || null,
          team_abbrev: row.teamAbbrevs || null,
          game_id: row.gameId || null,
          game_date: row.gameDate || null,
          opponent_abbrev: row.opponentTeamAbbrev || null,
          home_road: row.homeRoad || null,
          season: SEASON,
          stat_category: cat,
          data: row,
          fetched_at: new Date().toISOString(),
        }));

        const count = await batchUpsert(
          'skater_game_categories',
          rows,
          'player_id,game_id,stat_category',
        );
        categoryTotal += count;
      }

      totalRows += categoryTotal;
      console.log(`    [${cat}] ${categoryTotal} records upserted`);
    } catch (err) {
      console.error(`    [${cat}] FAILED: ${err.message}`);
    }
  }

  console.log(`  Skater per-game total: ${totalRows} rows`);
  return totalRows;
}

// ============================================
// Phase 2: Goalie per-game categories
// ============================================

async function seedGoalieGameCategories() {
  console.log('\n  Phase 2: Goalie per-game advanced stats');
  let totalRows = 0;

  for (let i = 0; i < GOALIE_GAME_CATEGORIES.length; i++) {
    const cat = GOALIE_GAME_CATEGORIES[i];
    try {
      console.log(`    [${cat}] Fetching...`);
      const data = await fetchAllGamePages('goalie', cat);

      if (!data || data.length === 0) {
        console.log(`    [${cat}] No data or not supported with isGame=true`);
        continue;
      }

      console.log(`    [${cat}] ${data.length} goalie-game rows fetched`);

      const batchSize = 2000;
      let categoryTotal = 0;

      for (let j = 0; j < data.length; j += batchSize) {
        const batch = data.slice(j, j + batchSize);
        const rows = batch.map(row => ({
          player_id: row.playerId,
          player_name: row.goalieFullName || null,
          team_abbrev: row.teamAbbrevs || null,
          game_id: row.gameId || null,
          game_date: row.gameDate || null,
          opponent_abbrev: row.opponentTeamAbbrev || null,
          home_road: row.homeRoad || null,
          season: SEASON,
          stat_category: cat,
          data: row,
          fetched_at: new Date().toISOString(),
        }));

        const count = await batchUpsert(
          'goalie_game_categories',
          rows,
          'player_id,game_id,stat_category',
        );
        categoryTotal += count;
      }

      totalRows += categoryTotal;
      console.log(`    [${cat}] ${categoryTotal} records upserted`);
    } catch (err) {
      console.error(`    [${cat}] FAILED: ${err.message}`);
    }
  }

  console.log(`  Goalie per-game total: ${totalRows} rows`);
  return totalRows;
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('=== Seeding Per-Game Player Advanced Stats ===');
  console.log(`  Season: ${SEASON}`);
  console.log(`  Skater categories: ${SKATER_GAME_CATEGORIES.join(', ')}`);
  console.log(`  Goalie categories: ${GOALIE_GAME_CATEGORIES.join(', ')}`);

  const syncId = await startSync('player_game_stats');
  const startTime = Date.now();

  try {
    const skaterCount = await seedSkaterGameCategories();
    const goalieCount = await seedGoalieGameCategories();

    const totalRecords = skaterCount + goalieCount;
    await completeSync(syncId, totalRecords);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n=== Per-game player stats complete ===`);
    console.log(`  Skater rows: ${skaterCount}`);
    console.log(`  Goalie rows: ${goalieCount}`);
    console.log(`  TOTAL:       ${totalRecords} rows in ${elapsed}s`);
  } catch (err) {
    console.error('\nPer-game player stats seeding FAILED:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
