/**
 * Seed game_results table in Supabase with current season NHL data.
 * Run: node scripts/seed-game-results.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// All 32 NHL team abbreviations
const ALL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL',
  'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD',
  'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS',
  'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WPG', 'WSH',
];

function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 10) return `${year}${year + 1}`;
  return `${year - 1}${year}`;
}

async function main() {
  const season = getCurrentSeason();
  console.log(`Season: ${season}`);

  // Check current state
  const { count, error: countError } = await supabase
    .from('game_results')
    .select('game_id', { count: 'exact', head: true })
    .eq('season', season);

  if (countError) {
    console.error('Count query failed:', countError.message);
    process.exit(1);
  }

  console.log(`Current game_results rows for ${season}: ${count}`);

  if (count > 0) {
    console.log('Table already has data. Checking if we need more...');
  }

  // Fetch all teams' schedules
  const gameMap = new Map();
  let teamsDone = 0;

  for (const team of ALL_TEAMS) {
    try {
      const url = `https://api-web.nhle.com/v1/club-schedule-season/${team}/${season}`;
      const response = await fetch(url);
      const data = await response.json();
      const games = data.games ?? [];

      for (const game of games) {
        if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
          gameMap.set(game.id, {
            game_id: game.id,
            season,
            game_date: game.gameDate,
            home_team: game.homeTeam.abbrev,
            away_team: game.awayTeam.abbrev,
            home_score: game.homeTeam.score ?? 0,
            away_score: game.awayTeam.score ?? 0,
            game_state: game.gameState,
          });
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch ${team}: ${err.message}`);
    }

    teamsDone++;
    if (teamsDone % 8 === 0) {
      console.log(`Fetched ${teamsDone}/${ALL_TEAMS.length} teams (${gameMap.size} unique games)...`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nTotal unique games: ${gameMap.size}`);

  if (gameMap.size === 0) {
    console.log('No games found. Exiting.');
    process.exit(0);
  }

  // Upsert in batches of 200
  const allGames = Array.from(gameMap.values());
  const batchSize = 200;
  let totalUpserted = 0;

  for (let i = 0; i < allGames.length; i += batchSize) {
    const batch = allGames.slice(i, i + batchSize);
    const { error } = await supabase
      .from('game_results')
      .upsert(batch, { onConflict: 'game_id' });

    if (error) {
      console.error(`Batch upsert error at index ${i}:`, error.message);
    } else {
      totalUpserted += batch.length;
      console.log(`Upserted batch ${Math.floor(i / batchSize) + 1} (${totalUpserted}/${allGames.length})`);
    }
  }

  // Verify
  const { count: finalCount } = await supabase
    .from('game_results')
    .select('game_id', { count: 'exact', head: true })
    .eq('season', season);

  console.log(`\nDone! game_results now has ${finalCount} rows for season ${season}`);

  // Quick stats for momentum/clutch viability
  const { data: sampleGames } = await supabase
    .from('game_results')
    .select('home_team, away_team, home_score, away_score')
    .eq('season', season)
    .limit(500);

  if (sampleGames) {
    // Count one-goal games
    const oneGoalGames = sampleGames.filter(g => Math.abs(g.home_score - g.away_score) === 1);
    console.log(`One-goal games (for clutch): ${oneGoalGames.length} out of ${sampleGames.length}`);

    // Check per-team game counts
    const teamGameCounts = new Map();
    for (const g of sampleGames) {
      teamGameCounts.set(g.home_team, (teamGameCounts.get(g.home_team) || 0) + 1);
      teamGameCounts.set(g.away_team, (teamGameCounts.get(g.away_team) || 0) + 1);
    }
    const counts = Array.from(teamGameCounts.values());
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const avg = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
    console.log(`Games per team: min=${min}, avg=${avg}, max=${max}`);
    console.log(`Teams with 5+ games (momentum viable): ${counts.filter(c => c >= 5).length}/32`);

    // Count one-goal games per team
    const teamOneGoal = new Map();
    for (const g of oneGoalGames) {
      teamOneGoal.set(g.home_team, (teamOneGoal.get(g.home_team) || 0) + 1);
      teamOneGoal.set(g.away_team, (teamOneGoal.get(g.away_team) || 0) + 1);
    }
    const oneGoalCounts = Array.from(teamOneGoal.values());
    const teamsWithClutch = oneGoalCounts.filter(c => c >= 5).length;
    console.log(`Teams with 5+ one-goal games (clutch viable): ${teamsWithClutch}/32`);
  }
}

main().catch(err => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
