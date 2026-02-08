/**
 * Sync NHL standings data to Supabase.
 *
 * Fetches current standings from the NHL API and upserts into the `standings` table.
 * Schema matches backend-engineer's comprehensive migration (INTEGER season, snapshot_date, team_id).
 *
 * Usage:
 *   node scripts/sync/sync-standings.mjs
 */

import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { getCurrentSeason, formatDate, fetchWithRetry, endpoints } from './nhl-api.mjs';

async function syncStandings() {
  const season = getCurrentSeason();
  const today = formatDate(new Date());
  console.log(`[sync-standings] Fetching current standings for season ${season}, snapshot ${today}`);

  const data = await fetchWithRetry(endpoints.standings());
  const standings = data.standings ?? [];

  if (standings.length === 0) {
    console.warn('[sync-standings] No standings data returned');
    return { upserted: 0, errors: 0 };
  }

  // Look up team_id from teams table using team abbreviation
  const { data: teamsData, error: teamsErr } = await supabase
    .from('teams')
    .select('id, abbrev');
  if (teamsErr) {
    console.error('[sync-standings] Failed to fetch teams for ID lookup:', teamsErr.message);
    return { upserted: 0, errors: 1 };
  }
  const teamIdMap = new Map(teamsData.map(t => [t.abbrev, t.id]));

  const rows = standings.map(team => {
    const abbrev = team.teamAbbrev?.default ?? team.teamAbbrev;
    const teamId = teamIdMap.get(abbrev);
    if (!teamId) {
      console.warn(`[sync-standings] No team_id found for ${abbrev}, skipping`);
    }
    return { team_id: teamId, team_abbrev: abbrev,
    season,
    snapshot_date: today,

    // Record
    games_played: team.gamesPlayed ?? 0,
    wins: team.wins ?? 0,
    losses: team.losses ?? 0,
    ot_losses: team.otLosses ?? 0,
    points: team.points ?? 0,
    point_pctg: team.pointPctg ?? 0,
    regulation_wins: team.regulationWins ?? 0,
    regulation_plus_ot_wins: team.regulationPlusOtWins ?? 0,

    // Goals
    goals_for: team.goalFor ?? 0,
    goals_against: team.goalAgainst ?? 0,
    goal_differential: team.goalDifferential ?? 0,
    goals_for_pctg: team.goalsForPctg ?? null,

    // Streaks
    streak_code: team.streakCode ?? null,
    streak_count: team.streakCount ?? 0,

    // Home/Road splits
    home_wins: team.homeWins ?? 0,
    home_losses: team.homeLosses ?? 0,
    home_ot_losses: team.homeOtLosses ?? 0,
    home_goals_for: team.homeGoalsFor ?? 0,
    home_goals_against: team.homeGoalsAgainst ?? 0,
    road_wins: team.roadWins ?? 0,
    road_losses: team.roadLosses ?? 0,
    road_ot_losses: team.roadOtLosses ?? 0,
    road_goals_for: team.roadGoalsFor ?? 0,
    road_goals_against: team.roadGoalsAgainst ?? 0,

    // Last 10
    l10_wins: team.l10Wins ?? 0,
    l10_losses: team.l10Losses ?? 0,
    l10_ot_losses: team.l10OtLosses ?? 0,
    l10_points: team.l10Points ?? 0,
    l10_goal_differential: team.l10GoalDifferential ?? 0,

    // Shootout
    shootout_wins: team.shootoutWins ?? 0,
    shootout_losses: team.shootoutLosses ?? 0,

    // Rankings
    conference: team.conferenceName ?? null,
    conference_sequence: team.conferenceSequence ?? null,
    division: team.divisionName ?? null,
    division_sequence: team.divisionSequence ?? null,
    league_sequence: team.leagueSequence ?? null,
    wildcard_sequence: team.wildcardSequence ?? null,
  }; }).filter(row => row.team_id != null);

  if (rows.length === 0) {
    console.error('[sync-standings] No rows after team_id lookup — check teams table');
    return { upserted: 0, errors: 1 };
  }

  // Upsert by (team_abbrev, season, snapshot_date)
  const { error } = await supabase
    .from('standings')
    .upsert(rows, { onConflict: 'team_abbrev,season,snapshot_date' });

  if (error) {
    // Table might not exist yet
    if (error.message.includes('relation "standings" does not exist')) {
      console.warn('[sync-standings] `standings` table not yet created — run migrations first');
      return { upserted: 0, errors: 0 };
    }
    console.error(`[sync-standings] Upsert error: ${error.message}`);
    return { upserted: 0, errors: 1 };
  }

  // Log to sync_log
  try {
    await supabase.from('sync_log').insert({
      sync_type: 'standings',
      status: 'completed',
      completed_at: new Date().toISOString(),
      records_processed: rows.length,
    });
  } catch { /* sync_log may not exist yet */ }

  console.log(`[sync-standings] Done: ${rows.length} teams upserted for ${today}`);
  return { upserted: rows.length, errors: 0 };
}

// Main
logConnectionInfo();

try {
  const result = await syncStandings();
  if (result.errors > 0) process.exit(1);
} catch (err) {
  console.error('[sync-standings] Fatal error:', err);
  process.exit(1);
}
