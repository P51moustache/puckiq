/**
 * Incremental sync for per-game player trend data.
 *
 * Two modes controlled by schedule:
 *
 * 1. DAILY (default): Sync player game logs for players on teams
 *    that played yesterday/today. Lightweight — ~40 API calls max.
 *
 * 2. WEEKLY (--weekly flag): Full refresh of per-game advanced stats
 *    from the Stats REST API (isGame=true). This is heavier (~6 paginated
 *    category fetches) but the only way to get Corsi, Fenwick, PDO,
 *    scoring rates, and zone starts per game. The Stats REST API doesn't
 *    support date filtering, so we re-fetch the whole season and upsert
 *    (existing rows are unchanged, new games are added).
 *
 * Usage:
 *   node scripts/sync/sync-player-trends.mjs           # Daily: game logs only
 *   node scripts/sync/sync-player-trends.mjs --weekly   # Weekly: advanced stats + game logs
 */

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { getCurrentSeason, getCurrentSeasonStr, formatDate, fetchWithRetry, sleep } from './nhl-api.mjs';

const NHL_API = 'https://api-web.nhle.com/v1';
const STATS_API = 'https://api.nhle.com/stats/rest/en';
const isWeekly = process.argv.includes('--weekly');
const PAGE_SIZE = 100;

// Advanced stat categories (only fetched weekly)
const SKATER_GAME_CATEGORIES = ['puckPossessions', 'percentages', 'scoringRates', 'timeonice'];
const GOALIE_GAME_CATEGORIES = ['advanced', 'savesByStrength'];

// ============================================
// Rate-limited fetch for Stats REST API
// ============================================

let lastFetchTime = 0;
const REQUEST_DELAY = 500;

async function fetchStats(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const now = Date.now();
    if (now - lastFetchTime < REQUEST_DELAY) {
      await sleep(REQUEST_DELAY - (now - lastFetchTime));
    }
    lastFetchTime = Date.now();

    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (response.ok) return response.json();
      if (response.status === 429 && attempt < retries) {
        const backoff = (attempt + 1) * 3000;
        console.warn(`    Rate limited, waiting ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }
      if (response.status === 404 || response.status === 500) return null;
      throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
}

// ============================================
// Paginated Stats REST API fetch
// ============================================

async function fetchAllGamePages(entity, category) {
  const season = getCurrentSeason();
  const allData = [];
  let start = 0;
  let total = Infinity;

  while (start < total) {
    const url = `${STATS_API}/${entity}/${category}?cayenneExp=seasonId=${season}&isGame=true&limit=${PAGE_SIZE}&start=${start}`;
    const result = await fetchStats(url);
    if (!result) return null;
    total = result.total || 0;
    allData.push(...(result.data || []));
    start += PAGE_SIZE;
  }

  return allData;
}

// ============================================
// WEEKLY: Sync per-game advanced stats
// ============================================

async function syncAdvancedStats() {
  console.log('  [advanced] Syncing per-game advanced stats (weekly refresh)...');
  const season = getCurrentSeason();
  let totalRows = 0;

  // Skater categories
  for (const cat of SKATER_GAME_CATEGORIES) {
    try {
      console.log(`    [skater/${cat}] Fetching...`);
      const data = await fetchAllGamePages('skater', cat);
      if (!data || data.length === 0) {
        console.log(`    [skater/${cat}] No data`);
        continue;
      }

      console.log(`    [skater/${cat}] ${data.length} rows fetched`);
      const batchSize = 500;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize).map(row => ({
          player_id: row.playerId,
          player_name: row.skaterFullName || null,
          team_abbrev: row.teamAbbrevs || null,
          game_id: row.gameId || null,
          game_date: row.gameDate || null,
          opponent_abbrev: row.opponentTeamAbbrev || null,
          home_road: row.homeRoad || null,
          season,
          stat_category: cat,
          data: row,
          fetched_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('skater_game_categories')
          .upsert(batch, { onConflict: 'player_id,game_id,stat_category' });
        if (error) console.warn(`    [skater/${cat}] batch error: ${error.message}`);
        else totalRows += batch.length;
      }
    } catch (err) {
      console.error(`    [skater/${cat}] FAILED: ${err.message}`);
    }
  }

  // Goalie categories
  for (const cat of GOALIE_GAME_CATEGORIES) {
    try {
      console.log(`    [goalie/${cat}] Fetching...`);
      const data = await fetchAllGamePages('goalie', cat);
      if (!data || data.length === 0) {
        console.log(`    [goalie/${cat}] No data`);
        continue;
      }

      console.log(`    [goalie/${cat}] ${data.length} rows fetched`);
      const batchSize = 500;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize).map(row => ({
          player_id: row.playerId,
          player_name: row.goalieFullName || null,
          team_abbrev: row.teamAbbrevs || null,
          game_id: row.gameId || null,
          game_date: row.gameDate || null,
          opponent_abbrev: row.opponentTeamAbbrev || null,
          home_road: row.homeRoad || null,
          season,
          stat_category: cat,
          data: row,
          fetched_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('goalie_game_categories')
          .upsert(batch, { onConflict: 'player_id,game_id,stat_category' });
        if (error) console.warn(`    [goalie/${cat}] batch error: ${error.message}`);
        else totalRows += batch.length;
      }
    } catch (err) {
      console.error(`    [goalie/${cat}] FAILED: ${err.message}`);
    }
  }

  console.log(`  [advanced] ${totalRows} per-game stats synced`);
  return totalRows;
}

// ============================================
// DAILY: Sync game logs for players who played recently
// ============================================

async function syncRecentGameLogs() {
  console.log('  [game-logs] Syncing game logs for recent players...');
  const season = getCurrentSeason();
  const seasonStr = getCurrentSeasonStr();

  // Find games completed yesterday/today
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dates = [formatDate(yesterday), formatDate(today)];

  const { data: recentGames } = await supabase
    .from('games')
    .select('id, away_team_abbrev, home_team_abbrev')
    .in('game_state', ['FINAL', 'OFF'])
    .in('game_date', dates);

  if (!recentGames || recentGames.length === 0) {
    console.log('  [game-logs] No recent completed games');
    return 0;
  }

  // Collect unique team abbreviations from recent games
  const teams = new Set();
  for (const g of recentGames) {
    if (g.away_team_abbrev) teams.add(g.away_team_abbrev);
    if (g.home_team_abbrev) teams.add(g.home_team_abbrev);
  }

  console.log(`  [game-logs] ${recentGames.length} recent games, ${teams.size} teams involved`);

  // Get player IDs for those teams
  const { data: players } = await supabase
    .from('players')
    .select('id')
    .in('team_abbrev', [...teams]);

  if (!players || players.length === 0) {
    console.log('  [game-logs] No players found for recent teams');
    return 0;
  }

  console.log(`  [game-logs] Updating game logs for ${players.length} players...`);

  let synced = 0;
  const rows = [];

  for (let i = 0; i < players.length; i++) {
    const playerId = players[i].id;
    try {
      const data = await fetchWithRetry(`${NHL_API}/player/${playerId}/game-log/${seasonStr}/2`);
      if (data?.gameLog?.length > 0) {
        rows.push({
          player_id: playerId,
          season,
          game_type: 2,
          data: data.gameLog,
          fetched_at: new Date().toISOString(),
        });
        synced++;
      }
    } catch { /* non-fatal */ }

    // Batch upsert every 50 players
    if (rows.length >= 50) {
      const { error } = await supabase
        .from('player_game_logs')
        .upsert(rows, { onConflict: 'player_id,season,game_type' });
      if (error) console.warn(`  [game-logs] batch error: ${error.message}`);
      rows.length = 0;
    }
    await sleep(100);
  }

  // Flush remaining
  if (rows.length > 0) {
    const { error } = await supabase
      .from('player_game_logs')
      .upsert(rows, { onConflict: 'player_id,season,game_type' });
    if (error) console.warn(`  [game-logs] final batch error: ${error.message}`);
  }

  console.log(`  [game-logs] ${synced} player game logs updated`);
  return synced;
}

// ============================================
// Main
// ============================================

logConnectionInfo();
console.log(`[sync-player-trends] Mode: ${isWeekly ? 'WEEKLY (advanced + game logs)' : 'DAILY (game logs only)'}`);

try {
  let total = 0;

  // Weekly: full advanced stats refresh
  if (isWeekly) {
    total += await syncAdvancedStats();
  }

  // Always: sync recent game logs
  total += await syncRecentGameLogs();

  // Log
  try {
    await supabase.from('sync_log').insert({
      sync_type: isWeekly ? 'player_trends_weekly' : 'player_trends_daily',
      status: 'completed',
      completed_at: new Date().toISOString(),
      records_processed: total,
    });
  } catch { /* sync_log may not exist */ }

  console.log(`[sync-player-trends] Done: ${total} records synced`);
} catch (err) {
  console.error('[sync-player-trends] Fatal error:', err);
  process.exit(1);
}
