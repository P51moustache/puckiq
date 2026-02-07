/**
 * Seed teams table from NHL standings API.
 * Run: node scripts/seed-teams.mjs
 */

import {
  supabase, fetchNHL, batchUpsert, startSync, completeSync, failSync,
  SEASON, ALL_TEAMS
} from './seed-utils.mjs';

async function main() {
  console.log('=== Seeding Teams ===');
  const syncId = await startSync('teams');

  try {
    // Fetch standings which contains team metadata
    const data = await fetchNHL('/standings/now');
    const standings = data.standings || [];

    if (standings.length === 0) {
      throw new Error('No standings data returned');
    }

    const teams = standings.map(t => ({
      id: t.teamId || null,
      abbrev: t.teamAbbrev?.default || t.teamAbbrev,
      full_name: t.teamName?.default || '',
      common_name: t.teamCommonName?.default || '',
      place_name: t.placeName?.default || '',
      conference: t.conferenceName || null,
      division: t.divisionName || null,
      logo_url: t.teamLogo || null,
      dark_logo_url: null,
    }));

    // Some teams might not have an ID from standings — try to fill from schedule
    // For now, we need team IDs. Let's fetch one schedule per team to get them.
    const teamsWithIds = [];
    for (const team of teams) {
      if (!team.id) {
        // Fetch schedule for this team to get team ID
        try {
          const sched = await fetchNHL(`/club-schedule-season/${team.abbrev}/${SEASON}`);
          const game = sched.games?.[0];
          if (game) {
            const isHome = game.homeTeam?.abbrev === team.abbrev;
            team.id = isHome ? game.homeTeam.id : game.awayTeam.id;
          }
        } catch (e) {
          console.warn(`  Could not get ID for ${team.abbrev}: ${e.message}`);
        }
      }
      if (team.id) {
        teamsWithIds.push(team);
      }
    }

    console.log(`  Found ${teamsWithIds.length} teams with IDs`);

    const count = await batchUpsert('teams', teamsWithIds, 'id');
    console.log(`  Upserted ${count} teams`);

    await completeSync(syncId, count);
    console.log('=== Teams seeding complete ===\n');
  } catch (err) {
    console.error('Teams seeding failed:', err.message);
    await failSync(syncId, err.message);
    process.exit(1);
  }
}

main();
