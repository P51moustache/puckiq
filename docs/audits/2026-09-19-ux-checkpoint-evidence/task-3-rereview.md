# Task 3 recovery re-review — Account, subscription, support, and launch

## Verdict

**The prior Task 3 findings are addressed for the iOS-only scope, with one new interaction-state gap.** The paywall now uses Arena palette roles throughout visible content, shared benefit policy names the two real gates, unavailable offerings have Retry, Settings gets a produced and consumed origin, auth exposes visible busy state, help actions perform their recovery, and launch recovery plus notification initialization are themed/lazy. Native iOS contrast, VoiceOver, Dynamic Type, and store behavior remain controller checks.

## Prior important findings

1. **Paywall contrast and accessible controls — ADDRESSED.** Feature, pricing, status, feedback, action, and restore content all receive current Arena palette roles at render time (`components/PaywallModal.tsx:182-235,242-329`). Close, plan choices, Subscribe, help, and Restore expose explicit roles; the main controls expose labels and selected/disabled/busy state (`components/PaywallModal.tsx:187-195,261-280,289-322`). The purchase surface is a single `palette.action`/`palette.actionInk` pair (`components/PaywallModal.tsx:299-304`). The focused assertions cover the exposed roles and labels (`components/__tests__/PaywallModal.test.tsx:80-95`).

2. **Ungated forecast/probability marketing — ADDRESSED.** The shared policy names only Fantasy Projections and My Team (`utils/accountFlowPolicy.ts:34-39`), and both paywall and PremiumGate consume it (`components/PaywallModal.tsx:16,35,221-235`; `components/PremiumGate.tsx:16,87-90`). Those are the two actual PremiumGate callsites (`app/(tabs)/players.tsx:621`; `components/MyTeamScreen.tsx:115`).

3. **Empty/unpriced offering has no Retry — ADDRESSED.** Missing current offerings and offerings with no supported priced package enter `unavailable` (`components/PaywallModal.tsx:93-106`), and both unavailable and error states render the same inline retry (`components/PaywallModal.tsx:245-252`). Focused cases cover `current: null` and zero supported packages (`components/__tests__/PaywallModal.test.tsx:158-167`).

4. **Settings origin lacks a production producer — ADDRESSED.** Every scoped primary screen renders `ArenaHeader`, whose Settings action derives an allowlisted origin from the current pathname and places it in route params (`components/arena/ArenaPrimitives.tsx:75-84,132-136`; callsites: `components/arena/TonightScreen.tsx:236`, `app/(tabs)/following.tsx:103`, `app/(tabs)/players.tsx:323,391`, `app/(tabs)/stats.tsx:83`). Settings first uses native history, then consumes the origin for cold fallback (`components/HubScreen.tsx:83,174-178`). Mapping tests cover Tonight, Following, Players, League, and unknown fallback (`utils/__tests__/accountFlowPolicy.test.ts:3-17`).

5. **Settings auth has no visible busy state — ADDRESSED.** Provider launch sets a provider-specific busy value and clears it in `finally` (`components/HubScreen.tsx:160-173`). The active button displays an indicator and “Opening Apple…”/“Opening Google…”, while both controls expose disabled state and the active one exposes busy state (`components/HubScreen.tsx:281-306`). The pending-promise regression asserts both visible and semantic state (`components/__tests__/HubScreen.test.tsx:193-202`).

## Prior minor findings

1. **Help recovery and link failure are not actionable — ADDRESSED.** Help directly invokes Subscription options and navigates to Tonight (`components/HubScreen.tsx:326-336`). A rejected configured support link produces visible alert feedback (`components/HubScreen.tsx:180-188,334-335`).

2. **Launch recovery lacks Arena and semantic roles — ADDRESSED.** The recovery page uses `palette.page`, `palette.ink`, `palette.muted`, `palette.action`, and `palette.actionInk`, with header, alert, button, and a 48-point Retry target (`app/_layout.tsx:47-48`). Notification code is no longer statically imported; initialization loads it on demand and errors remain recoverable (`app/_layout.tsx:97-107`; `utils/runtimeCapabilities.ts:1-11`). Under the current iOS-only scope, iOS retains lazy initialization.

## New gap introduced by the recovery

- **Plan choices remain touch-active while claiming to be disabled.** Each plan publishes `accessibilityState.disabled: true` during purchase/restore but never sets the TouchableOpacity `disabled` prop (`components/PaywallModal.tsx:261-272`). A user can change `selectedPlan` during a pending store transaction even though assistive technology is told the control is disabled. Add `disabled={isLoading}` and cover a press during a deferred purchase/restore. This does not reopen the original dismissal guard, but it makes the transaction state internally inconsistent.

## Evidence limits

No source files, index, or git state were changed. Per assignment, I did not run broad tests or native checks. The controller still needs the iOS palette variants, VoiceOver, Dynamic Type, cold restoration, auth handoff, and store-sheet pass.
