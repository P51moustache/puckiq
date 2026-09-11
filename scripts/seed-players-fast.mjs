/**
 * Compatibility recovery entrypoint.
 *
 * The old fast path inferred current player membership from historical club
 * rows. Use the validated player recovery path so biographies remain current.
 *
 * Run: node scripts/seed-players-fast.mjs [--season 20252026]
 */

import { seedPlayers } from './seed-players.mjs';

seedPlayers('players_fast').catch(error => {
  console.error('Fast player seeding failed:', error.message);
  process.exitCode = 1;
});
