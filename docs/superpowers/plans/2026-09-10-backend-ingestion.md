# Backend ingestion repair plan

> For agentic workers: use superpowers:subagent-driven-development for the producer implementation and review. Root owns live read-only investigation, integration and the final commit.

**Goal:** Stop our ingestion and recovery tools from creating misleading hockey data or reporting false success; document the live database and scheduler state before repair/deployment.

**Spec:** The owner's September 10 instruction explicitly includes database/backend correctness, plus the live evidence in `docs/audits/2026-09-10-reliability-foundation.md`.

**Architecture:** Validate NHL payloads at the ingestion boundary, use shared pure normalizers from both scheduled sync and legacy seed entry points, fail incomplete operations visibly, and verify health against explicit season/source freshness. Preserve the read-only mobile contract. Any required database changes are driven by catalog/data evidence rather than assumed from local migrations.

**Constraints:** Current feature checkout `codex/arena-club-native`; preserve Expo Go8082/zlce and unrelated native files. No secrets in logs. Do not re-enable the manually disabled workflow, push/merge, or rewrite live records during investigation. Local fixes and a reviewable repair procedure are authorized. Corrected source scripts must be tested without live writes. Root owns staging/commit. No new app/native dependencies.

## Task 1 — validated producers and safe recovery paths

Owner: `scripts/sync/sync-players.mjs`, `sync-stat-categories.mjs`, `sync-games.mjs`, shared new `scripts/sync/ingestion-contracts.mjs`, `scripts/seed-players.mjs`, `seed-players-fast.mjs`, `seed-stat-categories.mjs`, `seed-standings.mjs`, and matching Node tests. Coordinate before shared `seed-utils.mjs`/`nhl-api.mjs` edits. Do not touch health/client/orchestrator/workflow or database.

- [x] Add failing pure fixtures: correct goalie API names (`savePercentage`, `overtimeLosses`, `timeOnIce`); skater `avgTimeOnIcePerGame`; real zero versus absent; source season/game type mismatch; duplicate club rows; wrong/missing game season/type; HTTP and write failures are unsuccessful.
- [x] Expose `normalizeClubStats(payload, team, season)` returning `{skaters, goalies}`. Require exact response season/type2, arrays, positive player IDs, unique IDs within each type. Normalize all actual API fields; preserve unknown nullable values. Validate nonnegative cumulative counts, points=goals+assists when all known, and probability bounds. Use only measured denominators for derived rates.
- [x] Expose `normalizeTeamCategory(payload, category, season, teamMap, fetchedAt)` returning rows. Validate `total`/data completeness if provided, exact row season, optional returned game type, known team IDs and no duplicate teams; no last-row-wins deduplication. Keep unknown fields in raw JSON data.
- [x] Expose `normalizeGames(rawGames, season)` returning rows. Validate source season/game type and ID period; do not stamp today's games with a historical override. Reject inconsistent duplicate IDs while allowing equal duplicates from two team schedules.
- [x] Integrate validators before any batch writes. Count fetch failures, missing-table errors, unsuccessful batches and log-write errors; records_processed/upserted count actual successes. Fail a player/season snapshot before publishing when a club fetch fails; never log zero fetched teams as completed.
- [x] Route legacy seed player/category/standings writes through equivalent validated exact-period logic so a recovery command cannot recreate the old bugs. Do not infer current roster from historical club membership. Remove dangerous old mutation entry points if routing to maintained scripts preserves their documented purpose; retain player biography seeding if still needed.
- [x] Run focused Node tests, read-only normalize one real EDM payload if useful, and report changed files/test output. No commit or remote writes.

Example required assertion: `normalizeClubStats({season:'20252026',gameType:2,skaters:[],goalies:[{playerId:1,gamesPlayed:1,savePercentage:0,overtimeLosses:1,timeOnIce:3600}]},'EDM',20252026).goalies[0]` preserves `save_pctg:0`, `ot_losses:1`, `toi_seconds:3600`; a `gameType:3` payload throws before any writer runs.

## Task 2 — health, runner and deployment isolation

Owner: root; `scripts/sync/sync-health.mjs`, new pure health helper/tests, `supabase-client.mjs`, `sync-all.mjs`, `.github/workflows/nhl-data-sync.yml`, isolated backend package/lock if needed.

- [x] Reproduce empty/stale/missing/failed sync checks exiting successfully. Implement explicit completed-data season selection separate from calendar season; label offseason expectations rather than requiring games on every date. Check individual core sync statuses and freshness, not just table presence. Null completion times cannot outrank actual completed runs. JSON output is clean and failures exit nonzero.
- [x] Require server write credentials; never silently downgrade a writer to anon. Load local env using Node's supported loader with a safe optional fallback. Run child scripts with argument arrays instead of a shell string and validate the season once.
- [x] Pin sync runtime dependencies in a small backend manifest/lock so scheduled ingestion does not resolve the mobile dependency tree. Preserve the existing Node22/WebSocket correction. Add concurrency protection and run health even after sync failure. Do not change the manually disabled remote workflow state.
- [x] Verify with Node regressions and an intentionally read-only health run against live hockey tables. A failing live health result is expected evidence until the feed is repaired.

## Task 3 — database contract investigation and durable repair handoff

Owner: root; new backend audit/report and read-only diagnostic script/SQL if reusable.

- [x] Inspect deployed schema/catalog when access permits: primary/unique keys, period constraints, triggers, views/RLS, migration history, indexes and stored period/count anomalies. Read metadata and public hockey rows; no user records or tokens are needed.
- [x] Compare known bad rows directly to exact-period NHL responses; assign source/request/mapping/storage/reader responsibility. Inspect CI failure and current workflow state.
- [x] Prepare targeted schema migration/tests only if the live contract evidence supports the change. Do not label a source timestamp or game type as verified just by backfilling a default into legacy rows. Record blockers precisely if privileged catalog access is unavailable.
- [x] Save root-cause evidence, rollback/backup requirements, affected periods, deploy ordering and read-only post-repair checks. Production rewrite and workflow re-enable remain concrete reviewable follow-ups.

## Task 4 — review and verification

- [x] Independent review producer task and the integrated backend diff; resolve material findings.
- [x] Run Node backend tests, `npx tsc --noEmit && npm test`, lint for changed application-facing files and diff checks. No Python changes are planned; rerun ML tests only if its contract changes.
- [x] Commit only scoped backend changes and report local verification separately from live deployment/repair state.

Catalog access limitation: deployed columns/table stats verified; privileged constraints/RLS query could not complete. No migration or live repair claimed. Read-only diagnostic and evidence are in the backend audit.
