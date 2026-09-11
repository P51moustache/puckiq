/**
 * Retired broad recovery command. Several historical/advanced seed paths still
 * lack source-period validation; running them together is not a verified repair.
 * Fail before starting any writer, instead of leaving a partial recovery.
 */
console.error('Broad seed:all is disabled until advanced-data recovery is validated.');
console.error('For the reviewed core repair procedure, see docs/audits/2026-09-10-backend-audit.md.');
console.error('Maintained core entrypoints: sync-games --full, sync-standings, sync-players, and sync-stat-categories (all accept --season).');
process.exitCode = 1;
