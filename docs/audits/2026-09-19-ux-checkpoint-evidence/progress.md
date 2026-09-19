# SDD ledger — plan: docs/superpowers/plans/2026-09-12-ux-flow-completion.md

## Baseline
- Isolated sibling worktree: /Users/zach/Projects/active/puckiq-ux-flow-completion.
- Baseline commit: 7cc67917858da49881eb33e414855d0932b42618 preserves 60 existing modified/untracked files.
- Main checkout untouched. Dependencies and local .env are symlinked and ignored. No secrets copied into tracked artifacts.
- Baseline npx tsc --noEmit and npm test -- --runInBand passed (full summary in /tmp/puckiq-ux-baseline-tests.log).

## Rulings
- Ruling: Implement approved audit directly, no repeated approval ceremony — user explicitly said do it all with agents — changes are reversible and independently reviewed.
- Ruling: Preserve current actual Pro access and correct marketing claims — avoid unapproved new restrictions — product may later choose a different entitlement policy.
- Ruling: Retain device-local ownership with disclosure — no silent account migration — cross-device sync remains outside this change.
- Ruling: Make existing My Team discoverable from Following — retain useful fantasy functionality — navigation can be adjusted if product direction changes.
- Ruling: Use in-app help and only configured/verified external support — no invented contact address — direct contact may require a real destination.
- Ruling: Leave remote alert delivery unavailable — frontend fixes cannot certify backend delivery — actual push rollout requires operational verification.
- Ruling: Work in sibling worktree and integrate task-only diff after baseline comparison — protects existing concurrent work — integration may need reconciliation if original files change.

## Preflight interfaces
| Tasks | Shared interface | Resolution |
|---|---|---|
| 1 / 4 | Following team links → Team route | Task4 accepts preserved origin; coordinate params before Task4 |
| 1 / 5 | Following → My Team | Existing /(tabs)/myteam route; no new tab |
| 2 / 4 | Models provenance text in League | Task2 supplies wording; Task4 owns stats.tsx |
| 3 / 4 | Settings and shared navigation | Task3 owns Hub back; Task4 owns game/team navigation; helpers coordinated |
| 3 / 5 | PremiumGate in My Team | Preserve current gate interface; Task5 consumes existing provider |
| 1 / 2 / 3 / 5 | Arena palette/type | Existing useArena and arenaType; no new competing theme |
| 1 / 2 / 3 | Shared Jest setup | Controller only; agents use local mocks when needed |
| 1 | Search/watch service and collection | Tests cover persistence/failure/race semantics required by UI |
| 2 | Replay availability and range | Scope check to actual replay inputs; no fake download |
| 3 | Paywall claims and gates | Existing gate behavior is binding for claims |
| 4 | Saved record and current result | Snapshot immutable; removal confirmation/Undo preserves original |
| 5 | Roster lifecycle | Preserve draft on failure and explicit discard |
| 6 | Verification | Test evidence plus actual diff review; do not assert native coverage from Jest |

## Execution
- Task 1: running, players_following (gpt-5.6-sol).
- Task 2: running, models_replay (gpt-5.6-sol).
- Task 3: running, account_subscription (gpt-5.6-sol).
- Task 4: pending.
- Task 5: pending.
- Task 6: pending.

- Task3 review: 5 important + 2 minor gaps; fix round1 running. Native paywall screenshot substantiates contrast and AX failures.
- Task1 submitted 47/47 focused tests, typecheck pass; independent review queued.
- Android missing image restored via official SDK tooling; emulator booted. ExpoGo57 install underway.

- Task1 review: 4 important + 3 minor gaps; fix round1 dispatched for strict fetch errors, watchlist refresh race, duplicate remove/Undo, legacy serialization compatibility, explicit Retry and meaningful UI tests.
- Task3 native finding: ExpoGo Android throws while statically importing notifications. Fix round1 expanded to capability-guarded lazy initialization; installed build behavior retained.
- Native iOS reached Home, Players, Settings, paywall and help from isolated8082 bundle. Initial paywall conversion rejected on contrast and accessibility evidence.
- Android emulator booted and ExpoGo57 installed; runtime launch blocked by observed root notifications import pending fix.

- Task2 frozen, 167 targeted tests reported; reviewer queued. Task4 independent navigation/book work started (home_book_league).
- Palette contrast check32teams: all tested text pairs4.5 exceptANA link/paper4.45; visual task5 to correct.

- User scope correction: iOS only. Android emulator stopped; no further Android runtime/install work. Existing platform-neutral safeguards may remain. Remaining native gate is iPhone flows, sheet dismissal, text size, accessibility and supported links.

- Task3 fix round1 frozen; re-reviewqueued. Native iOS only accepted latest scope.
- Task5 running: roster_visuals, owns roster/MyTeam services/UI and ANA contrast adjustment.

- Task1 fixround1 frozen:103 focused tests, typecheck/scopedlint pass. Scoped re-reviewqueued.
- Task4 frozen:16 targetedtests/scopedlint/diffcheck pass. Reviewer queued; Models visual Back delegated toTask2review.
- Task2 independent reviewer running.

- Task2 independent review: 5 important findings; fixround1 dispatched (nativeBack/statusbar, replay races, eligibility, nestedArena continuity, accessibility).
- Task1+3 scoped independent re-review running.
- Task4 reviewqueued; Task5 implementationrunning.
- Original checkout integrationprecheck:61 touched/new paths match preserved baseline, no concurrent conflicts.

- Task1 scopedre-review found selectivefeed failures/metadata corruption/journey testgap. Fixround2 dispatched, plusTask3 minor plan touchdisable mismatch. Task3 priorimportant findings cleared foriOS.
- Task5 frozen:18focused tests, diffcheckpass; independentreviewqueued.

- Dedicated iOS26.5 iPhoneSE3 QA simulator created:8FF8FEE4-EF90-4CF9-93FE-613C5F831BC3. Purpose fresh onboarding, smallerlayout and disposablelocaltestdata. ExistingiPhone17 userdata retained.
- Native livepasses paused during non-atomicagentfileedits; definitive nativeevidence will use frozen coldreload. Earlier screenshots are discovery evidence, not finalverification.
