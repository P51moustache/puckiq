# Backend correctness audit and repair handoff

Date: September 10, 2026. Scope: core hockey ingestion, recovery entrypoints, live public hockey data, database metadata, and the scheduled feed. App reliability foundation: `2026-09-10-reliability-foundation.md`.

## Outcome

The checked discrepancies originate in our requests, field mappings and sync operation. The exact-period NHL API responses do not reproduce the bad stored values. Core producers and health checks are corrected locally and covered by regression tests. **The deployed feed is still stale; these changes have not been pushed, deployed, or used to rewrite production data.**

This is a necessary foundation, not a claim that every backend table or analytical signal is now verified. The database catalog inspection did not complete, advanced-data recovery still needs validation, and nontransactional batches can leave partial writes after a later batch fails.

## Confirmed causes

| Evidence | Responsibility and implication |
| --- | --- |
| NHL `club-stats/EDM/20252026/2` reports McDavid 82 GP / 138 points. Stored EDM 20252026 season row reports 1 GP / 0 points, updated April 21. | Our old `/now` request could read playoff totals and stamp them as regular-season totals. Exact season and game type must be validated before writing. |
| NHL regular-season EDM summary reports 82 GP / 282 goals. The unfiltered season query reports 88 GP / 303 goals; the database matches the unfiltered result. | Our Stats API request mixed regular season and playoffs. The API's response matches the query we sent. |
| NHL club goalies use `savePercentage`, `overtimeLosses`, `timeOnIce`; skaters use `avgTimeOnIcePerGame`, `avgShiftsPerGame`. | Old mappings used different names or omitted values. Missing data became zero, including save percentage. |
| NHL `/standings/2026-06-30` returns no rows. `/standings-season` identifies April 17 as the end date for 20252026; that date returns 32 teams. | Our historical recovery date assumption was wrong. Recovery now uses the published standings calendar. |
| Stored May 4 standings repeat completed-season totals. NHL's actual source snapshot is April 17. | Fetch date was being used as source date, making an old snapshot look new. |
| Per-club failures and unsuccessful Supabase writes could be swallowed; log rows counted attempted writes. Old health exited 0 for empty 20262027 tables. | Operational false successes concealed stale, incomplete or absent ingestion. |
| Latest stored completed core syncs are May 4. Workflow `NHL Data Sync` is `disabled_manually`, last updated June 30. Its latest failed run is 28463920240. | Scheduler outage is independent of the analytical bugs. The failed run crashes in Node 20 without native WebSocket support. Local Node 22/WebSocket corrections were not the deployed default-branch code. |

Scheduler evidence: [workflow](https://github.com/P51moustache/puckiq/actions/workflows/nhl-data-sync.yml), [last inspected failed run](https://github.com/P51moustache/puckiq/actions/runs/28463920240).

Primary source checks: [EDM regular-season club stats](https://api-web.nhle.com/v1/club-stats/EDM/20252026/2), [NHL standings calendar](https://api-web.nhle.com/v1/standings-season), [completed 20252026 standings](https://api-web.nhle.com/v1/standings/2026-04-17).

## Database evidence and limits

Read-only service access verified deployed public table columns via PostgREST's schema and inspected table statistics through the authenticated CLI. No user records or push-token values were read. Public hockey row counts:

| Season | Games | Standings rows | Skater season rows | Goalie season rows |
| --- | ---: | ---: | ---: | ---: |
| 20232024 | 1,494 | 0 | 342 | 35 |
| 20242025 | 1,488 | 0 | 352 | 40 |
| 20252026 | 1,391 | 2,784 | 979 | 98 |
| 20262027 | 0 | 0 | 0 | 0 |

These counts demonstrate stored coverage, not completeness. The 20252026 category table contains 576 rows; the maintained daily category job refreshes only powerplay, penaltykill, summary and penalties. Other category freshness remains unverified. A 20232024 McDavid row also has suspicious 58 GP / 96 points; historical seasons must be independently reconciled, not assumed clean.

Deployed season-stat tables and team-category rows have no explicit game-type column. Their current app contract is regular season. Application-side source checks now enforce that contract, but legacy rows have no proof of provenance. Do not add a default `game_type=2` and call old rows verified.

The linked project is PuckIQ (`yobqysvorsmcoselrtuq`) and matches the app environment. Project status is ACTIVE_HEALTHY; that does not establish data correctness. Core REST columns match the repository schema, but **live RLS policies, constraints, migration history and view options were not fully verified**. Management-API SQL calls hung; a schema-only dump's Docker image download hit local disk limits. The download was stopped, Docker shut down, and regenerable npm downloads cleared. No database DDL was run. A read-only catalog query is committed at `scripts/diagnostics/backend-catalog.sql`; execute it through a working privileged SQL session before preparing a migration.

## Local changes

- Exact source season/type checks for player stats, team categories and games. Validate meaningful numeric ranges, duplicate IDs, team mapping and conflicting schedule rows. Preserve missing nullable values instead of inventing zero.
- Correct goalie/skater mappings. Keep player biographies/current club membership sourced from current player landing pages, independently of historical club splits.
- Fetch and validate every required club snapshot before publishing player season rows. Full-season schedule recovery rejects unavailable/empty source coverage; incremental off-days can legitimately contain no games.
- Check Supabase's returned errors, count confirmed writes, record source coverage and explicit start/completion times, and return nonzero for fetch, write, verification or logging failures. Standings failures now record failed attempts.
- Validate complete unique standings coverage, record arithmetic and source dates. Historical dates come from NHL's season catalog.
- Health checks distinguish stored statistics season from schedule season, fail on empty/stale/failed/unidentified core ingestion, and separate fresh polling from stale standings during active regular-season games. Historical repairs are not judged against today's active-season snapshot date. JSON output is machine-readable and failures exit nonzero.
- Writers require a service credential and matching app/server project URLs. Child processes use argument arrays. Backend dependencies have an isolated lockfile under `scripts/`, with Node 22 in CI. CI runs contract tests, serializes workflow runs and checks health after failure.
- Legacy player and standings recovery use validated paths. **Broad `seed-all` now stops before any writes** because advanced recovery remains unverified. Legacy category recovery also stops before writes, with an explicit replacement for the four maintained team categories. Use the explicit maintained core command below; player/advanced category recovery is a separate release gate.

Explicit club membership covers 20232024 (Arizona) and 20242025–20262027 (Utah). Other seasons fail until their membership is supplied. This is deliberate rather than guessing a roster across franchise changes.

## Production repair sequence — not executed

1. Complete the catalog query and compare deployed constraints, RLS/write policies, views and migration history with committed migrations. Investigate any mismatch before selecting a schema change. This milestone intentionally contains no speculative migration.
2. Obtain a restorable database backup and export affected hockey rows by season. Record counts and unique keys. Preserve user, subscription and notification data.
3. On a staging database, run the corrected writers for **20252026** first. Compare exact-period NHL payloads to all stored club splits and core categories. Resolve missing player/team foreign keys before publishing; do not infer current membership from historical splits. For 20232024, explicitly populate/verify Arizona's historical identity before category or standings repair.
4. Reconcile stale rows as well as upserts. Upserting corrected source rows does not delete contaminated rows that disappeared from the source, fix falsely dated historical snapshots, or make multiple batches atomic. Produce a reviewed deletion/replacement manifest; verify a backup restore and preferably publish one complete staged snapshot transactionally. Do not delete by a broad season predicate without that inventory.
5. Once staging comparison passes, deploy the reviewed backend code and use the same targeted manifest for production. Reconcile 20232024 and 20242025 separately. Load the upcoming schedule as its own period; never relabel prior-season stats into 20262027.
6. Verify each producer's completed log, exact period, source coverage, successful row counts and freshness; compare representative teams and players plus whole-league totals. Run the read-only health command. Validate the app against repaired data before reopening subscription claims.
7. Re-enable the manually disabled workflow only after the corrected default-branch workflow is deployed and the production check succeeds. Watch the first actual run and its failure signal. Advanced feeds, alerts/schema integration and ML remain separate checks from core table health.

Maintained commands, to use only after the backup/staging/reconciliation steps above:

```sh
npm ci --prefix scripts --ignore-scripts
node scripts/sync/sync-games.mjs --full --season 20252026
node scripts/sync/sync-standings.mjs --season 20252026
node scripts/sync/sync-players.mjs --season 20252026
node scripts/sync/sync-stat-categories.mjs --season 20252026
node scripts/sync/sync-health.mjs --season 20252026 --json
```

Player biography recovery, if missing foreign keys require it: `node scripts/seed-players.mjs --season 20252026`. It validates all source clubs and biographies before publishing, and can be slow. Avoid broad `seed-all` and unreviewed advanced seed entrypoints for this repair.

## Verification

- `npx tsc --noEmit && npm test`: 112 suites passed; 1,681 tests passed, one skipped.
- Focused Node ingestion contracts cover field mappings, wrong periods, duplicates, missing versus zero, returned write errors/partial counts, sync metadata, offseason/history and source-calendar behavior. All 38 tests passed.
- Read-only real-source normalization: EDM 20252026 produced 34 skater splits and four goalie splits, including McDavid 82 GP / 138 points; source-selected April 17 standings validated all 32 teams. No writes.
- Live `sync-health --json` returns valid JSON, `ok:false`, and exit 1 for the unrefreshed feed. This is expected until deployment and reconciliation, not a test to bypass.
- Full Deno edge-function, ML/data backfill, live push/payment, load/performance, deployed RLS, Android and native-store verification are not established by these checks.
