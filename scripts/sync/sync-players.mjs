/**
 * Sync NHL player stats to Supabase.
 *
 * Fetches each team's current roster stats from the NHL API
 * and upserts into `skater_season_stats` and `goalie_season_stats` tables.
 * Schema matches backend-engineer's comprehensive migration.
 *
 * Usage:
 *   node scripts/sync/sync-players.mjs
 */

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { ALL_TEAMS, getCurrentSeason, fetchWithRetry, sleep, endpoints, parseSeasonArg } from './nhl-api.mjs';

async function syncPlayerStats(seasonOverride) {
  const season = seasonOverride || getCurrentSeason();
  console.log(`[sync-players] Fetching player stats for season ${season}`);

  const skaterRows = [];
  const goalieRows = [];
  let teamsDone = 0;

  for (const team of ALL_TEAMS) {
    try {
      const data = await fetchWithRetry(endpoints.teamStats(team));
      const skaters = data.skaters ?? [];
      const goalies = data.goalies ?? [];

      for (const s of skaters) {
        skaterRows.push({
          player_id: s.playerId,
          season,
          team_abbrev: team,
          position: s.positionCode ?? null,
          games_played: s.gamesPlayed ?? 0,
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
          points: s.points ?? 0,
          plus_minus: s.plusMinus ?? 0,
          pim: s.penaltyMinutes ?? 0,
          power_play_goals: s.powerPlayGoals ?? 0,
          shorthanded_goals: s.shorthandedGoals ?? 0,
          game_winning_goals: s.gameWinningGoals ?? 0,
          overtime_goals: s.overtimeGoals ?? 0,
          shots: s.shots ?? 0,
          shooting_pctg: s.shootingPctg ?? null,
          avg_toi_per_game: s.avgTimeOnIce ?? null,
          faceoff_win_pctg: s.faceoffWinPctg ?? null,
        });
      }

      for (const g of goalies) {
        goalieRows.push({
          player_id: g.playerId,
          season,
          team_abbrev: team,
          games_played: g.gamesPlayed ?? 0,
          games_started: g.gamesStarted ?? 0,
          wins: g.wins ?? 0,
          losses: g.losses ?? 0,
          ot_losses: g.otLosses ?? 0,
          goals_against_avg: g.goalsAgainstAverage ?? null,
          save_pctg: g.savePctg ?? null,
          shots_against: g.shotsAgainst ?? 0,
          saves: g.saves ?? 0,
          goals_against: g.goalsAgainst ?? 0,
          shutouts: g.shutouts ?? 0,
          goals: g.goals ?? 0,
          assists: g.assists ?? 0,
          pim: g.penaltyMinutes ?? 0,
        });
      }
    } catch (err) {
      console.warn(`  [sync-players] Failed to fetch ${team}: ${err.message}`);
    }

    teamsDone++;
    if (teamsDone % 8 === 0) {
      console.log(`  Fetched ${teamsDone}/${ALL_TEAMS.length} teams (${skaterRows.length} skaters, ${goalieRows.length} goalies)`);
    }
    await sleep(100);
  }

  let errors = 0;

  // Upsert skaters
  if (skaterRows.length > 0) {
    const batchSize = 200;
    let upserted = 0;
    for (let i = 0; i < skaterRows.length; i += batchSize) {
      const batch = skaterRows.slice(i, i + batchSize);
      const { error } = await supabase
        .from('skater_season_stats')
        .upsert(batch, { onConflict: 'player_id,season,team_abbrev' });
      if (error) {
        if (error.message.includes('does not exist')) {
          console.warn('  [sync-players] `skater_season_stats` table not yet created — run migrations first');
          break;
        }
        console.error(`  [sync-players] skater batch error at ${i}: ${error.message}`);
        errors++;
      } else {
        upserted += batch.length;
      }
    }
    console.log(`  skater_season_stats: ${upserted} upserted`);
  }

  // Upsert goalies
  if (goalieRows.length > 0) {
    const { error } = await supabase
      .from('goalie_season_stats')
      .upsert(goalieRows, { onConflict: 'player_id,season,team_abbrev' });
    if (error) {
      if (error.message.includes('does not exist')) {
        console.warn('  [sync-players] `goalie_season_stats` table not yet created — run migrations first');
      } else {
        console.error(`  [sync-players] goalie upsert error: ${error.message}`);
        errors++;
      }
    } else {
      console.log(`  goalie_season_stats: ${goalieRows.length} upserted`);
    }
  }

  // Log to sync_log
  try {
    await supabase.from('sync_log').insert({
      sync_type: 'player_stats',
      status: errors > 0 ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      records_processed: skaterRows.length + goalieRows.length,
      error_message: errors > 0 ? `${errors} batch errors` : null,
    });
  } catch { /* sync_log may not exist yet */ }

  console.log(`[sync-players] Done: ${skaterRows.length} skaters, ${goalieRows.length} goalies, ${errors} errors`);
  return { upserted: skaterRows.length + goalieRows.length, errors };
}

// Main
const { season: parsedSeason } = parseSeasonArg();
const hasSeasonFlag = process.argv.includes('--season') || process.argv.find(a => a.startsWith('--season='));
const seasonOverride = hasSeasonFlag ? parsedSeason : null;

logConnectionInfo();
if (seasonOverride) {
  console.log(`[sync-players] Using season override: ${seasonOverride}`);
}

try {
  const result = await syncPlayerStats(seasonOverride);
  if (result.errors > 0) process.exit(1);
} catch (err) {
  console.error('[sync-players] Fatal error:', err);
  process.exit(1);
}
