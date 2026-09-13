# Operational recovery verification — September 12, 2026

## Live system findings

Read-only checks against the configured PuckIQ project establish:

- Core health returns `ok:false`. Games, standings, player stats and team categories last completed on May 4. Tables being present is not evidence of freshness.
- The 20262027 schedule contains zero rows. Latest stored game and player forecasts are May 4, model version `20260220_061917`. The sampled latest fantasy rows have blank names and team abbreviations despite `data_quality='fresh'`.
- The GitHub `nhl-data-sync.yml` workflow remains `disabled_manually`, last updated June 30.
- Supabase's backup listing returns an empty backup array, no physical recovery metadata and `pitr_enabled:false`. The preview-branch listing returns null. No staging URL, database URL or database password is configured in the app's local environment.

Production repair has **not** run. A verified restorable backup, isolated staging target and reviewed reconciliation remain prerequisites. No production rows, schema, workflow state or cloud resources were changed. JSON exports of hockey rows are useful evidence, not full database backups. Supabase's [backup documentation](https://supabase.com/docs/guides/platform/backups) describes the recovery mechanisms and their limits.

## Catalog access recovered

The installed Supabase CLI is 2.65.5. An ephemeral, explicitly pinned CLI 2.117.0 supports `db query --linked --file`, which successfully ran the committed read-only `scripts/diagnostics/backend-catalog.sql`. No application dependencies were upgraded.

Verified constraints:

| Table | Relevant unique key |
| --- | --- |
| games | id |
| standings | team_abbrev, season, snapshot_date |
| skater_season_stats | player_id, season, team_abbrev |
| goalie_season_stats | player_id, season, team_abbrev |
| team_stat_categories | team_abbrev, season, stat_category |

RLS is enabled on those tables and on `sync_log`, `ml_predictions`, `user_data` and `push_tokens`. The two inspected user-data/token write policies require `auth.uid() = user_id`. This is a limited catalog inspection, not full authorization certification. The migrations table exists; `cron.job` does not.

## Security review gates

Live security advisors flag seven security-definer sports views: `skater_rolling_stats`, `skater_hot_cold`, `skater_pace_projections`, `goalie_rolling_stats`, `skater_advanced_trends`, `skater_scoring_rate_trends` and `team_rolling_performance`. They also flag the mutable search path on `update_updated_at_column` and disabled leaked-password protection.

These findings need a reviewed migration/settings change and role-based staging tests. They do not establish that private user data was exposed: the flagged views concern hockey statistics. No speculative DDL was applied, and no live authorization was weakened to make a query pass.

## Local work and verification

Six lower-cost `gpt-5.6-luna` workers handled analytics, recovery inventory, forecasts, seasonal display review, purchases and notification safety. Parent code review rejected and corrected missed error paths, account/lifecycle races, unsupported recommendation metadata, static repeating result content and incomplete recovery verification.

Starting baseline: TypeScript passed; 115 Jest suites / 1,702 tests passed, one skipped, with a worker teardown warning. All 38 Node ingestion tests passed. Expo was restarted on port 8082 and switched to Expo Go; the final simulator smoke checks are recorded below.

Implemented local repairs:

- Analytics has one lifecycle owner, initialization-aware initial screen tracking, idempotent transitions, measured foreground duration, persisted opt-out enforcement and initialization cancellation.
- Fantasy readers retain valid numeric forecasts but leave unsupported recommendation/confidence/reason null. They verify player/game identity, season/date/kickoff, finite coherent metrics and a 24-hour age ceiling. Cache entries expire at kickoff or source-age boundaries; missing roster forecasts render identity-only unavailable rows, not synthetic zero/SIT advice. The ML writer carries nested team/position and enriches stable names instead of writing blanks.
- Home separates current qualified schedules from historical completed results, filters invalid/stale schedule rows, marks unverified schedule freshness and avoids null score displays. Existing season-aware Home work remains intact.
- Purchase flows use native customer identity, serialized account changes, guarded listeners/refresh and provider-owned paywall access. Settings provides persistent subscription/restore access for guest, free and paid users, independent of available games or forecasts. Failed SDK/identity setup remains locked with an explicit unavailable reason and retry action. Displayed prices come from SDK packages; introductory offers require eligibility verification. No purchase or restore transaction was performed.
- Push-token helpers use the verified composite key, exact-device deletion and durable pending-token ownership before registration. Daily result notifications are dated one-shot requests with their own cancellation ID. Global-off behavior remains global; ordinary daily replacement preserves unrelated game notifications. Settings explicitly marks remote alerts unavailable in this build and disables all five legacy switches without overwriting saved preferences. No push sender or auto-registration caller was enabled.

Final integrated verification after all review corrections: TypeScript passed and all 120 Jest suites / 1,784 tests passed, one skipped. The existing worker-teardown warning remains. All 51 Node ingestion/recovery tests and 97 selected ML pipeline/scoring tests passed; ML dependencies emit 12 deprecation warnings. Expo lint exits 0 with 94 warnings and no errors. `git diff --check` passes. The combined verification command exited 0; no code verification remains pending for this local repair milestone.

Verification commands: `npx tsc --noEmit`, `npm test`, `npm test --prefix scripts`, `ml/.venv/bin/python -m pytest ml/tests/test_fantasy_pipeline.py ml/tests/test_fantasy_projections.py ml/tests/test_fantasy_scoring.py ml/tests/test_daily_run.py -q`, `npm run lint`, and `git diff --check`. These are not a full ML-suite run, Deno Edge Function check or native release certification. Final command logs are `/tmp/puckiq-20260912-final-{jest,ingestion,ml,lint}.log`.

## Remaining release gates

1. A verified restorable backup and isolated staging target. Scoped public JSON inventories do not satisfy this prerequisite.
2. Review and apply exact-period source reconciliation in staging, including missing and extra club splits, falsely dated standings and historical seasons. Deploy only after restore/rollback and post-write verification; then repair the upcoming schedule and re-enable the corrected scheduler. Live health still fails for the May 4 syncs.
3. Review the database security advisor findings with role-based tests. No speculative migration or authentication setting was applied.
4. Establish and test canonical push recipients/rosters, server-side entitlement evidence, producer authorization, idempotency, delivery errors and deployment triggers. The three legacy Edge Functions still expect columns absent from the actual key/value user-data contract. TypeScript/Jest do not verify those Deno functions.
5. Verify real iOS/Android development/store builds, OAuth redirects, signed archive entitlements, store product configuration, sandbox purchases/restores and physical-device notification delivery. Expo Go uses RevenueCat Browser Mode and cannot certify these paths.
6. Validate complete ML/fantasy quality. The existing fantasy producer still sets unmodeled shots/hits/blocks to zero, so identity repairs and passing tests do not establish complete fantasy scoring. An explicit partial-stat contract or validated category model is needed before claiming full category forecasts or start/sit advice. No retraining or ML deployment ran.

## Read-only recovery inventory

The corrected exporter ran against the configured live project. Files are in `/tmp/puckiq-recovery-20260912.hhTXlk`; these temporary files are not committed or durable backup storage.

| Scope | Rows / unique keys | Pages |
| --- | ---: | ---: |
| 20252026 regular-season games | 1,312 / 1,312 | 3 |
| 20252026 standings, stored May 4 date | 32 / 32 | 1 |
| 20252026 skater club splits | 979 / 979 | 2 |
| 20252026 goalie club splits | 98 / 98 | 1 |
| 20252026 team categories | 576 / 576 | 2 |

All manifests passed exact server-count, fetched-count, duplicate-key and allowed-column validation. Self-comparison passed as a comparison-tool smoke check; it does not establish agreement with NHL source data. Paginated reads are explicitly marked non-atomic and omit other tables, historical snapshots and private data.

### Complete club-split comparison

A subsequent read-only pass fetched and validated exact 20252026 regular-season club stats for all 32 teams. The source contains 1,023 skater club splits and 100 goalie club splits. Compared with the stored exports:

- Skaters: 978 matching-key rows differ, 45 source rows are missing from storage, and one stored key is absent from the source.
- Goalies: 97 matching-key rows differ, three source rows are missing from storage, and one stored key is absent from the source.

Differences include missing/mis-mapped average ice time and save percentage as well as contaminated cumulative totals. For example, 402 skater rows differ in games played and 365 in points. These counts describe rows with any differing allow-listed field, not 978 independent player identities or uniform severity. The controller independently recomputed comparisons and re-fetched EDM and NYR to verify their normalized rows match the worker's manifests.

Full row-level manifests and comparison artifacts remain in the same temporary inventory directory. They are review evidence, not authorization to delete the extra keys or publish a replacement. Historical seasons, other analytical feeds and transactional repair remain separate gates. See `2026-09-12-recovery-tooling.md` for coverage, key and field details.

## Final runtime checks

Use `npx expo start` for the plain dev server, not the iOS-only npm start script. This run uses `npx expo start --port 8082` and remains running; its status endpoint returns `packager-status:running`.

Expo Go 57 on the iPhone 17 simulator completed guest onboarding and rendered Home, Players, League, Settings and the paywall. Home describes the season as a calendar estimate needing a verified schedule refresh. League identifies its data as the stored May 4, 2026 snapshot for 2025–26; the database's falsely dated snapshot remains a recovery issue, not a corrected source date. Players visibly labels its older February/March source dates; historical trends have not been repaired or certified.

Settings visibly exposes the subscription/restore entry and disabled remote alerts. The paywall loads offerings and its Restore Purchases action is visible after scrolling. Neither Subscribe nor Restore Purchases was pressed. RevenueCat explicitly reports Browser Mode in Expo Go, so displayed offerings and prices do not verify actual native-store configuration or transactions.

A clean reload bundled iOS successfully without a persistent JavaScript crash. Runtime output includes Expo Go notification limitations and simulator-only notification warnings. Initial startup recommended Expo/package patch updates; dependencies were not upgraded. Repeated RevenueCat configuration warnings occurred during Fast Refresh but did not recur on the final clean reload. Physical-device notification limitations and development reload warnings are not proof of working native push or purchases.

Temporary visual evidence: `/tmp/puckiq-20260912-home-review.png`, `/tmp/puckiq-20260912-players-loaded.png`, `/tmp/puckiq-20260912-league-review.png`, `/tmp/puckiq-20260912-settings-final.png`, `/tmp/puckiq-20260912-paywall-final.png` and `/tmp/puckiq-20260912-restore-visible.png`.

The local repair and review milestone is complete. Production data recovery and the release gates above remain open; this report does not certify the app as fully operational or production-ready.
