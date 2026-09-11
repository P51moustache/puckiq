/**
 * Compatibility recovery entrypoint for validated exact-period standings.
 *
 * Run: node scripts/seed-standings.mjs [--season 20252026]
 */

import { parseSeasonArg } from './sync/nhl-api.mjs';
import { syncStandings } from './sync/sync-standings.mjs';

const { season } = parseSeasonArg();

syncStandings(season).catch(error => {
  console.error('Standings seeding failed:', error.message);
  process.exitCode = 1;
});
