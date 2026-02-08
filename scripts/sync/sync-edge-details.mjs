/**
 * Weekly sync for Edge IQ detailed stats (per-entity endpoints).
 *
 * Fetches Edge IQ detail data for teams, skaters, and goalies from the
 * NHL Edge API and upserts into the `edge_detailed_stats` table.
 *
 * This is expensive (~900+ API calls) so it runs weekly (Monday 6am ET),
 * not daily. The daily sync-aggregates.mjs handles lightweight landing pages.
 *
 * Usage:
 *   node scripts/sync/sync-edge-details.mjs
 */

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { getCurrentSeason, sleep } from './nhl-api.mjs';

const NHL_API = 'https://api-web.nhle.com/v1';
const EDGE = '/edge';
const BASE_DELAY_MS = 1000;
const MAX_RETRIES = 4;
const BATCH_SIZE = 200;

// ============================================
// Edge endpoint definitions (per-entity)
// ============================================

const TEAM_ENDPOINTS = [
  'team-zone-time-details',
  'team-shot-location-detail',
  'team-comparison',
  'team-shot-speed-detail',
  'team-skating-speed-detail',
  'team-skating-distance-detail',
];

const SKATER_ENDPOINTS = [
  'skater-zone-time',
  'skater-shot-speed-detail',
  'skater-skating-speed-detail',
  'skater-skating-distance-detail',
  'skater-shot-location-detail',
  'skater-comparison',
];

const GOALIE_ENDPOINTS = [
  'goalie-5v5-detail',
  'goalie-save-percentage-detail',
  'goalie-shot-location-detail',
  'goalie-comparison',
];

// ============================================
// Fetch with retry and exponential backoff
// ============================================

async function fetchEdge(path) {
  const url = `${NHL_API}${EDGE}/${path}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { redirect: 'follow' });

      if (response.status === 429) {
        const backoff = BASE_DELAY_MS * Math.pow(2, attempt + 1);
        if (attempt < MAX_RETRIES) {
          process.stdout.write(` [429, wait ${backoff / 1000}s]`);
          await sleep(backoff);
          continue;
        }
        return null;
      }

      if (response.status === 404) return null;
      if (!response.ok) return null;

      return await response.json();
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ============================================
// Batch upsert helper
// ============================================

async function batchUpsert(rows) {
  if (rows.length === 0) return 0;
  let totalUpserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('edge_detailed_stats')
      .upsert(batch, { onConflict: 'entity_type,entity_id,season,endpoint_name' });

    if (error) {
      console.error(`  [sync-edge-details] batch upsert error at ${i}: ${error.message}`);
    } else {
      totalUpserted += batch.length;
    }
  }
  return totalUpserted;
}

// ============================================
// Phase 1: Per-team endpoints
// ============================================

async function syncTeamEdge(season) {
  console.log('  [edge-details] Syncing per-team endpoints...');

  // Load teams from Supabase
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('id, abbrev, full_name');

  if (teamsErr || !teams?.length) {
    console.warn(`  [edge-details] Failed to load teams: ${teamsErr?.message || 'no teams found'}`);
    return 0;
  }

  const rows = [];
  let fetched = 0;

  for (const team of teams) {
    for (const endpoint of TEAM_ENDPOINTS) {
      try {
        const data = await fetchEdge(`${endpoint}/${team.id}/now`);
        if (data) {
          rows.push({
            entity_type: 'team',
            entity_id: team.id,
            entity_name: team.full_name || team.abbrev,
            team_abbrev: team.abbrev,
            season,
            endpoint_name: endpoint,
            data,
            fetched_at: new Date().toISOString(),
          });
          fetched++;
        }
      } catch (err) {
        console.warn(`  [edge-details] team ${team.abbrev}/${endpoint} failed: ${err.message}`);
      }
      await sleep(BASE_DELAY_MS);
    }
  }

  const upserted = await batchUpsert(rows);
  console.log(`  [edge-details] Teams: ${fetched} fetched, ${upserted} upserted`);
  return upserted;
}

// ============================================
// Phase 2: Per-skater endpoints
// ============================================

async function syncSkaterEdge(season) {
  console.log('  [edge-details] Syncing per-skater endpoints...');

  const { data: skaters, error: skatersErr } = await supabase
    .from('players')
    .select('id, first_name, last_name, full_name, current_team_abbrev, position')
    .neq('position', 'G')
    .eq('is_active', true);

  if (skatersErr) {
    console.warn(`  [edge-details] Failed to load skaters: ${skatersErr.message}`);
    return 0;
  }

  const skaterList = skaters || [];
  if (skaterList.length === 0) {
    console.warn('  [edge-details] No skaters in players table — skipping');
    return 0;
  }

  console.log(`  [edge-details] Processing ${skaterList.length} skaters x ${SKATER_ENDPOINTS.length} endpoints`);

  let totalUpserted = 0;
  let rows = [];
  let fetched = 0;
  let processed = 0;

  for (const skater of skaterList) {
    for (const endpoint of SKATER_ENDPOINTS) {
      try {
        const data = await fetchEdge(`${endpoint}/${skater.id}/now`);
        if (data) {
          rows.push({
            entity_type: 'skater',
            entity_id: skater.id,
            entity_name: skater.full_name || `${skater.first_name} ${skater.last_name}`,
            team_abbrev: skater.current_team_abbrev,
            season,
            endpoint_name: endpoint,
            data,
            fetched_at: new Date().toISOString(),
          });
          fetched++;
        }
      } catch (err) {
        console.warn(`  [edge-details] skater ${skater.id}/${endpoint} failed: ${err.message}`);
      }
      await sleep(BASE_DELAY_MS);
    }

    processed++;
    if (processed % 50 === 0) {
      console.log(`  [edge-details] Skaters: ${processed}/${skaterList.length} processed (${fetched} fetched)`);
    }

    // Flush periodically to avoid holding too many rows in memory
    if (rows.length >= 300) {
      totalUpserted += await batchUpsert(rows);
      rows = [];
    }
  }

  // Flush remaining
  if (rows.length > 0) {
    totalUpserted += await batchUpsert(rows);
  }

  console.log(`  [edge-details] Skaters: ${fetched} fetched, ${totalUpserted} upserted`);
  return totalUpserted;
}

// ============================================
// Phase 3: Per-goalie endpoints
// ============================================

async function syncGoalieEdge(season) {
  console.log('  [edge-details] Syncing per-goalie endpoints...');

  const { data: goalies, error: goaliesErr } = await supabase
    .from('players')
    .select('id, first_name, last_name, full_name, current_team_abbrev, position')
    .eq('position', 'G')
    .eq('is_active', true);

  if (goaliesErr) {
    console.warn(`  [edge-details] Failed to load goalies: ${goaliesErr.message}`);
    return 0;
  }

  const goalieList = goalies || [];
  if (goalieList.length === 0) {
    console.warn('  [edge-details] No goalies in players table — skipping');
    return 0;
  }

  console.log(`  [edge-details] Processing ${goalieList.length} goalies x ${GOALIE_ENDPOINTS.length} endpoints`);

  const rows = [];
  let fetched = 0;

  for (const goalie of goalieList) {
    for (const endpoint of GOALIE_ENDPOINTS) {
      try {
        const data = await fetchEdge(`${endpoint}/${goalie.id}/now`);
        if (data) {
          rows.push({
            entity_type: 'goalie',
            entity_id: goalie.id,
            entity_name: goalie.full_name || `${goalie.first_name} ${goalie.last_name}`,
            team_abbrev: goalie.current_team_abbrev,
            season,
            endpoint_name: endpoint,
            data,
            fetched_at: new Date().toISOString(),
          });
          fetched++;
        }
      } catch (err) {
        console.warn(`  [edge-details] goalie ${goalie.id}/${endpoint} failed: ${err.message}`);
      }
      await sleep(BASE_DELAY_MS);
    }
  }

  const upserted = await batchUpsert(rows);
  console.log(`  [edge-details] Goalies: ${fetched} fetched, ${upserted} upserted`);
  return upserted;
}

// ============================================
// Main
// ============================================

logConnectionInfo();
console.log('[sync-edge-details] Syncing Edge IQ detailed stats (weekly)...');

try {
  const season = getCurrentSeason();
  let total = 0;

  total += await syncTeamEdge(season);
  total += await syncSkaterEdge(season);
  total += await syncGoalieEdge(season);

  // Log to sync_log
  try {
    await supabase.from('sync_log').insert({
      sync_type: 'edge_details',
      status: 'completed',
      completed_at: new Date().toISOString(),
      records_processed: total,
    });
  } catch { /* sync_log may not exist */ }

  console.log(`[sync-edge-details] Done: ${total} records synced`);
} catch (err) {
  console.error('[sync-edge-details] Fatal error:', err);

  try {
    await supabase.from('sync_log').insert({
      sync_type: 'edge_details',
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: err.message,
    });
  } catch { /* sync_log may not exist */ }

  process.exit(1);
}
