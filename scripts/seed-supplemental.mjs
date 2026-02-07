/**
 * Seed supplemental NHL data that doesn't fit the main tables:
 * - Draft picks (current + recent years)
 * - Stat leaders (skater + goalie)
 * - Full rosters for all teams
 * - Season/schedule metadata
 * - Player spotlight
 * - Playoff bracket (if applicable)
 *
 * Run: node scripts/seed-supplemental.mjs
 */

import {
  supabase, fetchNHL, batchUpsert, startSync, completeSync, failSync,
  sleep, progress, SEASON, SEASON_STR, ALL_TEAMS
} from './seed-utils.mjs';

// ============================================
// Phase 1: Draft picks
// ============================================

async function seedDraftPicks() {
  console.log('\n  Phase 1: Draft picks...');
  const rows = [];

  // Fetch current year and a few recent years
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  for (const year of years) {
    try {
      const data = await fetchNHL(`/draft/picks/${year}/all`);
      if (data) {
        rows.push({
          data_type: 'draft_picks',
          data_key: `${year}`,
          season: null,
          data,
          fetched_at: new Date().toISOString(),
        });
        console.log(`    Draft ${year}: fetched`);
      }
    } catch (err) {
      console.log(`    Draft ${year}: not available (${err.message})`);
    }
    await sleep(200);
  }

  // Also fetch draft rankings/prospects for current year
  try {
    const rankings = await fetchNHL(`/draft/rankings/now`);
    if (rankings) {
      rows.push({
        data_type: 'draft_rankings',
        data_key: `${currentYear}`,
        season: null,
        data: rankings,
        fetched_at: new Date().toISOString(),
      });
      console.log(`    Draft rankings: fetched`);
    }
  } catch (err) {
    console.log(`    Draft rankings: not available`);
  }

  if (rows.length > 0) {
    const count = await batchUpsert('supplemental_data', rows, 'data_type,data_key,season');
    console.log(`  Draft data: ${count} records`);
    return count;
  }
  return 0;
}

// ============================================
// Phase 2: Stat leaders
// ============================================

async function seedStatLeaders() {
  console.log('\n  Phase 2: Stat leaders...');
  const rows = [];

  // Skater stat leader categories
  const skaterCategories = [
    'goals', 'assists', 'points', 'plusMinus', 'penaltyMins',
    'powerPlayGoals', 'gameWinningGoals', 'shots', 'shootingPctg',
    'faceoffWinPctg', 'avgTimeOnIcePerGame',
  ];

  for (const cat of skaterCategories) {
    try {
      const data = await fetchNHL(`/skater-stats-leaders/current?categories=${cat}&limit=50`);
      if (data) {
        rows.push({
          data_type: 'skater_leaders',
          data_key: cat,
          season: SEASON,
          data,
          fetched_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Non-fatal
    }
    await sleep(150);
  }

  console.log(`    Skater leaders: ${rows.length} categories`);

  // Goalie stat leader categories
  const goalieCategories = [
    'wins', 'goalsAgainstAverage', 'savePctg', 'shutouts',
  ];

  const goalieStart = rows.length;
  for (const cat of goalieCategories) {
    try {
      const data = await fetchNHL(`/goalie-stats-leaders/current?categories=${cat}&limit=50`);
      if (data) {
        rows.push({
          data_type: 'goalie_leaders',
          data_key: cat,
          season: SEASON,
          data,
          fetched_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Non-fatal
    }
    await sleep(150);
  }

  console.log(`    Goalie leaders: ${rows.length - goalieStart} categories`);

  if (rows.length > 0) {
    const count = await batchUpsert('supplemental_data', rows, 'data_type,data_key,season');
    console.log(`  Stat leaders: ${count} records`);
    return count;
  }
  return 0;
}

// ============================================
// Phase 3: Full rosters
// ============================================

async function seedRosters() {
  console.log('\n  Phase 3: Full rosters...');
  const rows = [];

  for (let i = 0; i < ALL_TEAMS.length; i++) {
    const team = ALL_TEAMS[i];
    try {
      const data = await fetchNHL(`/roster/${team}/current`);
      if (data) {
        rows.push({
          data_type: 'roster',
          data_key: team,
          season: SEASON,
          data,
          fetched_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Try alternate endpoint format
      try {
        const data = await fetchNHL(`/roster/${team}/${SEASON_STR}`);
        if (data) {
          rows.push({
            data_type: 'roster',
            data_key: team,
            season: SEASON,
            data,
            fetched_at: new Date().toISOString(),
          });
        }
      } catch {
        // Non-fatal
      }
    }
    await sleep(100);
    progress(i + 1, ALL_TEAMS.length, 'team rosters');
  }

  if (rows.length > 0) {
    const count = await batchUpsert('supplemental_data', rows, 'data_type,data_key,season');
    console.log(`  Rosters: ${count} records`);
    return count;
  }
  return 0;
}

// ============================================
// Phase 3b: Prospects per team
// ============================================

async function seedProspects() {
  console.log('\n  Phase 3b: Prospects per team...');
  const rows = [];

  for (let i = 0; i < ALL_TEAMS.length; i++) {
    const team = ALL_TEAMS[i];
    try {
      const data = await fetchNHL(`/prospects/${team}`);
      if (data) {
        rows.push({
          data_type: 'prospects',
          data_key: team,
          season: SEASON,
          data,
          fetched_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Non-fatal — some teams may not have prospects data
    }
    await sleep(100);
    progress(i + 1, ALL_TEAMS.length, 'team prospects');
  }

  if (rows.length > 0) {
    const count = await batchUpsert('supplemental_data', rows, 'data_type,data_key,season');
    console.log(`  Prospects: ${count} records`);
    return count;
  }
  return 0;
}

// ============================================
// Phase 4: Schedule & season meta
// ============================================

async function seedScheduleMeta() {
  console.log('\n  Phase 4: Schedule & season meta...');
  const rows = [];

  // Season info
  try {
    const data = await fetchNHL('/season');
    if (data) {
      rows.push({
        data_type: 'season_info',
        data_key: 'current',
        season: SEASON,
        data,
        fetched_at: new Date().toISOString(),
      });
      console.log('    Season info: fetched');
    }
  } catch (err) {
    console.log('    Season info: not available');
  }
  await sleep(200);

  // Standings-season (historical standings dates)
  try {
    const data = await fetchNHL('/standings-season');
    if (data) {
      rows.push({
        data_type: 'standings_season',
        data_key: 'current',
        season: SEASON,
        data,
        fetched_at: new Date().toISOString(),
      });
      console.log('    Standings season: fetched');
    }
  } catch (err) {
    console.log('    Standings season: not available');
  }
  await sleep(200);

  // Schedule calendar
  try {
    const data = await fetchNHL(`/schedule-calendar/${SEASON_STR}`);
    if (data) {
      rows.push({
        data_type: 'schedule_calendar',
        data_key: SEASON_STR,
        season: SEASON,
        data,
        fetched_at: new Date().toISOString(),
      });
      console.log('    Schedule calendar: fetched');
    }
  } catch (err) {
    console.log('    Schedule calendar: not available');
  }
  await sleep(200);

  // Player spotlight
  try {
    const data = await fetchNHL('/player-spotlight');
    if (data) {
      rows.push({
        data_type: 'player_spotlight',
        data_key: 'current',
        season: SEASON,
        data,
        fetched_at: new Date().toISOString(),
      });
      console.log('    Player spotlight: fetched');
    }
  } catch (err) {
    console.log('    Player spotlight: not available');
  }
  await sleep(200);

  // Playoff bracket (may not exist during regular season)
  const currentYear = new Date().getFullYear();
  try {
    const data = await fetchNHL(`/playoff-bracket/${currentYear}`);
    if (data) {
      rows.push({
        data_type: 'playoff_bracket',
        data_key: `${currentYear}`,
        season: SEASON,
        data,
        fetched_at: new Date().toISOString(),
      });
      console.log('    Playoff bracket: fetched');
    }
  } catch (err) {
    console.log('    Playoff bracket: not available (likely mid-season)');
  }
  await sleep(200);

  // Where-to-watch / broadcast info
  try {
    const data = await fetchNHL('/where-to-watch');
    if (data) {
      rows.push({
        data_type: 'where_to_watch',
        data_key: 'current',
        season: SEASON,
        data,
        fetched_at: new Date().toISOString(),
      });
      console.log('    Where to watch: fetched');
    }
  } catch (err) {
    console.log('    Where to watch: not available');
  }

  // Network info
  try {
    const data = await fetchNHL('/network');
    if (data) {
      rows.push({
        data_type: 'network',
        data_key: 'current',
        season: SEASON,
        data,
        fetched_at: new Date().toISOString(),
      });
      console.log('    Network: fetched');
    }
  } catch (err) {
    console.log('    Network: not available');
  }

  // Meta endpoint
  try {
    const data = await fetchNHL('/meta');
    if (data) {
      rows.push({
        data_type: 'api_meta',
        data_key: 'current',
        season: null,
        data,
        fetched_at: new Date().toISOString(),
      });
      console.log('    API meta: fetched');
    }
  } catch (err) {
    console.log('    API meta: not available');
  }

  if (rows.length > 0) {
    const count = await batchUpsert('supplemental_data', rows, 'data_type,data_key,season');
    console.log(`  Schedule & meta: ${count} records`);
    return count;
  }
  return 0;
}

// ============================================
// Phase 5: Player game logs (current season)
// ============================================

async function seedPlayerGameLogs() {
  console.log('\n  Phase 5: Player game logs...');

  // Get all active players
  const { data: players } = await supabase
    .from('players')
    .select('id')
    .eq('is_active', true);

  if (!players || players.length === 0) {
    console.log('    No players found. Skipping.');
    return 0;
  }

  console.log(`    Fetching game logs for ${players.length} players...`);
  const rows = [];
  let fetched = 0;

  for (let i = 0; i < players.length; i++) {
    const playerId = players[i].id;
    try {
      const data = await fetchNHL(`/player/${playerId}/game-log/${SEASON_STR}/2`);
      if (data && data.gameLog && data.gameLog.length > 0) {
        rows.push({
          data_type: 'player_game_log',
          data_key: `${playerId}`,
          season: SEASON,
          data,
          fetched_at: new Date().toISOString(),
        });
        fetched++;
      }
    } catch (err) {
      // Non-fatal
    }

    if ((i + 1) % 50 === 0 || i === players.length - 1) {
      progress(i + 1, players.length, `player game logs (${fetched} fetched)`);
    }

    // Batch upsert periodically
    if (rows.length >= 100) {
      await batchUpsert('supplemental_data', rows, 'data_type,data_key,season');
      rows.length = 0;
    }
  }

  // Flush remaining
  if (rows.length > 0) {
    await batchUpsert('supplemental_data', rows, 'data_type,data_key,season');
  }

  console.log(`  Player game logs: ${fetched} records`);
  return fetched;
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('=== Seeding Supplemental NHL Data ===');
  const syncId = await startSync('supplemental');
  const startTime = Date.now();

  try {
    let total = 0;
    total += await seedDraftPicks();
    total += await seedStatLeaders();
    total += await seedRosters();
    total += await seedProspects();
    total += await seedScheduleMeta();
    total += await seedPlayerGameLogs();

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    await completeSync(syncId, total);
    console.log(`\n=== Supplemental seeding complete: ${total} records in ${elapsed}s ===\n`);
  } catch (err) {
    console.error('Supplemental seeding FAILED:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
