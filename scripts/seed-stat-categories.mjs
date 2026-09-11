/**
 * Retired unsafe broad category recovery entrypoint.
 *
 * The old command stamped an unverified season on team, skater, goalie, and
 * per-game rows and silently discarded duplicates. The maintained producer
 * currently supports four validated team categories only, so silently routing
 * this broader command would give a false impression of full recovery.
 */

console.error(
  'seed-stat-categories.mjs is retired because its 49-category writes are not period-safe. ' +
  'For the maintained powerplay, penaltykill, summary, and penalties team categories, run ' +
  '`node scripts/sync/sync-stat-categories.mjs --season YYYYyyyy`. ' +
  'The remaining legacy categories need dedicated validated producers before recovery.',
);
process.exitCode = 1;
