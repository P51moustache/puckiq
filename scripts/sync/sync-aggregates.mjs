/**
 * Incremental sync for aggregate/landing data that updates daily.
 * Lightweight — only fetches league-wide aggregates, not per-player.
 *
 * Covers:
 * - Edge IQ landing pages (skater/goalie/team/by-the-numbers)
 * - Edge IQ top-10 lists
 *
 * These are ~30 API calls total (not 900+ like per-player data).
 * Per-player Edge IQ and stat categories are too expensive for daily sync
 * and should only be refreshed weekly via --full seed.
 *
 * Usage:
 *   node scripts/sync/sync-aggregates.mjs
 */

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { getCurrentSeason, fetchWithRetry, sleep } from './nhl-api.mjs';

const NHL_API = 'https://api-web.nhle.com/v1';

// Edge IQ landing pages (4 calls)
const EDGE_LANDING = [
  'skater-landing', 'goalie-landing', 'team-landing', 'by-the-numbers',
];

// Edge IQ top-10 lists (13 calls)
const EDGE_TOP_10 = [
  'skater-speed-top-10', 'skater-distance-top-10', 'skater-shot-speed-top-10',
  'skater-offensive-zone-top-10',
  'goalie-save-pctg-top-10', 'goalie-goals-above-expected-top-10',
  'team-speed-top-10', 'team-distance-top-10', 'team-shot-speed-top-10',
  'team-zone-time-top-10', 'team-offensive-zone-top-10',
  'team-defensive-zone-top-10', 'team-neutral-zone-top-10',
];

async function fetchEdge(path) {
  try {
    return await fetchWithRetry(`${NHL_API}/edge/${path}`);
  } catch {
    return null;
  }
}

async function syncEdgeLanding() {
  console.log('  [edge] Syncing landing pages...');
  const season = getCurrentSeason();
  const rows = [];

  for (const page of EDGE_LANDING) {
    const data = await fetchEdge(`${page}/now`);
    if (data) {
      rows.push({
        category: page,
        subcategory: null,
        season,
        data,
        fetched_at: new Date().toISOString(),
      });
    }
    await sleep(200);
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from('edge_leaderboards')
      .upsert(rows, { onConflict: 'category,subcategory,season' });
    if (error) console.warn(`  [edge] landing upsert error: ${error.message}`);
  }

  console.log(`  [edge] ${rows.length} landing pages synced`);
  return rows.length;
}

async function syncEdgeTop10() {
  console.log('  [edge] Syncing top-10 lists...');
  const season = getCurrentSeason();
  const rows = [];

  for (const endpoint of EDGE_TOP_10) {
    const data = await fetchEdge(`${endpoint}/now`);
    if (data) {
      let category = 'top-10';
      if (endpoint.startsWith('skater-')) category = 'skater-top-10';
      else if (endpoint.startsWith('goalie-')) category = 'goalie-top-10';
      else if (endpoint.startsWith('team-')) category = 'team-top-10';

      rows.push({
        category,
        subcategory: endpoint,
        season,
        data,
        fetched_at: new Date().toISOString(),
      });
    }
    await sleep(200);
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from('edge_leaderboards')
      .upsert(rows, { onConflict: 'category,subcategory,season' });
    if (error) console.warn(`  [edge] top-10 upsert error: ${error.message}`);
  }

  console.log(`  [edge] ${rows.length} top-10 lists synced`);
  return rows.length;
}

async function syncStatLeaders() {
  console.log('  [leaders] Stat leaders sync skipped — supplemental_data table removed');
  return 0;
}

// Main
logConnectionInfo();
console.log('[sync-aggregates] Syncing daily aggregate data...');

try {
  let total = 0;
  total += await syncEdgeLanding();
  total += await syncEdgeTop10();
  total += await syncStatLeaders();

  // Log
  try {
    await supabase.from('sync_log').insert({
      sync_type: 'aggregates',
      status: 'completed',
      completed_at: new Date().toISOString(),
      records_processed: total,
    });
  } catch { /* sync_log may not exist */ }

  console.log(`[sync-aggregates] Done: ${total} records synced`);
} catch (err) {
  console.error('[sync-aggregates] Fatal error:', err);
  process.exit(1);
}
