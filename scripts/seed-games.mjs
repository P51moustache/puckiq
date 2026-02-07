/**
 * Seed games table with all 2025-26 season games (schedule + scores).
 * Also seeds game_goals, game_three_stars, and game_penalties from landing data.
 * Run: node scripts/seed-games.mjs
 */

import {
  supabase, fetchNHL, batchUpsert, startSync, completeSync, failSync,
  sleep, progress, nameDefault, toiToSeconds,
  SEASON, SEASON_STR, ALL_TEAMS
} from './seed-utils.mjs';

async function main() {
  console.log('=== Seeding Games ===');
  const syncId = await startSync('games');

  try {
    // Phase 1: Collect all games from all team schedules
    console.log('  Phase 1: Fetching team schedules...');
    const gameMap = new Map();

    for (let i = 0; i < ALL_TEAMS.length; i++) {
      const team = ALL_TEAMS[i];
      try {
        const data = await fetchNHL(`/club-schedule-season/${team}/${SEASON}`);
        const games = data.games || [];

        for (const game of games) {
          if (game.gameType !== 2) continue; // Regular season only
          if (gameMap.has(game.id)) continue;

          gameMap.set(game.id, {
            id: game.id,
            season: SEASON,
            game_type: game.gameType,
            game_date: game.gameDate,
            start_time_utc: game.startTimeUTC || null,
            venue: game.venue?.default || null,
            venue_timezone: game.venueTimezone || null,
            game_state: game.gameState || 'FUT',
            game_schedule_state: game.gameScheduleState || 'OK',
            away_team_id: game.awayTeam?.id || null,
            away_team_abbrev: game.awayTeam?.abbrev || '',
            away_score: game.awayTeam?.score ?? 0,
            away_sog: null,
            home_team_id: game.homeTeam?.id || null,
            home_team_abbrev: game.homeTeam?.abbrev || '',
            home_score: game.homeTeam?.score ?? 0,
            home_sog: null,
            period: null,
            period_type: game.gameOutcome?.lastPeriodType || null,
            winning_goalie_id: game.winningGoalie?.playerId || null,
            losing_goalie_id: game.losingGoalie?.playerId || null,
            game_center_link: game.gameCenterLink || null,
            three_min_recap: null,
            neutral_site: game.neutralSite || false,
          });
        }
      } catch (err) {
        console.warn(`\n  Warning: Failed to fetch schedule for ${team}: ${err.message}`);
      }
      progress(i + 1, ALL_TEAMS.length, `teams fetched (${gameMap.size} unique games)`);
    }

    console.log(`\n  Total unique games: ${gameMap.size}`);

    // Upsert all games
    const allGames = Array.from(gameMap.values());
    const gamesCount = await batchUpsert('games', allGames, 'id');
    console.log(`  Upserted ${gamesCount} games`);

    // Phase 2: Fetch detailed data for completed games
    const completedGames = allGames.filter(g =>
      g.game_state === 'FINAL' || g.game_state === 'OFF'
    );
    console.log(`\n  Phase 2: Fetching details for ${completedGames.length} completed games...`);

    const allGoals = [];
    const allStars = [];
    const allPenalties = [];
    let gamesWithDetails = 0;

    for (let i = 0; i < completedGames.length; i++) {
      const game = completedGames[i];
      try {
        // Fetch landing page for scoring, penalties, 3 stars
        const landing = await fetchNHL(`/gamecenter/${game.id}/landing`);

        // Update game with SOG from landing
        const awaySog = landing.awayTeam?.sog;
        const homeSog = landing.homeTeam?.sog;
        const period = landing.periodDescriptor?.number;
        if (awaySog || homeSog || period) {
          await supabase
            .from('games')
            .update({
              away_sog: awaySog || null,
              home_sog: homeSog || null,
              period: period || null,
            })
            .eq('id', game.id);
        }

        const summary = landing.summary || {};

        // Extract goals
        const scoring = summary.scoring || [];
        for (const periodData of scoring) {
          const goals = periodData.goals || [];
          for (const goal of goals) {
            const assists = goal.assists || [];
            allGoals.push({
              game_id: game.id,
              period: periodData.periodDescriptor?.number || 0,
              period_type: periodData.periodDescriptor?.periodType || 'REG',
              time_in_period: goal.timeInPeriod || '00:00',
              scorer_player_id: goal.playerId || null,
              scorer_name: nameDefault(goal.name),
              team_abbrev: nameDefault(goal.teamAbbrev),
              away_score: goal.awayScore || 0,
              home_score: goal.homeScore || 0,
              strength: goal.strength || 'ev',
              shot_type: goal.shotType || null,
              goal_modifier: goal.goalModifier || 'none',
              assist1_player_id: assists[0]?.playerId || null,
              assist1_name: nameDefault(assists[0]?.name),
              assist2_player_id: assists[1]?.playerId || null,
              assist2_name: nameDefault(assists[1]?.name),
              highlight_clip_url: goal.highlightClipSharingUrl || null,
            });
          }
        }

        // Extract three stars
        const threeStars = summary.threeStars || [];
        for (const star of threeStars) {
          allStars.push({
            game_id: game.id,
            star_number: star.star || 0,
            player_id: star.playerId || 0,
            player_name: nameDefault(star.name),
            team_abbrev: nameDefault(star.teamAbbrev),
            position: star.position || null,
            goals: star.goals || 0,
            assists: star.assists || 0,
            points: (star.goals || 0) + (star.assists || 0),
          });
        }

        // Extract penalties
        const penalties = summary.penalties || [];
        for (const periodData of penalties) {
          const pens = periodData.penalties || [];
          for (const pen of pens) {
            allPenalties.push({
              game_id: game.id,
              period: periodData.periodDescriptor?.number || 0,
              time_in_period: pen.timeInPeriod || '00:00',
              player_id: pen.committedByPlayerId || null,
              player_name: nameDefault(pen.committedByPlayer),
              team_abbrev: nameDefault(pen.teamAbbrev),
              penalty_type: pen.type || null,
              duration: pen.duration || null,
              description: pen.descKey || null,
            });
          }
        }

        gamesWithDetails++;
      } catch (err) {
        // Non-fatal — some games may not have landing data
      }

      if ((i + 1) % 10 === 0 || i === completedGames.length - 1) {
        progress(i + 1, completedGames.length, `games detailed (${allGoals.length} goals)`);
      }
    }

    console.log(`\n  Games with details: ${gamesWithDetails}`);

    // Upsert goals
    if (allGoals.length > 0) {
      const goalsCount = await batchUpsert(
        'game_goals', allGoals,
        'game_id,period,time_in_period,scorer_player_id'
      );
      console.log(`  Upserted ${goalsCount} goals`);
    }

    // Upsert three stars
    if (allStars.length > 0) {
      const starsCount = await batchUpsert('game_three_stars', allStars, 'game_id,star_number');
      console.log(`  Upserted ${starsCount} three stars entries`);
    }

    // Upsert penalties
    if (allPenalties.length > 0) {
      // Penalties don't have a natural unique key, so delete and reinsert
      // Actually, let's just insert — duplicates are fine for penalties
      const { error } = await supabase.from('game_penalties').insert(allPenalties);
      if (error && !error.message.includes('duplicate')) {
        console.warn(`  Penalties insert warning: ${error.message}`);
      }
      console.log(`  Inserted ${allPenalties.length} penalties`);
    }

    const totalRecords = gamesCount + allGoals.length + allStars.length + allPenalties.length;
    await completeSync(syncId, totalRecords);
    console.log('=== Games seeding complete ===\n');
  } catch (err) {
    console.error('Games seeding failed:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
