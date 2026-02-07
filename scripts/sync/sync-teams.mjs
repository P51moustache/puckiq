/**
 * Sync NHL teams reference data to Supabase.
 *
 * Fetches team roster endpoint to populate the `teams` table
 * and the `players` table with current roster info.
 * Schema matches backend-engineer's comprehensive migration.
 *
 * Usage:
 *   node scripts/sync/sync-teams.mjs
 */

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { ALL_TEAMS, fetchWithRetry, sleep, endpoints } from './nhl-api.mjs';

async function syncTeams() {
  console.log(`[sync-teams] Fetching team rosters and player data`);

  const playerRows = [];
  let teamsDone = 0;

  for (const team of ALL_TEAMS) {
    try {
      const data = await fetchWithRetry(endpoints.roster(team));

      // Process all position groups
      const positions = ['forwards', 'defensemen', 'goalies'];
      for (const pos of positions) {
        const players = data[pos] ?? [];
        for (const p of players) {
          playerRows.push({
            id: p.id,
            first_name: p.firstName?.default ?? p.firstName ?? '',
            last_name: p.lastName?.default ?? p.lastName ?? '',
            position: p.positionCode ?? null,
            shoots_catches: p.shootsCatches ?? null,
            height_inches: p.heightInInches ?? null,
            weight_pounds: p.weightInPounds ?? null,
            birth_date: p.birthDate ?? null,
            birth_city: p.birthCity?.default ?? null,
            birth_country: p.birthCountry ?? null,
            current_team_abbrev: team,
            sweater_number: p.sweaterNumber ?? null,
            is_active: true,
            headshot_url: p.headshot ?? null,
          });
        }
      }
    } catch (err) {
      console.warn(`  [sync-teams] Failed to fetch roster for ${team}: ${err.message}`);
    }

    teamsDone++;
    if (teamsDone % 8 === 0) {
      console.log(`  Fetched ${teamsDone}/${ALL_TEAMS.length} teams (${playerRows.length} players)`);
    }
    await sleep(100);
  }

  let errors = 0;

  // Upsert players
  if (playerRows.length > 0) {
    const batchSize = 200;
    let upserted = 0;
    for (let i = 0; i < playerRows.length; i += batchSize) {
      const batch = playerRows.slice(i, i + batchSize);
      const { error } = await supabase
        .from('players')
        .upsert(batch, { onConflict: 'id' });
      if (error) {
        if (error.message.includes('does not exist')) {
          console.warn('  [sync-teams] `players` table not yet created — run migrations first');
          break;
        }
        console.error(`  [sync-teams] players batch error at ${i}: ${error.message}`);
        errors++;
      } else {
        upserted += batch.length;
      }
    }
    console.log(`  players: ${upserted} upserted`);
  }

  // Log to sync_log
  try {
    await supabase.from('sync_log').insert({
      sync_type: 'teams_players',
      status: errors > 0 ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      records_processed: playerRows.length,
      error_message: errors > 0 ? `${errors} batch errors` : null,
    });
  } catch { /* sync_log may not exist yet */ }

  console.log(`[sync-teams] Done: ${playerRows.length} players across ${ALL_TEAMS.length} teams, ${errors} errors`);
  return { upserted: playerRows.length, errors };
}

// Main
logConnectionInfo();

try {
  const result = await syncTeams();
  if (result.errors > 0) process.exit(1);
} catch (err) {
  console.error('[sync-teams] Fatal error:', err);
  process.exit(1);
}
