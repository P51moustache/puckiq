/**
 * Seed standings table from NHL standings API.
 * Run: node scripts/seed-standings.mjs
 */

import {
  supabase, fetchNHL, batchUpsert, startSync, completeSync, failSync,
  SEASON
} from './seed-utils.mjs';

async function main() {
  console.log('=== Seeding Standings ===');
  const syncId = await startSync('standings');

  try {
    const data = await fetchNHL('/standings/now');
    const standings = data.standings || [];

    if (standings.length === 0) {
      throw new Error('No standings data returned');
    }

    const today = new Date().toISOString().split('T')[0];

    const rows = standings.map(t => ({
      team_id: t.teamId || 0,
      team_abbrev: t.teamAbbrev?.default || t.teamAbbrev,
      season: SEASON,
      snapshot_date: today,

      games_played: t.gamesPlayed || 0,
      wins: t.wins || 0,
      losses: t.losses || 0,
      ot_losses: t.otLosses || 0,
      points: t.points || 0,
      point_pctg: t.pointPctg || null,
      regulation_wins: t.regulationWins || 0,
      regulation_plus_ot_wins: t.regulationPlusOtWins || 0,

      goals_for: t.goalFor || 0,
      goals_against: t.goalAgainst || 0,
      goal_differential: t.goalDifferential || 0,
      goals_for_pctg: t.goalsForPctg || null,

      streak_code: t.streakCode || null,
      streak_count: t.streakCount || 0,

      home_wins: t.homeWins || 0,
      home_losses: t.homeLosses || 0,
      home_ot_losses: t.homeOtLosses || 0,
      home_goals_for: t.homeGoalsFor || 0,
      home_goals_against: t.homeGoalsAgainst || 0,
      road_wins: t.roadWins || 0,
      road_losses: t.roadLosses || 0,
      road_ot_losses: t.roadOtLosses || 0,
      road_goals_for: t.roadGoalsFor || 0,
      road_goals_against: t.roadGoalsAgainst || 0,

      l10_wins: t.l10Wins || 0,
      l10_losses: t.l10Losses || 0,
      l10_ot_losses: t.l10OtLosses || 0,
      l10_points: t.l10Points || 0,
      l10_goal_differential: t.l10GoalDifferential || 0,

      shootout_wins: t.shootoutWins || 0,
      shootout_losses: t.shootoutLosses || 0,

      conference: t.conferenceName || null,
      conference_sequence: t.conferenceSequence || null,
      division: t.divisionName || null,
      division_sequence: t.divisionSequence || null,
      league_sequence: t.leagueSequence || null,
      wildcard_sequence: null,
    }));

    // We need the team_id. The standings API doesn't directly return it,
    // but we can look it up from our teams table.
    const { data: teams } = await supabase.from('teams').select('id, abbrev');
    const teamIdMap = new Map((teams || []).map(t => [t.abbrev, t.id]));

    for (const row of rows) {
      if (!row.team_id) {
        row.team_id = teamIdMap.get(row.team_abbrev) || 0;
      }
    }

    // Filter out rows without a valid team_id (foreign key constraint)
    const validRows = rows.filter(r => r.team_id > 0);

    const count = await batchUpsert('standings', validRows, 'team_abbrev,season,snapshot_date');
    console.log(`  Upserted ${count} standings entries for ${today}`);

    await completeSync(syncId, count);
    console.log('=== Standings seeding complete ===\n');
  } catch (err) {
    console.error('Standings seeding failed:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
