# PuckIQ UX Flow Completion Implementation Plan

> **For agentic workers:** Use subagent-driven-development. The user explicitly approved implementing the complete audit and dispatching smaller agents, followed by independent verification.

**Goal:** Complete the audited user journeys, preserve Arena Club, and verify each finding with tests and a final cross-flow review.
**Architecture:** Keep data access in services and shared state in hooks/providers. Retain four primary tabs, existing device-local ownership, published ML provenance, actual entitlement gates and backend-unavailable alert status. Use existing dependencies.
**Tech Stack:** Current Expo 57 / React Native / TypeScript strict / Jest. Read package.json and current vision over stale summaries.
**Spec:** docs/design/vision.md plus the approved audit copied to docs/audits/2026-09-12-ux-source-audit.md.

## Global Constraints
- Work only in /Users/zach/Projects/active/puckiq-ux-flow-completion. Baseline 7cc6791 preserves existing user edits. Never revert them.
- No changes to slug, scheme, package versions, native projects, credentials, databases, remote alerts deployment, or live purchases.
- Existing auth/store/backend limitations must be honest; no fake confirmations or fabricated data.
- No direct database calls from UI. No new dependencies. Do not change the global Jest mocks without controller coordination.
- Agents own disjoint files, add focused regression tests, and report commands/results. They must not commit or spawn other agents. Controller owns integration and review.
- Main gate: npx tsc --noEmit && npm test. Also review lint deltas and iOS visual/runtime coverage. User narrowed scope to iOS only; Android work is no longer required.

## Product rulings
- Preserve actual free/Pro access and correct marketing claims to match it; do not add arbitrary gates.
- Keep local data on this device and explain persistence across sign-out; account migration is outside this change.
- Retain fantasy functionality and make My Team discoverable from Following.
- Support must use an already verified repository destination; if none exists, deliver an in-app help/recovery surface and a configurable contact destination without inventing an address.
- Keep remote alerts unavailable until backend delivery is enabled through a separately verified operational change.

## Tasks

### Task 1: Players and Following (F01 F02 F03 F09 player paths, F15 F18)
Files: app/(tabs)/players.tsx, app/(tabs)/following.tsx, components/ElevatedPlayerRow.tsx, components/PlayerDetailModal.tsx, new services/watchlist.ts + hooks/useWatchlist.ts and their focused tests.
- [ ] Regression: one-character typing stays active; stale search response cannot replace latest; network failure differs from no results.
- [ ] One serialized persisted watchlist service with subscription/update consistency, failure rollback/retry and readable saved-player collection. Any valid player can be watched from detail/search/hero.
- [ ] Preserve query/list context, show retry for feed/detail failures, refresh saved collection on return.
- [ ] Add Following entry for existing My Team route. Align detail with Arena roles and accessible actions.
- [ ] Focused behavioral tests, self-review and report.

### Task 2: Personal models and replay (F04 F06 F12 F15 F18)
Files: app/(tabs)/models.tsx, components/model-builder/*, components/DataSeedingModal.tsx, related services for scoped replay availability and tests. Do not edit app/(tabs)/stats.tsx (Task 4).
- [ ] Label published AI versus local experiments; published forecasts unaffected by local selection; read-only published provenance.
- [ ] Every model editor exit including Android request-close uses same dirty guard. Save failure retains draft; duplicate action prevents repeated submission.
- [ ] Rename download to availability check, scope to selected replay range/season, describe four-factor replay limits; discard late outcomes after close.
- [ ] Use Arena visual roles on model list/editor/dialogs; accessible sliders and button labels.
- [ ] Focused regression tests and report interface/copy required on League.

### Task 3: Account, onboarding, subscription and support (F05 F07 F13 F14 F17 F19, F15 F18)
Files: app/_layout.tsx, components/auth/AuthProvider.tsx, components/arena/ArenaOnboarding.tsx, components/HubScreen.tsx, components/PaywallModal.tsx, components/PremiumGate.tsx, components/SubscriptionProvider.tsx, new help/entitlement policy helpers and focused tests. Preserve existing operational/subscription changes.
- [ ] Startup storage rejection has visible retry. Auth busy/error/cancel recoverable; Apple only supported platforms.
- [ ] Sign-out explains retained local data. Settings return origin preserved with cold-entry fallback.
- [ ] Working Support opens in-app help/recovery with configured verified contact when available.
- [ ] Actual Pro benefits match existing gates; no sale of unavailable notifications. Subscription and restore reachable offseason/unavailable feeds.
- [ ] Offering retry, safe transaction close contract, confirmed entitlement only, restore/no entitlement/error recovery.
- [ ] Arena styling for paywall/gates; accessible controls. Focused tests and report.

### Task 4: Home, Book, League and navigation (F08 F10 F11 F09 team paths F18 F20)
Files: components/arena/TonightScreen.tsx, GamePreview.tsx, SeasonBook.tsx, SeasonHub.tsx, services/seasonBook.ts, app/(tabs)/teams.tsx, stats.tsx, app/+not-found.tsx and navigation helpers/tests.
- [ ] Preserve game origin Home/Book/deep link and team origin Following/League; no back-push loops; invalid links safe fallback.
- [ ] Book remove confirmation or exact snapshot Undo; failed writes retain state. Invalid final score displays unavailable while zero is valid.
- [ ] Actionable compare slots/clear labels; explicit retry/refresh; League model copy consumes Task 2 provenance.
- [ ] No-games/stale/offseason entry paths keep useful destinations and subscription via Settings.
- [ ] Focused tests and report.

### Task 5: Roster and secondary visual consistency (F16 F15 F18)
Files: components/RosterBuilder.tsx, MyTeamScreen.tsx, roster-related tests, remaining unowned secondary components after coordination.
- [ ] Reset draft on new open; guard dirty close; explicit empty-roster semantics; search honest fields; failed save keeps draft/retry.
- [ ] Arena palette/typography; no hidden tap actions; accessibility role/state/labels/48-point targets and scroll-safe content.
- [ ] Focused tests and report.

### Task 6: Independent review, integrated verification and handoff
- [ ] Independent reviewers inspect task diffs and acceptance criteria; route findings back to implementers.
- [ ] Audit every F01–F20 and S01–S28 for implemented behavior/evidence/remaining external validation.
- [ ] Run full typecheck + tests, lint delta; native iOS walkthrough, iPhone text sizing and accessibility checks. No live purchase, destructive data clear or backend mutation.
- [ ] Fix review findings, recheck affected flows, and perform final independent cross-flow review.
- [ ] Integrate task-only diff back into original checkout only after verifying original files still match baseline. Preserve all unrelated changes.
- [ ] Update durable audit/coverage handoff and prototype references where necessary; report verified outcomes and specific remaining externally blocked checks.
