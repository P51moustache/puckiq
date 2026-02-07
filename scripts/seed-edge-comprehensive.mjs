/**
 * Seed ALL Edge IQ comprehensive data from NHL Edge API.
 * Stores full JSONB responses for every Edge endpoint.
 *
 * This is ADDITIVE to seed-edge-stats.mjs — does not modify existing tables.
 *
 * Run: node scripts/seed-edge-comprehensive.mjs
 */

import {
  supabase, batchUpsert, startSync, completeSync, failSync,
  sleep, progress, SEASON, NHL_API
} from './seed-utils.mjs';

const EDGE = '/edge';
const BASE_DELAY_MS = 1000;   // 1 second between requests
const MAX_RETRIES = 4;        // Retry up to 4 times on 429

// ============================================
// Edge endpoint definitions
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

const LEAGUE_LANDING_PAGES = [
  'skater-landing',
  'goalie-landing',
  'team-landing',
  'by-the-numbers',
];

// Simple top-10 endpoints (no required params, just /now)
const TOP_10_ENDPOINTS = [
  'skater-speed-top-10',
  'skater-distance-top-10',
  'skater-shot-speed-top-10',
  'goalie-save-pctg-top-10',
  'goalie-goals-above-expected-top-10',
  'team-speed-top-10',
  'team-distance-top-10',
  'team-shot-speed-top-10',
  'team-zone-time-top-10',
  'team-offensive-zone-top-10',
  'team-defensive-zone-top-10',
  'team-neutral-zone-top-10',
  'skater-offensive-zone-top-10',
];

// Parametric top-10 endpoints (require path params before /now)
const PARAMETRIC_TOP_10_ENDPOINTS = [
  // goalie-5v5-top-10/{sort-by}/now
  { path: 'goalie-5v5-top-10/savePct/now', name: 'goalie-5v5-top-10-savePct' },
  { path: 'goalie-5v5-top-10/goalsAgainstAverage/now', name: 'goalie-5v5-top-10-gaa' },
  // goalie-edge-save-pctg-top-10/{sort-by}/now
  { path: 'goalie-edge-save-pctg-top-10/savePctg/now', name: 'goalie-edge-save-pctg-top-10' },
  // goalie-shot-location-top-10/{category}/{sort-by}/now
  { path: 'goalie-shot-location-top-10/all/savePctg/now', name: 'goalie-shot-location-top-10-all' },
  // skater-shot-location-top-10/{position}/{category}/{sort-by}/now
  { path: 'skater-shot-location-top-10/all/goals/goals/now', name: 'skater-shot-location-top-10-goals' },
  { path: 'skater-shot-location-top-10/all/shots/shots/now', name: 'skater-shot-location-top-10-shots' },
  // skater-zone-time-top-10/{positions}/{strength}/{sort-by}/now
  { path: 'skater-zone-time-top-10/all/all/offensiveZonePctg/now', name: 'skater-zone-time-top-10-oz' },
  { path: 'skater-zone-time-top-10/all/all/defensiveZonePctg/now', name: 'skater-zone-time-top-10-dz' },
  // team-skating-speed-top-10/{positions}/{sort-by}/now
  { path: 'team-skating-speed-top-10/all/speedBursts/now', name: 'team-skating-speed-top-10-bursts' },
  // team-skating-distance-top-10/{positions}/{strength}/{sort-by}/now
  { path: 'team-skating-distance-top-10/all/all/total/now', name: 'team-skating-distance-top-10-total' },
  // team-shot-location-top-10/{position}/{category}/{sort-by}/now
  { path: 'team-shot-location-top-10/all/goals/goals/now', name: 'team-shot-location-top-10-goals' },
];

// ============================================
// Fetch with retry and exponential backoff for 429s
// Does NOT use fetchNHL — uses its own rate limiter to handle 429
// ============================================
async function fetchEdge(path) {
  const url = `${NHL_API}${EDGE}/${path}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { redirect: 'follow' });

      if (response.status === 429) {
        const backoff = BASE_DELAY_MS * Math.pow(2, attempt + 1); // 2s, 4s, 8s, 16s
        if (attempt < MAX_RETRIES) {
          process.stdout.write(` [429, wait ${backoff / 1000}s]`);
          await sleep(backoff);
          continue;
        }
        return null; // Exhausted retries
      }

      if (response.status === 404) {
        return null; // Expected for some players/endpoints
      }

      if (!response.ok) {
        return null; // Other errors — skip silently
      }

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
// Phase 1: Per-team endpoints
// ============================================
async function seedTeamEdge(teams) {
  console.log('\n--- Phase 1: Per-team Edge endpoints ---');
  const rows = [];
  const totalOps = teams.length * TEAM_ENDPOINTS.length;
  let completed = 0;
  let fetched = 0;

  for (const team of teams) {
    for (const endpoint of TEAM_ENDPOINTS) {
      const data = await fetchEdge(`${endpoint}/${team.id}/now`);
      if (data) {
        rows.push({
          entity_type: 'team',
          entity_id: team.id,
          entity_name: team.full_name || team.abbrev,
          team_abbrev: team.abbrev,
          season: SEASON,
          endpoint_name: endpoint,
          data,
          fetched_at: new Date().toISOString(),
        });
        fetched++;
      }
      completed++;
      await sleep(BASE_DELAY_MS);

      if (completed % 10 === 0 || completed === totalOps) {
        progress(completed, totalOps, `team Edge endpoints (${fetched} fetched)`);
      }
    }
  }

  const count = await batchUpsert('edge_detailed_stats', rows, 'entity_type,entity_id,season,endpoint_name');
  console.log(`  Upserted ${count} team Edge detailed stats`);
  return count;
}

// ============================================
// Phase 2: Per-skater endpoints
// ============================================
async function seedSkaterEdge(skaters) {
  console.log('\n--- Phase 2: Per-skater Edge endpoints ---');
  let totalUpserted = 0;
  let rows = [];
  const totalOps = skaters.length * SKATER_ENDPOINTS.length;
  let completed = 0;
  let fetched = 0;

  for (const skater of skaters) {
    for (const endpoint of SKATER_ENDPOINTS) {
      const data = await fetchEdge(`${endpoint}/${skater.id}/now`);
      if (data) {
        rows.push({
          entity_type: 'skater',
          entity_id: skater.id,
          entity_name: skater.full_name || `${skater.first_name} ${skater.last_name}`,
          team_abbrev: skater.current_team_abbrev,
          season: SEASON,
          endpoint_name: endpoint,
          data,
          fetched_at: new Date().toISOString(),
        });
        fetched++;
      }
      completed++;
      await sleep(BASE_DELAY_MS);

      if (completed % 100 === 0 || completed === totalOps) {
        progress(completed, totalOps, `skater Edge endpoints (${fetched} fetched)`);
      }
    }

    // Batch upsert periodically to avoid holding too many rows in memory
    if (rows.length >= 300) {
      const c = await batchUpsert('edge_detailed_stats', rows, 'entity_type,entity_id,season,endpoint_name');
      totalUpserted += c;
      rows = [];
    }
  }

  // Flush remaining
  if (rows.length > 0) {
    const c = await batchUpsert('edge_detailed_stats', rows, 'entity_type,entity_id,season,endpoint_name');
    totalUpserted += c;
  }
  console.log(`  Upserted ${totalUpserted} skater Edge detailed stats`);
  return totalUpserted;
}

// ============================================
// Phase 3: Per-goalie endpoints
// ============================================
async function seedGoalieEdge(goalies) {
  console.log('\n--- Phase 3: Per-goalie Edge endpoints ---');
  const rows = [];
  const totalOps = goalies.length * GOALIE_ENDPOINTS.length;
  let completed = 0;
  let fetched = 0;

  for (const goalie of goalies) {
    for (const endpoint of GOALIE_ENDPOINTS) {
      const data = await fetchEdge(`${endpoint}/${goalie.id}/now`);
      if (data) {
        rows.push({
          entity_type: 'goalie',
          entity_id: goalie.id,
          entity_name: goalie.full_name || `${goalie.first_name} ${goalie.last_name}`,
          team_abbrev: goalie.current_team_abbrev,
          season: SEASON,
          endpoint_name: endpoint,
          data,
          fetched_at: new Date().toISOString(),
        });
        fetched++;
      }
      completed++;
      await sleep(BASE_DELAY_MS);

      if (completed % 20 === 0 || completed === totalOps) {
        progress(completed, totalOps, `goalie Edge endpoints (${fetched} fetched)`);
      }
    }
  }

  const count = await batchUpsert('edge_detailed_stats', rows, 'entity_type,entity_id,season,endpoint_name');
  console.log(`  Upserted ${count} goalie Edge detailed stats`);
  return count;
}

// ============================================
// Phase 4: League-wide landing pages
// ============================================
async function seedLeagueLanding() {
  console.log('\n--- Phase 4: League-wide landing pages ---');
  let count = 0;

  for (const page of LEAGUE_LANDING_PAGES) {
    const data = await fetchEdge(`${page}/now`);
    if (data) {
      // Use sentinel value for subcategory since UNIQUE constraints don't match NULLs
      const { error } = await supabase
        .from('edge_leaderboards')
        .upsert({
          category: page,
          subcategory: '__landing__',
          season: SEASON,
          data,
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'category,subcategory,season' });

      if (error) {
        console.error(`  Error upserting ${page}:`, error.message);
      } else {
        count++;
        console.log(`  Stored ${page}`);
      }
    } else {
      console.log(`  Skipped ${page} (no data)`);
    }
    await sleep(BASE_DELAY_MS);
  }

  console.log(`  Upserted ${count} league landing pages`);
  return count;
}

// ============================================
// Phase 5: Top-10 lists
// ============================================
async function seedTop10Lists() {
  console.log('\n--- Phase 5: Top-10 lists ---');
  let count = 0;

  // Helper to upsert a single top-10 entry
  async function upsertTop10(endpointOrName, data, pathCategory) {
    let category = 'top-10';
    if (pathCategory.startsWith('skater-')) category = 'skater-top-10';
    else if (pathCategory.startsWith('goalie-')) category = 'goalie-top-10';
    else if (pathCategory.startsWith('team-')) category = 'team-top-10';

    const { error } = await supabase
      .from('edge_leaderboards')
      .upsert({
        category,
        subcategory: endpointOrName,
        season: SEASON,
        data,
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'category,subcategory,season' });

    if (error) {
      console.error(`  Error upserting ${endpointOrName}:`, error.message);
      return false;
    }
    return true;
  }

  // Simple top-10 endpoints
  for (const endpoint of TOP_10_ENDPOINTS) {
    const data = await fetchEdge(`${endpoint}/now`);
    if (data) {
      if (await upsertTop10(endpoint, data, endpoint)) {
        count++;
        console.log(`  Stored ${endpoint}`);
      }
    } else {
      console.log(`  Skipped ${endpoint} (404 or no data)`);
    }
    await sleep(BASE_DELAY_MS);
  }

  // Parametric top-10 endpoints
  for (const { path, name } of PARAMETRIC_TOP_10_ENDPOINTS) {
    const data = await fetchEdge(path);
    if (data) {
      if (await upsertTop10(name, data, name)) {
        count++;
        console.log(`  Stored ${name}`);
      }
    } else {
      console.log(`  Skipped ${name} (404 or no data)`);
    }
    await sleep(BASE_DELAY_MS);
  }

  console.log(`  Upserted ${count} top-10 lists`);
  return count;
}

// ============================================
// Main
// ============================================
async function main() {
  console.log('=== Seeding Edge IQ Comprehensive Data ===');
  console.log(`Season: ${SEASON}`);
  console.log(`Base delay: ${BASE_DELAY_MS}ms, Max retries on 429: ${MAX_RETRIES}`);
  const syncId = await startSync('edge_comprehensive');

  try {
    // Load teams from Supabase
    const { data: teams, error: teamsErr } = await supabase
      .from('teams')
      .select('id, abbrev, full_name');

    if (teamsErr || !teams?.length) {
      throw new Error(`Failed to load teams: ${teamsErr?.message || 'no teams found'}`);
    }
    console.log(`Loaded ${teams.length} teams from database`);

    // Load skaters (non-goalies) from players table
    const { data: skaters, error: skatersErr } = await supabase
      .from('players')
      .select('id, first_name, last_name, full_name, current_team_abbrev, position')
      .neq('position', 'G')
      .eq('is_active', true);

    if (skatersErr) {
      throw new Error(`Failed to load skaters: ${skatersErr.message}`);
    }
    const skaterList = skaters || [];
    console.log(`Loaded ${skaterList.length} skaters from database`);

    if (skaterList.length === 0) {
      console.log('  WARNING: No skaters in players table — skipping skater Edge endpoints.');
      console.log('  Run seed-players.mjs first to populate the players table.');
    }

    // Load goalies from players table
    const { data: goalies, error: goaliesErr } = await supabase
      .from('players')
      .select('id, first_name, last_name, full_name, current_team_abbrev, position')
      .eq('position', 'G')
      .eq('is_active', true);

    if (goaliesErr) {
      throw new Error(`Failed to load goalies: ${goaliesErr.message}`);
    }
    const goalieList = goalies || [];
    console.log(`Loaded ${goalieList.length} goalies from database`);

    if (goalieList.length === 0) {
      console.log('  WARNING: No goalies in players table — skipping goalie Edge endpoints.');
      console.log('  Run seed-players.mjs first to populate the players table.');
    }

    // Run all phases
    let totalRecords = 0;

    totalRecords += await seedTeamEdge(teams);
    totalRecords += await seedSkaterEdge(skaterList);
    totalRecords += await seedGoalieEdge(goalieList);
    totalRecords += await seedLeagueLanding();
    totalRecords += await seedTop10Lists();

    await completeSync(syncId, totalRecords);
    console.log(`\n=== Edge IQ Comprehensive seeding complete: ${totalRecords} total records ===\n`);
  } catch (err) {
    console.error('Edge comprehensive seeding failed:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
