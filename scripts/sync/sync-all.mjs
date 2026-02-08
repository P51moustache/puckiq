/**
 * Orchestrates all sync modules in sequence.
 *
 * Usage:
 *   node scripts/sync/sync-all.mjs             # Incremental sync (default)
 *   node scripts/sync/sync-all.mjs --full      # Full season sync
 *
 * Exit codes:
 *   0 = all modules succeeded
 *   1 = one or more modules failed
 */

import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isFullSync = process.argv.includes('--full');
const isWeekly = process.argv.includes('--weekly');

const modules = [
  // Core: games, standings, teams, player season stats
  { name: 'games', script: 'sync-games.mjs', args: isFullSync ? ['--full'] : [] },
  { name: 'standings', script: 'sync-standings.mjs', args: [] },
  { name: 'teams', script: 'sync-teams.mjs', args: [] },
  { name: 'players', script: 'sync-players.mjs', args: [] },

  // Game extras: play-by-play, right-rail, boxscores for new games only
  { name: 'game-extras', script: 'sync-game-extras.mjs', args: isFullSync ? ['--full'] : [] },

  // Aggregates: Edge IQ landing pages, top-10 lists, stat leaders (lightweight)
  { name: 'aggregates', script: 'sync-aggregates.mjs', args: [] },

  // Player trends: game logs daily, advanced stats weekly (Corsi, Fenwick, PDO)
  { name: 'player-trends', script: 'sync-player-trends.mjs', args: isWeekly ? ['--weekly'] : [] },

  // Player career data: landing pages with career totals, awards, last 5 games (weekly only — ~900 API calls)
  ...(isWeekly || isFullSync ? [{ name: 'player-career', script: 'sync-player-career.mjs', args: [] }] : []),

  // Edge IQ detailed stats: per-entity endpoints (weekly only — ~900+ API calls)
  ...(isWeekly || isFullSync ? [{ name: 'edge-details', script: 'sync-edge-details.mjs', args: [] }] : []),
];

const modeLabel = isFullSync ? 'FULL' : isWeekly ? 'WEEKLY' : 'INCREMENTAL';
console.log(`=== PuckIQ NHL Data Sync (${modeLabel}) ===`);
console.log(`Started: ${new Date().toISOString()}\n`);

const results = [];

for (const mod of modules) {
  const scriptPath = join(__dirname, mod.script);
  const args = mod.args.join(' ');
  console.log(`--- Syncing ${mod.name} ${args} ---`);
  const start = Date.now();

  try {
    execSync(`node "${scriptPath}" ${args}`, {
      stdio: 'inherit',
      env: process.env,
      timeout: (isWeekly ? 15 : 5) * 60 * 1000, // 15 min for weekly, 5 min for daily
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    results.push({ name: mod.name, status: 'OK', elapsed });
    console.log(`--- ${mod.name}: OK (${elapsed}s) ---\n`);
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    results.push({ name: mod.name, status: 'FAILED', elapsed });
    console.error(`--- ${mod.name}: FAILED (${elapsed}s) ---\n`);
  }
}

// Summary
console.log('=== Sync Summary ===');
for (const r of results) {
  console.log(`  ${r.status === 'OK' ? 'OK' : 'FAIL'}  ${r.name} (${r.elapsed}s)`);
}

const failed = results.filter(r => r.status === 'FAILED');
console.log(`\nCompleted: ${new Date().toISOString()}`);
console.log(`Result: ${results.length - failed.length}/${results.length} modules succeeded`);

if (failed.length > 0) {
  console.error(`Failed modules: ${failed.map(f => f.name).join(', ')}`);
  process.exit(1);
}
