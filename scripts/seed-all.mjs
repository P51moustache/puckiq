/**
 * Master seeding script — runs all seed scripts in the correct order.
 * Run: node scripts/seed-all.mjs
 *
 * Order matters:
 * 1. Teams (needed for foreign keys)
 * 2. Games (depends on teams)
 * 3. Standings (depends on teams)
 * 4. Players & stats (depends on teams, games)
 * 5. Edge stats (depends on teams, players)
 * 6. Comprehensive JSONB data (depends on core entities)
 * 7. Supplemental data (draft, leaders, rosters, meta)
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scripts = [
  // Phase 1: Core entities (order matters — foreign key dependencies)
  'seed-teams.mjs',
  'seed-games.mjs',
  'seed-standings.mjs',
  'seed-players.mjs',

  // Phase 2: Basic edge stats (depends on teams + players)
  'seed-edge-stats.mjs',

  // Phase 3: Comprehensive JSONB data (depends on core entities)
  'seed-stat-categories.mjs',        // 49 Stats REST API categories (team/skater/goalie)
  'seed-edge-comprehensive.mjs',     // 30+ Edge IQ sub-endpoints per entity
  'seed-play-by-play.mjs',           // Play-by-play events with x/y coordinates
  'seed-game-details.mjs',           // Right-rail: officials, coaches, scratches, shots by period
  'seed-player-career.mjs',          // Career totals, season totals, awards, recent form

  // Phase 4: Per-game advanced analytics (for time-series/trend tracking)
  'seed-player-game-stats.mjs',      // Per-game Corsi, Fenwick, PDO, scoring rates from Stats REST API
];

const startTime = Date.now();
console.log('╔══════════════════════════════════════╗');
console.log('║   PuckIQ Full NHL Data Seed          ║');
console.log('║   Season: 2025-2026                  ║');
console.log('╚══════════════════════════════════════╝');
console.log('');

for (const script of scripts) {
  const scriptPath = resolve(__dirname, script);
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Running: ${script}`);
  console.log(`${'─'.repeat(50)}`);

  try {
    execSync(`node "${scriptPath}"`, {
      stdio: 'inherit',
      cwd: resolve(__dirname, '..'),
      timeout: 1800000, // 30 minute timeout per script (some scripts fetch 800+ games)
    });
  } catch (err) {
    console.error(`\nFATAL: ${script} failed with exit code ${err.status}`);
    console.error('Stopping seed process.');
    process.exit(1);
  }
}

const elapsed = Math.round((Date.now() - startTime) / 1000);
console.log(`\n${'═'.repeat(50)}`);
console.log(`All seeding complete in ${elapsed}s`);
console.log(`${'═'.repeat(50)}`);
