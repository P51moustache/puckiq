/**
 * Sync NHL standings data to Supabase.
 *
 * Fetches current standings from the NHL API and upserts into the `standings` table.
 * Schema matches backend-engineer's comprehensive migration (INTEGER season, snapshot_date, team_id).
 *
 * Usage:
 *   node scripts/sync/sync-standings.mjs
 */

import { pathToFileURL } from 'node:url';
import { supabase, logConnectionInfo } from './supabase-client.mjs';
import { getCurrentSeason, formatDate, fetchWithRetry, endpoints, parseSeasonArg, ALL_TEAMS } from './nhl-api.mjs';

import { validateStandingsSnapshot, standingsRequestDate } from './standings-contract.mjs';
import { clubTeamsForSeason } from './ingestion-contracts.mjs';

export async function syncStandings(seasonOverride, { client = supabase, fetcher = fetchWithRetry } = {}) {
  const startedAt = new Date().toISOString();
  const season = seasonOverride || getCurrentSeason();
  let upserted = 0;
  try {
    const today = formatDate(new Date());
    console.log(`[sync-standings] Fetching current standings for season ${season}, snapshot ${today}`);

    // NHL standings have their own start/end dates; dates outside that range return no rows.
    const catalog = await fetcher(endpoints.standingsSeasons());
    const requestDate = standingsRequestDate(catalog, season, today);
    const data = await fetcher(endpoints.standings(requestDate));
    const standings = data.standings ?? [];

    if (standings.length === 0) {
      throw new Error('No standings data returned; snapshot was not verified.');
    }
    const sourceDate = validateStandingsSnapshot(standings, season, clubTeamsForSeason(season, ALL_TEAMS));

    // Look up team_id from teams table using team abbreviation
    const { data: teamsData, error: teamsErr } = await client
      .from('teams')
      .select('id, abbrev');
    if (teamsErr) {
      throw new Error(`Team lookup failed: ${teamsErr.message}`);
    }
    const teamIdMap = new Map(teamsData.map(t => [t.abbrev, t.id]));

    const rows = standings.map(team => {
      const abbrev = team.teamAbbrev?.default ?? team.teamAbbrev;
      const teamId = teamIdMap.get(abbrev);
      if (!teamId) {
        throw new Error(`Missing team_id for ${abbrev}; standings snapshot was not written`);
      }
      return { team_id: teamId, team_abbrev: abbrev,
      season,
      snapshot_date: sourceDate,

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
      throw new Error('No standings rows to publish');
    }

    // Upsert by (team_abbrev, season, snapshot_date)
    const { error } = await client
      .from('standings')
      .upsert(rows, { onConflict: 'team_abbrev,season,snapshot_date' });

    if (error) throw new Error(`Standings upsert failed: ${error.message}`);
    upserted = rows.length;

    // Log to sync_log
    const {error:logError} = await client.from('sync_log').insert({
        sync_type: 'standings',
        started_at: startedAt,
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_processed: rows.length,
        metadata: { season, game_type: 2, snapshot_date: sourceDate },
    });
    if (logError) throw new Error(`Standings wrote successfully but its sync log failed: ${logError.message}`);

    console.log(`[sync-standings] Done: ${rows.length} teams upserted for source snapshot ${sourceDate}`);
    return { upserted: rows.length, errors: 0 };
  } catch (error) {
    const { error: logError } = await client.from('sync_log').insert({
      sync_type: 'standings', started_at: startedAt,
      status: 'failed', completed_at: new Date().toISOString(),
      records_processed: upserted, error_message: error.message,
      metadata: { season, game_type: 2 },
    });
    if (logError) throw new Error(`${error.message}; failed to record failure: ${logError.message}`);
    throw error;
  }
}

// Importable for tests without running a writer.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const { season: parsedSeason } = parseSeasonArg();
const hasSeasonFlag = process.argv.includes('--season') || process.argv.find(a => a.startsWith('--season='));
const seasonOverride = hasSeasonFlag ? parsedSeason : null;

logConnectionInfo();
if (seasonOverride) {
  console.log(`[sync-standings] Using season override: ${seasonOverride}`);
}

try {
  const result = await syncStandings(seasonOverride);
  if (result.errors > 0) process.exit(1);
} catch (err) {
  console.error('[sync-standings] Fatal error:', err);
  process.exit(1);
}

}
