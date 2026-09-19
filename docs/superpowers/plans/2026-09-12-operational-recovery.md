# PuckIQ operational recovery — September 12

## Approved objective

Execute the remaining operational repairs with lower-cost workers, then independently audit their output. Live data correctness takes priority over presentation. The September 10 backend repair procedure is the binding recovery design; this pass does not authorize skipping its backup, staging or reconciliation gates.

## Constraints

- Preserve the existing checkout and all uncommitted season-aware Home and native changes. No stash, reset, branch creation, commit or push.
- Keep application data access inside services and preserve shipped app identities.
- Workers use `gpt-5.6-luna`, high effort, isolated prompts and disjoint file ownership. They cannot delegate or mutate remote systems.
- Never print credentials, private user records or push tokens. Row exports are not substitutes for a restorable database backup.
- Production replacement, deletion, schedule enablement, purchase and message delivery require their safety prerequisites; do not claim them completed from mocked tests.

## Tasks and acceptance

1. Controller: verify database catalog/backup/staging access and current scheduled-feed status. Follow `docs/audits/2026-09-10-backend-audit.md` before production writes. Record exact access blockers rather than inventing a migration.
2. Recovery worker: read-only paginated hockey inventory and deterministic reconciliation manifest with strict season/identity/completeness validation. Fixture tests must reject incomplete, conflicting and out-of-period inputs. No apply/delete engine.
3. Analytics worker: one app lifecycle owner, idempotent transitions and correct session durations. Regression tests cover multiple consumers, duplicate events, cleanup and disabled initialization.
4. Forecast worker: use real schema/context, reject invalid or stale forecasts and never invent unsupported recommendation/confidence. Test schema-shaped fixtures, context mismatch, cache behavior and unknown values.
5. Release auditor: inspect payment/restore, push recipient and registration contracts, OAuth/device gates, and current season-aware Home work. Produce a prioritized evidence-based report before any expanded repair scope.
6. Controller: review every changed file and regression, request corrections, run TypeScript/application/ingestion gates and start Expo without disturbing other processes. Verify available runtime paths; record untested device/external gates separately.

## Baseline

Current branch `codex/arena-club-native`, HEAD `7dde179`. TypeScript passes; 115 Jest suites / 1,702 tests pass, one skipped, worker-cleanup warning. Node ingestion 38/38 pass. Live health fails: all four core syncs last completed May 4. No Expo process found at the start of this pass.

## Progress

- Workers dispatched: analytics Feynman; recovery Franklin; forecasts Anscombe; release audit Newton.
- Controller is investigating database recovery access. No remote writes performed.
- Catalog access recovered with ephemeral Supabase CLI 2.117.0. Verified actual keys and RLS flags; seven security-definer sports views and two security warnings remain deployment-review gates. Backup listing is empty/PITR disabled; no staging branch or locally configured staging/database credentials. User asked asynchronously for existing backup/staging access.
- Expanded bounded repairs: Newton implements the audited season-display issues while preserving user edits; Fermat repairs purchase/restore reachability and entitlement identity; Planck repairs notification-token safety. All use `gpt-5.6-luna` high effort. No real transaction, send or deployment is authorized through these worker tasks.
- Parent recovery review round 1: rejected missing fetch-envelope metadata (export CLI could never succeed), absent project provenance/URL consistency, normalized-invalid dates, and incomplete row comparison. Worker correcting with exporter-path regressions.
- Parent analytics review round 1: rejected missing cold-start session, pre-initialization/disabled event persistence risk, and initialization-after-destroy timer resurrection. Worker correcting with lifecycle/consent regressions.
- Parent forecast review round 1: rejected an impossible success contract requiring unselected recommendation columns; preserve valid numeric forecasts with unavailable recommendations instead. Also require actual timestamp age/kickoff validation rather than trusting `fresh` or stale `FUT` flags. Worker correcting reader and narrowly affected consumers.
- Parent notification review round 1: rejected repeating static historical result content and success after failed durable token tracking. Worker correcting one-shot notification ownership and exact-device cleanup failures.
- Ruling: paid push delivery remains disabled/unwired until canonical recipient data, producer authorization, server entitlement evidence and staging/device gates are established. Local component tests cannot justify enabling real paid alerts.
- Recovery corrections reviewed; actual read-only exports succeeded for regular-season games (1,312), May 4 standings (32), skater splits (979), goalie splits (98), and categories (576). Exact counts, pagination and unique-key validation passed. These are scoped public-data inventories, not a restorable or atomic database backup.
- Parent purchase review rejected prior-account listener/refresh races, late initialization cleanup, and trusting JavaScript identity instead of the native persisted customer. Worker correcting these paths and removing unverified introductory-offer eligibility claims.
- Parent second-pass reviews requested initialization-aware screen tracking/background reconciliation, cache expiration at forecast kickoff, malformed schedule boundaries, dated notification text and retained ownership of tokens awaiting cleanup.
- Simulator guest onboarding and Home/League rendering verified in Expo Go 57 on iPhone 17. Home explicitly labels its calendar estimate and missing verified schedule; League displays the stored May 4 / 2025–26 snapshot. Runtime smoke checks continue after workers stop editing.
- Run preference: use `npx expo start` for the plain development server, not the iOS-only `npm start` script. This run uses port 8082 and remains running; no native prebuild or store build was performed.

## Final acceptance

- All six lower-cost workers finished. Parent review corrected the missed cases above and accepted the final local patches after integrated verification.
- Final gates passed: TypeScript; 120 Jest suites / 1,784 tests with one skipped; 51 Node ingestion/recovery tests; 97 selected ML tests; lint with zero errors / 94 warnings; and `git diff --check`. Existing Jest worker teardown and ML dependency warnings remain documented rather than hidden.
- All 32 exact-period NHL club sources were fetched read-only. Comparison found 978 changed / 45 missing / one extra skater club splits and 97 changed / three missing / one extra goalie club splits. Parent review recomputed the counts and independently re-fetched EDM and NYR to validate worker manifests. No live replacement or deletion ran.
- Settings now provides subscription/restore access even when there are no games or forecasts, reports failed subscription setup with retry, and truthfully disables unavailable remote alerts without erasing preferences.
- Final iPhone 17 / Expo Go smoke checks rendered Home, Players, League, Settings and the paywall. Restore Purchases was visibly reachable after scrolling; no purchase or restore action was executed. RevenueCat Browser Mode does not certify native-store products or transactions.
- The local repair milestone is complete. Production recovery is blocked on a verified restorable backup, isolated staging and reviewed reconciliation. Security, complete ML category quality, native payments/OAuth and real push delivery remain release gates. No production rows, schema, scheduler state or cloud resources were changed.
- Final evidence and remaining work are recorded in `docs/audits/2026-09-12-operational-recovery.md`. Expo remains running on port 8082.
