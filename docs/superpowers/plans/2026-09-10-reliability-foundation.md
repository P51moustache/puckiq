# PuckIQ Reliability Foundation Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Keep each implementation task's files isolated; the primary agent integrates and reviews.

**Goal:** Complete stage 1 of the approved relaunch roadmap: numbers, periods, source freshness, entity destinations, season rollover and model evidence are trustworthy before building paid alerts.

**Spec:** docs/audits/2026-09-09-app-audit.md, findings 02,04,06–09,12–16,21,24; user-approved promise “Know what changed before puck drop.” The accepted Arena Club design in docs/design/vision.md supersedes the audit's old Stat Sheet recommendation.

**Architecture:** Services own authoritative reads. Statistics carry a season, game type and source/as-of context; incompatible rows cannot form a trend. Routes carry entity IDs. Model forecasts identify their actual engine and units. ML inference resolves the target season rather than pinning a year.

**Tech stack:** Expo 57 / React Native 0.86 / TypeScript strict; Supabase services; Python ML pipeline; existing Jest and pytest harnesses.

## Global constraints

- Work on the existing codex/arena-club-native branch, preserving the running Expo Go server/account and accepted design.
- Preserve package/slug/scheme/identifiers/version drift and unrelated untracked native files. No new native dependencies.
- No keys in output, files or commits. No live database mutation, pipeline execution, publish, push, store changes or messages to other people in this stage.
- Local schema fixes may be prepared only if necessary and must be reported as not deployed. Prefer safe typed application queries when the deployed view lacks a period contract.
- Add failing behavioral tests for numerical, period, navigation and error-state regressions. Do not replace data assertions with source-string assertions.
- Baseline: 110 Jest suites, 1,701 passing tests, 1 skipped; TypeScript clean; lint 94 existing warnings, zero errors. Required integration gate: npx tsc --noEmit && npm test.
- Current/prediction season uses July 1 UTC as season-year rollover. Historical display selects the latest available coherent data period and visibly labels it; no silent mixing with the calendar season. Preseason is never silently scored by regular-season models.

## Task 1: Coherent player statistics and detail

**Owner files:** services/playerTrends.ts, services/playerDetail.ts, components/PlayerDetailModal.tsx, components/HeroLeaderCard.tsx, app/(tabs)/players.tsx, matching existing tests; new focused player normalization helpers/tests and utils/season.ts are allowed. Coordinate before editing any other file.

1. Read committed schema/query contracts and current player trend/detail paths. Reproduce the audit's cross-season, traded split, career-object, missing-value and category issues with fixtures.
2. Add a shared pure season helper in utils/season.ts: getCurrentSeason(date?: Date): number (July 1 UTC rollover), formatSeasonLabel(season: number): string, isValidSeason(season: unknown): season is number. Other tasks will import these names. Do not default missing row season to the calendar season.
3. Make trend and detail inputs select one coherent season and game type. Aggregate legitimate traded-team splits or prefer a verified total row without double counting. Scope recent games by the same season/type and an explicit cutoff; reject or avoid unscoped rolling views. Preserve real zero versus missing data. Expose source season/as-of/sample counts needed by the UI, with backward-compatible types where feasible.
4. Normalize nested career totals, display the actual season, and resolve recent games to date/opponent. No [object Object], ID suffixes as dates, hardcoded 2024–25 or empty advanced tables.
5. Fix category-specific leader labels/totals/rates for points/goals/assists/shots. Shots total must be the season total, not a recent rate. Never fabricate trends from mismatched periods.
6. Run focused service/card tests and TypeScript; report remaining schema limitations. Do not deploy, run the complete test suite or commit. Root owns the shared checkout commit and navigation changes after this task.

## Task 2: Season rollover and truthful ML evaluation

**Owner files:** ml/config.py, ml/pipeline/daily_run.py, monthly_eval.py, relevant feature/scoring code and tests; scripts/sync/nhl-api.mjs with focused script tests if rollover differs.

1. Add failing fixtures for June/July rollover, 2026–27 opening night, explicit historical override, preseason exclusion and no-current-season samples.
2. Resolve current season centrally from date or validated explicit environment/CLI context; derive training windows/weights coherently. Inference must target a future game by its actual season. Deliberately use prior season inputs only as labeled/model-compatible fallbacks.
3. Calibrate home-win probabilities against actual home-win outcomes. Scope scores by evaluated model version and time period; avoid comparing against baselines evaluated on different games. Prefer joining existing outcome columns over adding schema.
4. Run focused pytest plus relevant broader ML tests. No training/inference jobs or remote writes.

## Task 3: Correct entity navigation, team data and freshness

**Owner files:** app/(tabs)/teams.tsx, stats.tsx, players.tsx (after Task 1), components/TeamModal.tsx, services/teamComparison.ts, new team detail/navigation helpers, hooks/useTonightData.ts, components/LeagueBriefing.tsx, affected tests.

1. Replace runtime NHL calls with a service-backed coherent standings snapshot and actual season/freshness labels. Preserve complete field mapping, units and missing data.
2. Consume validated team/player/game IDs at route destinations and connect Arena team/league rows to that entity. Reuse selected-game Game Preview context; unknown IDs yield a useful unavailable state.
3. Correct save percentage units and cross-season comparisons. Show stored source/prediction timestamps separately from request time; refresh forecasts when game IDs change, not only game count.
4. Test specific entity context, period/units, missing source timestamps and refresh invalidation. Verify key paths in Expo Go.

## Task 4: Honest forecasts, backtests and auth callback

**Owner files:** hooks/useTonightData.ts, components/LeagueBriefing.tsx, components/BriefingHero.tsx, services/backtesting.ts, components/model-builder/BacktestPanel.tsx, lib/supabase.ts, services/auth helpers, components/auth/AuthProvider.tsx and matching tests.

1. Use typed game-ID keyed probabilities with one explicit scale and model identity; pass the active custom model to its engine. Preserve the synthetic server model's read-only separation.
2. Replace unsupported regression/breakout/model claims with the actual goal-difference heuristic and neutral above/below-baseline language.
3. Label the existing limited replay as a four-factor baseline, identify excluded factors, and stop implying complete parity with the editable model.
4. Align Google OAuth to a documented PKCE/code callback, return honest cancel/failure states, and protect existing auth/session behavior. Keep provider redirect configuration and real-device auth verification explicit in release notes.
5. Run focused regressions; resolve material review findings.

## Task 5: Integration verification and roadmap handoff

1. Independently review each completed task and the integrated diff; resolve material trust/context regressions.
2. Run TypeScript, complete Jest suite, relevant pytest, focused lint, and diff checks. Inspect real native Players/detail, team destination, comparison units and dated historical states.
3. Record which audit items are repaired, superseded by Arena, prepared but undeployed, or still require external device/backend validation.
4. Commit only scoped reliability changes. Keep Metro online under zlce. Do not claim alerts, purchases or a paid pilot are complete; those remain later approved stages.
