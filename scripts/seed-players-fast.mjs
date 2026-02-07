/**
 * Fast player seeding — populates players from club-stats data (no individual API calls).
 * Also re-seeds the missing team stats and fills in game boxscores.
 * Run: node scripts/seed-players-fast.mjs
 */

import {
  supabase, fetchNHL, batchUpsert, startSync, completeSync, failSync,
  sleep, progress, nameDefault, toiToSeconds, parseShotsStr,
  SEASON, ALL_TEAMS
} from './seed-utils.mjs';

async function main() {
  console.log('=== Fast Player Seeding ===');
  const syncId = await startSync('players_fast');

  try {
    // Phase 1: Fetch all team rosters and season stats
    console.log('  Phase 1: Fetching all team rosters...');
    const allPlayers = new Map(); // playerId -> basic info
    const allSkaterStats = [];
    const allGoalieStats = [];

    for (let i = 0; i < ALL_TEAMS.length; i++) {
      const team = ALL_TEAMS[i];
      try {
        const data = await fetchNHL(`/club-stats/${team}/now`);
        if (!data) continue;

        const skaters = data.skaters || [];
        const goalies = data.goalies || [];

        for (const s of skaters) {
          // Basic player info from roster stats
          if (!allPlayers.has(s.playerId)) {
            allPlayers.set(s.playerId, {
              id: s.playerId,
              first_name: nameDefault(s.firstName),
              last_name: nameDefault(s.lastName),
              position: s.positionCode || null,
              current_team_abbrev: team,
              headshot_url: s.headshot || null,
              is_active: true,
            });
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

        for (const g of goalies) {
          if (!allPlayers.has(g.playerId)) {
            allPlayers.set(g.playerId, {
              id: g.playerId,
              first_name: nameDefault(g.firstName),
              last_name: nameDefault(g.lastName),
              position: 'G',
              current_team_abbrev: team,
              headshot_url: g.headshot || null,
              is_active: true,
            });
          }

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
      } catch (err) {
        console.warn(`\n  Warning: ${team}: ${err.message}`);
      }
      progress(i + 1, ALL_TEAMS.length, `teams (${allPlayers.size} unique players)`);
    }

    // Upsert players (basic info from roster data)
    const playersArr = Array.from(allPlayers.values());
    console.log(`\n  Upserting ${playersArr.length} players...`);
    await batchUpsert('players', playersArr, 'id');

    // Check actual count
    const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
    console.log(`  Players in DB: ${playerCount}`);

    // Upsert skater season stats
    await batchUpsert('skater_season_stats', allSkaterStats, 'player_id,season,team_abbrev');
    const { count: sssCount } = await supabase.from('skater_season_stats').select('*', { count: 'exact', head: true });
    console.log(`  Skater season stats in DB: ${sssCount}`);

    // Upsert goalie season stats
    await batchUpsert('goalie_season_stats', allGoalieStats, 'player_id,season,team_abbrev');
    const { count: gssCount } = await supabase.from('goalie_season_stats').select('*', { count: 'exact', head: true });
    console.log(`  Goalie season stats in DB: ${gssCount}`);

    // Phase 2: Fetch boxscores for games we don't have yet
    console.log('\n  Phase 2: Checking for missing boxscores...');

    // Get all completed game IDs
    const { data: allGames } = await supabase
      .from('games')
      .select('id')
      .eq('season', SEASON)
      .in('game_state', ['FINAL', 'OFF'])
      .order('game_date');

    const allGameIds = (allGames || []).map(g => g.id);

    // Get game IDs that already have boxscore data
    const { data: existingBoxscores } = await supabase
      .from('game_skater_stats')
      .select('game_id')
      .limit(10000);

    const existingGameIds = new Set((existingBoxscores || []).map(b => b.game_id));
    const missingGameIds = allGameIds.filter(id => !existingGameIds.has(id));

    console.log(`  Total completed games: ${allGameIds.length}`);
    console.log(`  Already have boxscores for: ${existingGameIds.size}`);
    console.log(`  Missing boxscores: ${missingGameIds.length}`);

    if (missingGameIds.length > 0) {
      const allSkaterGameStats = [];
      const allGoalieGameStats = [];

      for (let i = 0; i < missingGameIds.length; i++) {
        const gameId = missingGameIds[i];
        try {
          const boxscore = await fetchNHL(`/gamecenter/${gameId}/boxscore`);
          if (!boxscore) continue;
          const pgs = boxscore.playerByGameStats || {};

          for (const side of ['awayTeam', 'homeTeam']) {
            const teamData = pgs[side] || {};
            const teamAbbrev = boxscore[side]?.abbrev || '';

            const skaters = [...(teamData.forwards || []), ...(teamData.defense || [])];
            for (const s of skaters) {
              allSkaterGameStats.push({
                game_id: gameId,
                player_id: s.playerId,
                team_abbrev: teamAbbrev,
                position: s.position || null,
                goals: s.goals || 0,
                assists: s.assists || 0,
                points: s.points || 0,
                plus_minus: s.plusMinus || 0,
                pim: s.pim || 0,
                hits: s.hits || 0,
                blocked_shots: s.blockedShots || 0,
                power_play_goals: s.powerPlayGoals || 0,
                shots_on_goal: s.sog || 0,
                faceoff_win_pctg: s.faceoffWinningPctg || null,
                toi: s.toi || null,
                toi_seconds: toiToSeconds(s.toi),
                shifts: s.shifts || 0,
                giveaways: s.giveaways || 0,
                takeaways: s.takeaways || 0,
              });
            }

            const goalies = teamData.goalies || [];
            for (const g of goalies) {
              allGoalieGameStats.push({
                game_id: gameId,
                player_id: g.playerId,
                team_abbrev: teamAbbrev,
                decision: g.decision || null,
                starter: g.starter || false,
                goals_against: g.goalsAgainst || 0,
                shots_against: g.shotsAgainst || 0,
                saves: g.saves || 0,
                save_pctg: g.savePctg || null,
                even_strength_shots_against: parseShotsStr(g.evenStrengthShotsAgainst),
                even_strength_goals_against: g.evenStrengthGoalsAgainst || 0,
                power_play_shots_against: parseShotsStr(g.powerPlayShotsAgainst),
                power_play_goals_against: g.powerPlayGoalsAgainst || 0,
                shorthanded_shots_against: parseShotsStr(g.shorthandedShotsAgainst),
                shorthanded_goals_against: g.shorthandedGoalsAgainst || 0,
                pim: g.pim || 0,
                toi: g.toi || null,
                toi_seconds: toiToSeconds(g.toi),
              });
            }
          }
        } catch (err) {
          // Non-fatal
        }

        if ((i + 1) % 20 === 0 || i === missingGameIds.length - 1) {
          progress(i + 1, missingGameIds.length, `boxscores (${allSkaterGameStats.length} skater lines)`);
        }
      }

      if (allSkaterGameStats.length > 0) {
        await batchUpsert('game_skater_stats', allSkaterGameStats, 'game_id,player_id');
        const { count: gssCount } = await supabase.from('game_skater_stats').select('*', { count: 'exact', head: true });
        console.log(`  Game skater stats in DB: ${gssCount}`);
      }

      if (allGoalieGameStats.length > 0) {
        await batchUpsert('game_goalie_stats', allGoalieGameStats, 'game_id,player_id');
        const { count: ggsCount } = await supabase.from('game_goalie_stats').select('*', { count: 'exact', head: true });
        console.log(`  Game goalie stats in DB: ${ggsCount}`);
      }
    }

    await completeSync(syncId, playerCount || 0);
    console.log('=== Fast Player Seeding complete ===\n');
  } catch (err) {
    console.error('Fast player seeding failed:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
