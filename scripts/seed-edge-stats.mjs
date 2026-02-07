/**
 * Seed Edge IQ stats (skater, goalie, team) from NHL Edge API.
 * Run: node scripts/seed-edge-stats.mjs
 */

import {
  supabase, fetchNHL, batchUpsert, startSync, completeSync, failSync,
  sleep, progress, nameDefault,
  SEASON, ALL_TEAMS
} from './seed-utils.mjs';

const EDGE_BASE = '/edge';

async function main() {
  console.log('=== Seeding Edge IQ Stats ===');
  const syncId = await startSync('edge_stats');

  try {
    // Phase 1: Get team IDs from our database
    const { data: teams } = await supabase.from('teams').select('id, abbrev');
    const teamMap = new Map((teams || []).map(t => [t.abbrev, t.id]));

    // Phase 2: Fetch Edge team stats
    console.log('  Phase 2: Fetching Edge team stats...');
    const edgeTeamStats = [];

    for (let i = 0; i < ALL_TEAMS.length; i++) {
      const abbrev = ALL_TEAMS[i];
      const teamId = teamMap.get(abbrev);
      if (!teamId) continue;

      try {
        const data = await fetchNHL(`${EDGE_BASE}/team-detail/${teamId}/now`);
        if (!data || !data.team) continue;

        edgeTeamStats.push({
          team_id: teamId,
          team_abbrev: abbrev,
          season: SEASON,
          top_shot_speed_mph: data.shotSpeed?.topShotSpeed?.imperial || null,
          top_shot_speed_rank: data.shotSpeed?.topShotSpeed?.rank || null,
          shot_attempts_over_90: data.shotSpeed?.shotAttemptsOver90?.value || null,
          shot_attempts_over_90_rank: data.shotSpeed?.shotAttemptsOver90?.rank || null,
          max_skating_speed_mph: data.skatingSpeed?.speedMax?.imperial || null,
          max_skating_speed_rank: data.skatingSpeed?.speedMax?.rank || null,
          bursts_over_22: data.skatingSpeed?.burstsOver22?.value || null,
          bursts_over_22_rank: data.skatingSpeed?.burstsOver22?.rank || null,
          total_distance_miles: data.distanceSkated?.total?.imperial || null,
          total_distance_rank: data.distanceSkated?.total?.rank || null,
          offensive_zone_pctg: data.zoneTimeDetails?.offensiveZonePctg || null,
          neutral_zone_pctg: data.zoneTimeDetails?.neutralZonePctg || null,
          defensive_zone_pctg: data.zoneTimeDetails?.defensiveZonePctg || null,
          offensive_zone_rank: data.zoneTimeDetails?.offensiveZoneRank || null,
          defensive_zone_rank: data.zoneTimeDetails?.defensiveZoneRank || null,
          shot_location_summary: data.sogSummary ? JSON.stringify(data.sogSummary) : null,
        });
      } catch (err) {
        // Non-fatal
      }
      progress(i + 1, ALL_TEAMS.length, 'team Edge stats');
    }

    const teamEdgeCount = await batchUpsert('edge_team_stats', edgeTeamStats, 'team_id,season');
    console.log(`  Upserted ${teamEdgeCount} team Edge stats`);

    // Phase 3: Fetch Edge skater stats for top players per team
    console.log('\n  Phase 3: Fetching Edge skater stats...');

    // Get player IDs from our database (top players)
    const { data: topSkaters } = await supabase
      .from('skater_season_stats')
      .select('player_id, team_abbrev')
      .eq('season', SEASON)
      .gte('games_played', 10)
      .order('points', { ascending: false })
      .limit(200);

    const skaterIds = (topSkaters || []).map(s => ({
      id: s.player_id,
      team: s.team_abbrev,
    }));
    console.log(`  Fetching Edge data for ${skaterIds.length} skaters...`);

    const edgeSkaterStats = [];
    for (let i = 0; i < skaterIds.length; i++) {
      const { id, team } = skaterIds[i];
      try {
        const data = await fetchNHL(`${EDGE_BASE}/skater-detail/${id}/now`);
        if (!data || !data.player) continue;

        const playerName = `${nameDefault(data.player.firstName)} ${nameDefault(data.player.lastName)}`;

        edgeSkaterStats.push({
          player_id: id,
          player_name: playerName,
          team_abbrev: data.player.team?.abbrev || team,
          season: SEASON,
          top_shot_speed_mph: data.topShotSpeed?.imperial || null,
          top_shot_speed_percentile: data.topShotSpeed?.percentile || null,
          top_shot_speed_rank: data.topShotSpeed?.rank || null,
          max_skating_speed_mph: data.skatingSpeed?.speedMax?.imperial || null,
          max_skating_speed_percentile: data.skatingSpeed?.speedMax?.percentile || null,
          max_skating_speed_rank: data.skatingSpeed?.speedMax?.rank || null,
          bursts_over_20: data.skatingSpeed?.burstsOver20?.value || null,
          bursts_over_20_percentile: data.skatingSpeed?.burstsOver20?.percentile || null,
          total_distance_miles: data.totalDistanceSkated?.imperial || null,
          total_distance_percentile: data.totalDistanceSkated?.percentile || null,
          total_distance_rank: data.totalDistanceSkated?.rank || null,
          offensive_zone_pctg: data.zoneTimeDetails?.offensiveZonePctg || null,
          neutral_zone_pctg: data.zoneTimeDetails?.neutralZonePctg || null,
          defensive_zone_pctg: data.zoneTimeDetails?.defensiveZonePctg || null,
          shot_location_summary: data.sogSummary ? JSON.stringify(data.sogSummary) : null,
        });
      } catch (err) {
        // Non-fatal — some players may not have Edge data
      }

      if ((i + 1) % 25 === 0 || i === skaterIds.length - 1) {
        progress(i + 1, skaterIds.length, `skater Edge stats`);
      }
    }

    const skaterEdgeCount = await batchUpsert('edge_skater_stats', edgeSkaterStats, 'player_id,season');
    console.log(`  Upserted ${skaterEdgeCount} skater Edge stats`);

    // Phase 4: Fetch Edge goalie stats
    console.log('\n  Phase 4: Fetching Edge goalie stats...');

    const { data: goalies } = await supabase
      .from('goalie_season_stats')
      .select('player_id, team_abbrev')
      .eq('season', SEASON)
      .gte('games_played', 5);

    const goalieIds = (goalies || []).map(g => ({
      id: g.player_id,
      team: g.team_abbrev,
    }));
    console.log(`  Fetching Edge data for ${goalieIds.length} goalies...`);

    const edgeGoalieStats = [];
    for (let i = 0; i < goalieIds.length; i++) {
      const { id, team } = goalieIds[i];
      try {
        const data = await fetchNHL(`${EDGE_BASE}/goalie-detail/${id}/now`);
        if (!data || !data.player) continue;

        const playerName = `${nameDefault(data.player.firstName)} ${nameDefault(data.player.lastName)}`;

        edgeGoalieStats.push({
          player_id: id,
          player_name: playerName,
          team_abbrev: data.player.team?.abbrev || team,
          season: SEASON,
          gaa: data.stats?.gaa?.value || null,
          gaa_percentile: data.stats?.gaa?.percentile || null,
          games_above_900: data.stats?.gamesAbove900?.value || null,
          games_above_900_percentile: data.stats?.gamesAbove900?.percentile || null,
          goal_diff_per_60: data.stats?.goalDiffPer60?.value || null,
          goal_diff_per_60_percentile: data.stats?.goalDiffPer60?.percentile || null,
          shot_location_summary: data.shotLocationSummary ? JSON.stringify(data.shotLocationSummary) : null,
          shot_location_details: data.shotLocationDetails ? JSON.stringify(data.shotLocationDetails) : null,
        });
      } catch (err) {
        // Non-fatal
      }

      if ((i + 1) % 10 === 0 || i === goalieIds.length - 1) {
        progress(i + 1, goalieIds.length, `goalie Edge stats`);
      }
    }

    const goalieEdgeCount = await batchUpsert('edge_goalie_stats', edgeGoalieStats, 'player_id,season');
    console.log(`  Upserted ${goalieEdgeCount} goalie Edge stats`);

    const totalRecords = teamEdgeCount + skaterEdgeCount + goalieEdgeCount;
    await completeSync(syncId, totalRecords);
    console.log('=== Edge IQ Stats seeding complete ===\n');
  } catch (err) {
    console.error('Edge stats seeding failed:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
