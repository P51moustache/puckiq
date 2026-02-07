/**
 * Populate the players table from data we already have in the database.
 * Extracts player IDs and names from game_goals, game_three_stars,
 * game_skater_stats, and game_goalie_stats — no NHL API calls needed.
 *
 * Then does a single pass to fill in missing season stats from club-stats.
 *
 * Run: node scripts/seed-players-from-db.mjs
 */

import {
  supabase, fetchNHL, batchUpsert, startSync, completeSync, failSync,
  sleep, progress, nameDefault,
  SEASON, ALL_TEAMS
} from './seed-utils.mjs';

async function main() {
  console.log('=== Populating Players from Existing DB Data ===');
  const syncId = await startSync('players_from_db');

  try {
    // Phase 1: Extract player info from game_goals
    console.log('  Phase 1: Extracting players from existing data...');

    const playerMap = new Map(); // playerId -> { id, first_name, last_name, team_abbrev }

    // From game_goals (has scorer name and assists)
    const { data: goals } = await supabase
      .from('game_goals')
      .select('scorer_player_id, scorer_name, team_abbrev, assist1_player_id, assist1_name, assist2_player_id, assist2_name')
      .not('scorer_player_id', 'is', null)
      .limit(10000);

    for (const g of (goals || [])) {
      if (g.scorer_player_id && g.scorer_name) {
        const parts = g.scorer_name.split(' ');
        const firstName = parts[0]?.replace('.', '') || '';
        const lastName = parts.slice(1).join(' ') || g.scorer_name;
        playerMap.set(g.scorer_player_id, {
          id: g.scorer_player_id,
          first_name: firstName.length <= 2 ? firstName : firstName, // Keep initials
          last_name: lastName,
          current_team_abbrev: g.team_abbrev,
          is_active: true,
        });
      }
    }

    console.log(`  Found ${playerMap.size} unique players from goals`);

    // From game_three_stars
    const { data: stars } = await supabase
      .from('game_three_stars')
      .select('player_id, player_name, team_abbrev, position')
      .not('player_id', 'is', null)
      .limit(10000);

    for (const s of (stars || [])) {
      if (s.player_id && s.player_name) {
        const parts = s.player_name.split(' ');
        const firstName = parts[0]?.replace('.', '') || '';
        const lastName = parts.slice(1).join(' ') || s.player_name;
        const existing = playerMap.get(s.player_id);
        playerMap.set(s.player_id, {
          id: s.player_id,
          first_name: existing?.first_name || firstName,
          last_name: existing?.last_name || lastName,
          position: s.position || existing?.position || null,
          current_team_abbrev: s.team_abbrev || existing?.current_team_abbrev,
          is_active: true,
        });
      }
    }

    console.log(`  Found ${playerMap.size} unique players after three stars`);

    // From game_skater_stats
    const { data: skaterGames } = await supabase
      .from('game_skater_stats')
      .select('player_id, team_abbrev, position')
      .limit(10000);

    for (const s of (skaterGames || [])) {
      if (s.player_id) {
        const existing = playerMap.get(s.player_id);
        if (existing) {
          existing.position = existing.position || s.position;
          existing.current_team_abbrev = existing.current_team_abbrev || s.team_abbrev;
        } else {
          playerMap.set(s.player_id, {
            id: s.player_id,
            first_name: 'Unknown',
            last_name: `Player ${s.player_id}`,
            position: s.position || null,
            current_team_abbrev: s.team_abbrev,
            is_active: true,
          });
        }
      }
    }

    // From game_goalie_stats
    const { data: goalieGames } = await supabase
      .from('game_goalie_stats')
      .select('player_id, team_abbrev')
      .limit(5000);

    for (const g of (goalieGames || [])) {
      if (g.player_id) {
        const existing = playerMap.get(g.player_id);
        if (existing) {
          existing.position = existing.position || 'G';
        } else {
          playerMap.set(g.player_id, {
            id: g.player_id,
            first_name: 'Unknown',
            last_name: `Goalie ${g.player_id}`,
            position: 'G',
            current_team_abbrev: g.team_abbrev,
            is_active: true,
          });
        }
      }
    }

    console.log(`  Total unique players: ${playerMap.size}`);

    // Upsert all players
    const players = Array.from(playerMap.values());
    await batchUpsert('players', players, 'id');

    const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
    console.log(`  Players in DB: ${playerCount}`);

    // Phase 2: Wait a bit and try to fill in team stats for missing teams
    console.log('\n  Phase 2: Checking for missing team stats...');
    await sleep(5000); // Give the API a breather

    // Check which teams already have stats
    const { data: existingStats } = await supabase
      .from('skater_season_stats')
      .select('team_abbrev')
      .eq('season', SEASON);

    const teamsWithStats = new Set((existingStats || []).map(s => s.team_abbrev));
    const missingTeams = ALL_TEAMS.filter(t => !teamsWithStats.has(t));

    console.log(`  Teams with stats: ${teamsWithStats.size}/32`);
    console.log(`  Missing teams: ${missingTeams.join(', ')}`);

    if (missingTeams.length > 0) {
      console.log(`  Attempting to fetch stats for ${missingTeams.length} missing teams...`);

      const allSkaterStats = [];
      const allGoalieStats = [];

      for (let i = 0; i < missingTeams.length; i++) {
        const team = missingTeams[i];
        try {
          const data = await fetchNHL(`/club-stats/${team}/now`);
          if (!data) continue;

          for (const s of (data.skaters || [])) {
            // Also update player info from club-stats
            if (!playerMap.has(s.playerId)) {
              await supabase.from('players').upsert({
                id: s.playerId,
                first_name: nameDefault(s.firstName),
                last_name: nameDefault(s.lastName),
                position: s.positionCode || null,
                current_team_abbrev: team,
                headshot_url: s.headshot || null,
                is_active: true,
              }, { onConflict: 'id' });
            }

            allSkaterStats.push({
              player_id: s.playerId,
              season: SEASON,
              team_abbrev: team,
              position: s.positionCode || null,
              games_played: s.gamesPlayed || 0,
              goals: s.goals || 0,
              assists: s.assists || 0,
              points: s.points || 0,
              plus_minus: s.plusMinus || 0,
              pim: s.penaltyMinutes || 0,
              power_play_goals: s.powerPlayGoals || 0,
              shorthanded_goals: s.shorthandedGoals || 0,
              game_winning_goals: s.gameWinningGoals || 0,
              overtime_goals: s.overtimeGoals || 0,
              shots: s.shots || 0,
              shooting_pctg: s.shootingPctg || null,
              avg_toi_per_game: s.avgTimeOnIcePerGame || null,
              avg_shifts_per_game: s.avgShiftsPerGame || null,
              faceoff_win_pctg: s.faceoffWinPctg || null,
            });
          }

          for (const g of (data.goalies || [])) {
            allGoalieStats.push({
              player_id: g.playerId,
              season: SEASON,
              team_abbrev: team,
              games_played: g.gamesPlayed || 0,
              games_started: g.gamesStarted || 0,
              wins: g.wins || 0,
              losses: g.losses || 0,
              ot_losses: g.overtimeLosses || g.otLosses || 0,
              goals_against_avg: g.goalsAgainstAverage || g.goalsAgainstAvg || null,
              save_pctg: g.savePercentage || g.savePctg || null,
              shots_against: g.shotsAgainst || 0,
              saves: g.saves || 0,
              goals_against: g.goalsAgainst || 0,
              shutouts: g.shutouts || 0,
              goals: g.goals || 0,
              assists: g.assists || 0,
              pim: g.penaltyMinutes || 0,
              toi_seconds: g.timeOnIce || 0,
            });
          }

          console.log(`  Fetched ${team} successfully`);
        } catch (err) {
          console.warn(`  ${team} still rate limited: ${err.message}`);
        }
        await sleep(2000); // Extra pause between teams
      }

      if (allSkaterStats.length > 0) {
        await batchUpsert('skater_season_stats', allSkaterStats, 'player_id,season,team_abbrev');
      }
      if (allGoalieStats.length > 0) {
        await batchUpsert('goalie_season_stats', allGoalieStats, 'player_id,season,team_abbrev');
      }
    }

    // Final counts
    const { count: finalPlayers } = await supabase.from('players').select('*', { count: 'exact', head: true });
    const { count: finalSkaters } = await supabase.from('skater_season_stats').select('*', { count: 'exact', head: true });
    const { count: finalGoalies } = await supabase.from('goalie_season_stats').select('*', { count: 'exact', head: true });

    console.log(`\n  Final counts:`);
    console.log(`    Players: ${finalPlayers}`);
    console.log(`    Skater season stats: ${finalSkaters}`);
    console.log(`    Goalie season stats: ${finalGoalies}`);

    await completeSync(syncId, finalPlayers || 0);
    console.log('=== Player population complete ===\n');
  } catch (err) {
    console.error('Player population failed:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
