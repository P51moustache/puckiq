/**
 * Seed players table and season stats from club-stats and player landing APIs.
 * Also seeds per-game boxscore stats from gamecenter/boxscore.
 * Run: node scripts/seed-players.mjs
 */

import {
  supabase, fetchNHL, batchUpsert, startSync, completeSync, failSync,
  sleep, progress, nameDefault, toiToSeconds, parseShotsStr, parseSavesStr,
  SEASON, SEASON_STR, ALL_TEAMS
} from './seed-utils.mjs';

async function main() {
  console.log('=== Seeding Players & Stats ===');
  const syncId = await startSync('players');

  try {
    // Phase 1: Fetch all team rosters and season stats
    console.log('  Phase 1: Fetching team rosters and season stats...');
    const allSkaterStats = [];
    const allGoalieStats = [];
    const playerIds = new Set();

    for (let i = 0; i < ALL_TEAMS.length; i++) {
      const team = ALL_TEAMS[i];
      try {
        const data = await fetchNHL(`/club-stats/${team}/now`);
        const skaters = data.skaters || [];
        const goalies = data.goalies || [];

        for (const s of skaters) {
          playerIds.add(s.playerId);
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
          playerIds.add(g.playerId);
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
        console.warn(`\n  Warning: Failed to fetch stats for ${team}: ${err.message}`);
      }
      progress(i + 1, ALL_TEAMS.length, `teams (${playerIds.size} players)`);
    }

    // Phase 2: Fetch player details for bio info
    console.log(`\n  Phase 2: Fetching player bios for ${playerIds.size} players...`);
    const players = [];
    const playerIdArr = Array.from(playerIds);

    for (let i = 0; i < playerIdArr.length; i++) {
      const pid = playerIdArr[i];
      try {
        const data = await fetchNHL(`/player/${pid}/landing`);
        players.push({
          id: data.playerId,
          first_name: nameDefault(data.firstName),
          last_name: nameDefault(data.lastName),
          position: data.position || null,
          shoots_catches: data.shootsCatches || null,
          height_inches: data.heightInInches || null,
          weight_pounds: data.weightInPounds || null,
          birth_date: data.birthDate || null,
          birth_city: data.birthCity?.default || data.birthCity || null,
          birth_country: data.birthCountry || null,
          current_team_id: data.currentTeamId || null,
          current_team_abbrev: data.currentTeamAbbrev || null,
          sweater_number: data.sweaterNumber || null,
          is_active: data.isActive !== false,
          headshot_url: data.headshot || null,
          draft_year: data.draftDetails?.year || null,
          draft_round: data.draftDetails?.round || null,
          draft_pick: data.draftDetails?.pickInRound || null,
          draft_overall: data.draftDetails?.overallPick || null,
        });
      } catch (err) {
        // Non-fatal — some players may not have landing pages
      }

      if ((i + 1) % 25 === 0 || i === playerIdArr.length - 1) {
        progress(i + 1, playerIdArr.length, `player bios`);
      }
    }

    // Upsert players
    const playersCount = await batchUpsert('players', players, 'id');
    console.log(`  Upserted ${playersCount} players`);

    // Upsert skater season stats
    const skaterStatsCount = await batchUpsert(
      'skater_season_stats', allSkaterStats,
      'player_id,season,team_abbrev'
    );
    console.log(`  Upserted ${skaterStatsCount} skater season stats`);

    // Upsert goalie season stats
    const goalieStatsCount = await batchUpsert(
      'goalie_season_stats', allGoalieStats,
      'player_id,season,team_abbrev'
    );
    console.log(`  Upserted ${goalieStatsCount} goalie season stats`);

    // Phase 3: Fetch per-game boxscore stats for completed games
    console.log(`\n  Phase 3: Fetching game boxscores...`);

    // Get all completed game IDs from the database
    const { data: completedGames, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .eq('season', SEASON)
      .in('game_state', ['FINAL', 'OFF'])
      .order('game_date', { ascending: true });

    if (gamesError) {
      console.warn(`  Could not fetch game list: ${gamesError.message}`);
    }

    const gameIds = (completedGames || []).map(g => g.id);
    console.log(`  Found ${gameIds.length} completed games to fetch boxscores for`);

    const allSkaterGameStats = [];
    const allGoalieGameStats = [];

    for (let i = 0; i < gameIds.length; i++) {
      const gameId = gameIds[i];
      try {
        const boxscore = await fetchNHL(`/gamecenter/${gameId}/boxscore`);
        const pgs = boxscore.playerByGameStats || {};

        for (const side of ['awayTeam', 'homeTeam']) {
          const teamData = pgs[side] || {};
          const teamAbbrev = boxscore[side]?.abbrev || '';

          // Skaters (forwards + defense)
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

          // Goalies
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

      if ((i + 1) % 20 === 0 || i === gameIds.length - 1) {
        progress(i + 1, gameIds.length, `boxscores (${allSkaterGameStats.length} skater stats)`);
      }
    }

    // Upsert game skater stats
    if (allSkaterGameStats.length > 0) {
      const sgCount = await batchUpsert(
        'game_skater_stats', allSkaterGameStats,
        'game_id,player_id'
      );
      console.log(`  Upserted ${sgCount} game skater stats`);
    }

    // Upsert game goalie stats
    if (allGoalieGameStats.length > 0) {
      const ggCount = await batchUpsert(
        'game_goalie_stats', allGoalieGameStats,
        'game_id,player_id'
      );
      console.log(`  Upserted ${ggCount} game goalie stats`);
    }

    const totalRecords = playersCount + skaterStatsCount + goalieStatsCount +
      allSkaterGameStats.length + allGoalieGameStats.length;
    await completeSync(syncId, totalRecords);
    console.log('=== Players & Stats seeding complete ===\n');
  } catch (err) {
    console.error('Players seeding failed:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
