/**
 * Seed ALL NHL stat categories from the stats REST API into JSONB tables.
 *
 * Covers:
 *   - 24 team stat categories (season-level)
 *   - 17 skater stat categories (season-level, paginated)
 *   - 8 goalie stat categories (season-level, paginated)
 *   - Per-game team stats for select categories
 *
 * Run: node scripts/seed-stat-categories.mjs
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
const REQUEST_DELAY_MS = 1500; // 1.5s between requests to avoid rate limiting

const TEAM_CATEGORIES = [
  'summary', 'percentages', 'summaryshooting', 'realtime',
  'penalties', 'penaltykill', 'penaltykilltime', 'powerplay',
  'powerplaytime', 'faceoffpercentages', 'faceoffwins',
  'goalsbyperiod', 'goalsforbystrength', 'goalsagainstbystrength',
  'leadingtrailing', 'outshootoutshot', 'scoretrailfirst',
  'shottype', 'daysbetweengames', 'record', 'scoring',
];

const SKATER_CATEGORIES = [
  'summary', 'bios', 'faceoffpercentages', 'faceoffwins',
  'goalsForAgainst', 'realtime', 'penalties', 'penaltykill',
  'powerplay', 'puckPossessions', 'summaryshooting', 'percentages',
  'scoringRates', 'scoringpergame', 'shootout', 'shottype', 'timeonice',
];

const GOALIE_CATEGORIES = [
  'summary', 'bios', 'advanced', 'daysrest',
  'penaltyShots', 'savesByStrength', 'shootout', 'startedVsRelieved',
];

// Team categories that support isGame=true for per-game breakdowns
const GAME_LEVEL_CATEGORIES = ['summary', 'realtime', 'penalties'];

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
      const backoff = (attempt + 1) * 10000;
      console.warn(`      Rate limited (429), waiting ${backoff / 1000}s before retry...`);
      await sleep(backoff);
      continue;
    }
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
}

// ============================================
// Paginated fetch — gets all rows for a category
// ============================================

async function fetchAllPages(entity, category, extraParams = '') {
  const allData = [];
  let start = 0;
  let total = Infinity;

  while (start < total) {
    const url = `${STATS_API}/${entity}/${category}?cayenneExp=seasonId=${SEASON}${extraParams}&limit=${PAGE_SIZE}&start=${start}`;
    const result = await fetchStats(url);
    total = result.total || 0;
    const rows = result.data || [];
    allData.push(...rows);
    start += PAGE_SIZE;
  }

  return allData;
}

// ============================================
// Deduplicate rows by a key function (keep last occurrence)
// ============================================

function dedup(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    map.set(keyFn(row), row);
  }
  return Array.from(map.values());
}

// ============================================
// Team name mapping (teamId -> abbrev)
// We fetch this from the summary category on first use
// ============================================

let teamIdToAbbrev = null;

async function getTeamAbbrev(teamId, teamFullName) {
  if (!teamIdToAbbrev) {
    // Build mapping from the team summary data
    try {
      const data = await fetchAllPages('team', 'summary');
      teamIdToAbbrev = new Map();
      // Also try to get abbrevs from our Supabase teams table
      const { data: teams } = await supabase.from('teams').select('id, abbrev');
      if (teams) {
        for (const t of teams) {
          teamIdToAbbrev.set(t.id, t.abbrev);
        }
      }
    } catch {
      teamIdToAbbrev = new Map();
    }
  }
  return teamIdToAbbrev.get(teamId) || null;
}

// ============================================
// Phase 1: Seed team stat categories
// ============================================

async function seedTeamCategories() {
  console.log('\n  Phase 1: Team stat categories');
  let totalRows = 0;

  for (let i = 0; i < TEAM_CATEGORIES.length; i++) {
    const cat = TEAM_CATEGORIES[i];
    try {
      const data = await fetchAllPages('team', cat);

      if (data.length === 0) {
        console.log(`    [${cat}] 0 records (empty)`);
        continue;
      }

      // Map each row to our table format
      const rows = [];
      for (const row of data) {
        const abbrev = await getTeamAbbrev(row.teamId, row.teamFullName);
        if (!abbrev) continue;
        rows.push({
          team_abbrev: abbrev,
          season: SEASON,
          stat_category: cat,
          data: row,
          fetched_at: new Date().toISOString(),
        });
      }

      // Dedup by team (some categories return duplicate rows per team)
      const dedupedRows = dedup(rows, r => r.team_abbrev);

      const count = await batchUpsert(
        'team_stat_categories',
        dedupedRows,
        'team_abbrev,season,stat_category',
      );
      totalRows += count;
      console.log(`    [${cat}] ${count} records`);
    } catch (err) {
      console.error(`    [${cat}] FAILED: ${err.message}`);
    }
  }

  console.log(`  Team categories total: ${totalRows} rows`);
  return totalRows;
}

// ============================================
// Phase 2: Seed skater stat categories
// ============================================

async function seedSkaterCategories() {
  console.log('\n  Phase 2: Skater stat categories');
  let totalRows = 0;

  for (let i = 0; i < SKATER_CATEGORIES.length; i++) {
    const cat = SKATER_CATEGORIES[i];
    try {
      const data = await fetchAllPages('skater', cat);

      if (data.length === 0) {
        console.log(`    [${cat}] 0 records (empty)`);
        continue;
      }

      // Map each row — skater rows have playerId, skaterFullName
      // Dedup by playerId (traded players appear multiple times)
      const rawRows = data.map(row => ({
        player_id: row.playerId,
        player_name: row.skaterFullName || null,
        team_abbrev: row.teamAbbrevs || null,
        season: SEASON,
        stat_category: cat,
        data: row,
        fetched_at: new Date().toISOString(),
      }));
      const rows = dedup(rawRows, r => r.player_id);

      const count = await batchUpsert(
        'skater_stat_categories',
        rows,
        'player_id,season,stat_category',
      );
      totalRows += count;
      console.log(`    [${cat}] ${count} records (${data.length} fetched)`);
    } catch (err) {
      console.error(`    [${cat}] FAILED: ${err.message}`);
    }
  }

  console.log(`  Skater categories total: ${totalRows} rows`);
  return totalRows;
}

// ============================================
// Phase 3: Seed goalie stat categories
// ============================================

async function seedGoalieCategories() {
  console.log('\n  Phase 3: Goalie stat categories');
  let totalRows = 0;

  for (let i = 0; i < GOALIE_CATEGORIES.length; i++) {
    const cat = GOALIE_CATEGORIES[i];
    try {
      const data = await fetchAllPages('goalie', cat);

      if (data.length === 0) {
        console.log(`    [${cat}] 0 records (empty)`);
        continue;
      }

      // Map each row — goalie rows have playerId, goalieFullName
      // Dedup by playerId (traded goalies appear multiple times)
      const rawRows = data.map(row => ({
        player_id: row.playerId,
        player_name: row.goalieFullName || null,
        team_abbrev: row.teamAbbrevs || null,
        season: SEASON,
        stat_category: cat,
        data: row,
        fetched_at: new Date().toISOString(),
      }));
      const rows = dedup(rawRows, r => r.player_id);

      const count = await batchUpsert(
        'goalie_stat_categories',
        rows,
        'player_id,season,stat_category',
      );
      totalRows += count;
      console.log(`    [${cat}] ${count} records (${data.length} fetched)`);
    } catch (err) {
      console.error(`    [${cat}] FAILED: ${err.message}`);
    }
  }

  console.log(`  Goalie categories total: ${totalRows} rows`);
  return totalRows;
}

// ============================================
// Phase 4: Seed per-game team stats
// ============================================

async function seedTeamGameStats() {
  console.log('\n  Phase 4: Per-game team stats');
  let totalRows = 0;

  for (const cat of GAME_LEVEL_CATEGORIES) {
    try {
      const data = await fetchAllPages('team', cat, '&isGame=true');

      if (data.length === 0) {
        console.log(`    [game/${cat}] 0 records (empty)`);
        continue;
      }

      const rows = [];
      for (const row of data) {
        const abbrev = await getTeamAbbrev(row.teamId, row.teamFullName);
        if (!abbrev) continue;

        rows.push({
          team_abbrev: abbrev,
          game_id: row.gameId || null,
          opponent_abbrev: row.opponentTeamAbbrev || null,
          game_date: row.gameDate || null,
          home_road: row.homeRoad || null,
          season: SEASON,
          stat_category: cat,
          data: row,
          fetched_at: new Date().toISOString(),
        });
      }

      // Dedup by composite key (team+game can appear twice in API results)
      const dedupedRows = dedup(rows, r => `${r.team_abbrev}:${r.game_id}:${r.stat_category}`);

      const count = await batchUpsert(
        'team_game_stats',
        dedupedRows,
        'team_abbrev,game_id,stat_category',
      );
      totalRows += count;
      console.log(`    [game/${cat}] ${count} records (${data.length} fetched)`);
    } catch (err) {
      console.error(`    [game/${cat}] FAILED: ${err.message}`);
    }
  }

  console.log(`  Team game stats total: ${totalRows} rows`);
  return totalRows;
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('=== Seeding ALL NHL Stat Categories (JSONB) ===');
  console.log(`  Season: ${SEASON}`);
  console.log(`  Team categories: ${TEAM_CATEGORIES.length}`);
  console.log(`  Skater categories: ${SKATER_CATEGORIES.length}`);
  console.log(`  Goalie categories: ${GOALIE_CATEGORIES.length}`);
  console.log(`  Game-level categories: ${GAME_LEVEL_CATEGORIES.length}`);

  const syncId = await startSync('stat_categories');
  const startTime = Date.now();

  try {
    const teamCount = await seedTeamCategories();
    const skaterCount = await seedSkaterCategories();
    const goalieCount = await seedGoalieCategories();
    const gameCount = await seedTeamGameStats();

    const totalRecords = teamCount + skaterCount + goalieCount + gameCount;
    await completeSync(syncId, totalRecords);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n=== Stat category seeding complete ===`);
    console.log(`  Team rows:   ${teamCount}`);
    console.log(`  Skater rows: ${skaterCount}`);
    console.log(`  Goalie rows: ${goalieCount}`);
    console.log(`  Game rows:   ${gameCount}`);
    console.log(`  TOTAL:       ${totalRecords} rows in ${elapsed}s`);
  } catch (err) {
    console.error('\nStat category seeding FAILED:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
