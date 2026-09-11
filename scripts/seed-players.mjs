/**
 * Recovery entrypoint for exact-period player stats and landing-page biographies.
 * Historical club membership is stored only on season-stat rows; current player
 * membership always comes from the player's current landing response.
 *
 * Run: node scripts/seed-players.mjs [--season 20252026]
 */

import { pathToFileURL } from 'node:url';

import {
  supabase,
  fetchNHL,
  startSync,
  completeSync,
  progress,
  SEASON,
  ALL_TEAMS,
} from './seed-utils.mjs';
import {
  clubTeamsForSeason,
  normalizeClubStats,
  normalizePlayerBiography,
  upsertBatches,
} from './sync/ingestion-contracts.mjs';

export async function seedPlayers(syncType = 'players') {
  console.log(`=== Seeding Players & Stats for ${SEASON} ===`);
  const syncId = await startSync(syncType);
  let confirmedUpserted = 0;

  try {
    const teams = clubTeamsForSeason(SEASON, ALL_TEAMS);
    const skaterRows = [];
    const goalieRows = [];
    const playerIds = new Set();
    const failedTeams = [];

    for (let index = 0; index < teams.length; index++) {
      const team = teams[index];
      try {
        const payload = await fetchNHL(`/club-stats/${team}/${SEASON}/2`);
        const normalized = normalizeClubStats(payload, team, SEASON);
        skaterRows.push(...normalized.skaters);
        goalieRows.push(...normalized.goalies);
        for (const row of [...normalized.skaters, ...normalized.goalies]) playerIds.add(row.player_id);
      } catch (error) {
        failedTeams.push(`${team}: ${error.message}`);
      }
      progress(index + 1, teams.length, `club snapshots (${playerIds.size} players)`);
    }

    if (failedTeams.length > 0) {
      throw new Error(`${failedTeams.length} club snapshots failed; no player data published (${failedTeams.join('; ')})`);
    }
    if (playerIds.size === 0) throw new Error('Club snapshots contained no players; no player data published');

    const players = [];
    const failedBios = [];
    const ids = [...playerIds];
    for (let index = 0; index < ids.length; index++) {
      const playerId = ids[index];
      try {
        const payload = await fetchNHL(`/player/${playerId}/landing`);
        players.push(normalizePlayerBiography(payload, playerId));
      } catch (error) {
        failedBios.push(`${playerId}: ${error.message}`);
      }
      if ((index + 1) % 25 === 0 || index === ids.length - 1) {
        progress(index + 1, ids.length, 'player biographies');
      }
    }

    if (failedBios.length > 0) {
      throw new Error(`${failedBios.length} player biographies failed; no player data published (${failedBios.join('; ')})`);
    }

    const publish = async (table, rows, conflictColumns) => {
      try {
        const count = await upsertBatches(supabase, table, rows, conflictColumns);
        confirmedUpserted += count;
      } catch (error) {
        confirmedUpserted += error.rowsUpserted ?? 0;
        throw error;
      }
    };
    await publish('players', players, 'id');
    await publish('skater_season_stats', skaterRows, 'player_id,season,team_abbrev');
    await publish('goalie_season_stats', goalieRows, 'player_id,season,team_abbrev');

    await completeSync(syncId, confirmedUpserted);
    console.log(`=== Player seeding complete: ${confirmedUpserted} rows ===`);
    return { upserted: confirmedUpserted, errors: 0 };
  } catch (error) {
    const { error: logError } = await supabase.from('sync_log').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      records_processed: confirmedUpserted,
      error_message: error.message,
      metadata: { season: SEASON, game_type: 2 },
    }).eq('id', syncId);
    if (logError) console.error(`Player sync failure log also failed: ${logError.message}`);
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedPlayers().catch(error => {
    console.error('Player seeding failed:', error.message);
    process.exitCode = 1;
  });
}
