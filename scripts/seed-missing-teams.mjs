/**
 * Seed season stats for teams that were rate-limited during initial seeding.
 * Targets: TOR, UTA, VAN, VGK, WSH
 */

import { supabase, fetchNHL, batchUpsert, nameDefault, SEASON } from './seed-utils.mjs';

// Accept team list from command line args, or default to all missing
const args = process.argv.slice(2);
const missingTeams = args.length > 0 ? args : ['TOR', 'UTA', 'VAN', 'VGK', 'WSH'];

console.log('=== Fetching missing team player stats ===');
let totalSkaters = 0;
let totalGoalies = 0;

for (const team of missingTeams) {
  console.log(`  Fetching ${team}...`);
  try {
    const data = await fetchNHL(`/club-stats/${team}/now`);
    if (!data) {
      console.log(`  ${team} returned null`);
      continue;
    }

    // Skaters
    if (data.skaters) {
      const skaterRows = data.skaters.map(s => ({
        player_id: s.playerId,
        season: SEASON,
        team_abbrev: team,
        position: s.positionCode,
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
        shooting_pctg: s.shootingPctg,
        avg_toi_per_game: s.avgToi ? parseFloat(s.avgToi.split(':')[0]) + parseFloat(s.avgToi.split(':')[1] || 0) / 60 : null,
        faceoff_win_pctg: s.faceoffWinPctg,
      }));
      const count = await batchUpsert('skater_season_stats', skaterRows, 'player_id,season,team_abbrev');
      totalSkaters += count;
      console.log(`    Upserted ${count} skaters for ${team}`);

      // Also upsert players
      const playerRows = data.skaters.map(s => ({
        id: s.playerId,
        first_name: nameDefault(s.firstName),
        last_name: nameDefault(s.lastName),
        position: s.positionCode,
        current_team_abbrev: team,
        headshot_url: s.headshot || null,
        is_active: true,
      }));
      await batchUpsert('players', playerRows, 'id');
    }

    // Goalies
    if (data.goalies) {
      const goalieRows = data.goalies.map(g => ({
        player_id: g.playerId,
        season: SEASON,
        team_abbrev: team,
        games_played: g.gamesPlayed || 0,
        games_started: g.gamesStarted || 0,
        wins: g.wins || 0,
        losses: g.losses || 0,
        ot_losses: g.otLosses || 0,
        goals_against_avg: g.goalsAgainstAvg,
        save_pctg: g.savePctg,
        shots_against: g.shotsAgainst || 0,
        saves: g.saves || 0,
        goals_against: g.goalsAgainst || 0,
        shutouts: g.shutouts || 0,
        goals: g.goals || 0,
        assists: g.assists || 0,
        pim: g.penaltyMinutes || 0,
      }));
      const count = await batchUpsert('goalie_season_stats', goalieRows, 'player_id,season,team_abbrev');
      totalGoalies += count;
      console.log(`    Upserted ${count} goalies for ${team}`);

      const playerRows = data.goalies.map(g => ({
        id: g.playerId,
        first_name: nameDefault(g.firstName),
        last_name: nameDefault(g.lastName),
        position: 'G',
        current_team_abbrev: team,
        headshot_url: g.headshot || null,
        is_active: true,
      }));
      await batchUpsert('players', playerRows, 'id');
    }
  } catch (err) {
    console.log(`  ${team} failed: ${err.message}`);
  }
}

console.log(`\nDone! Added ${totalSkaters} skaters and ${totalGoalies} goalies`);
