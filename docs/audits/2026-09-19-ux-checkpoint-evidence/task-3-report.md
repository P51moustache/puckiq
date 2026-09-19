# Task 3 report — account, onboarding, subscription and support

## Files

- `app/_layout.tsx`: launch storage read failures now render a preserved-data explanation and Retry action.
- `components/auth/AuthProvider.tsx`: Apple cancellation, sign-out failures, and session refresh failures now produce visible provider state.
- `components/arena/ArenaOnboarding.tsx`: auth cancellation/failure is inline, retryable, and retains the selected team; buttons expose busy state and Apple remains iOS-only.
- `components/HubScreen.tsx`: origin-aware Back with cold fallback, visible sign-in outcomes/busy states, retained-device-data sign-out confirmation, and actionable in-app recovery help with an optional configured destination.
- `components/PaywallModal.tsx`: actual gated benefits only, Arena palette/type, offering retry, transaction-safe native/visual dismissal, restore recovery, and always-available purchase help.
- `components/PremiumGate.tsx`: Arena palette/type and explicit accessible upgrade/retry action labels.
- `utils/accountFlowPolicy.ts`: allowlisted Settings return routes, validated configurable support destination, and the shared actual-entitlement benefit policy.
- Focused regression coverage in `components/__tests__/HubScreen.test.tsx`, `components/__tests__/PaywallModal.test.tsx`, `components/__tests__/PremiumGate.test.tsx`, and `utils/__tests__/accountFlowPolicy.test.ts`.

## Evidence

- F05: onboarding and Settings display provider failures; auth controls disable while busy; Apple is gated by `Platform.OS === 'ios'`.
- F07: Support opens an in-app surface with subscription and feed recovery. `EXPO_PUBLIC_SUPPORT_DESTINATION` accepts a validated email or HTTPS URL; absent/invalid configuration does not invent contact data.
- F13: offering errors expose inline Retry; purchase/restore keeps both close paths disabled; cancellation and no-entitlement states remain in the paywall; restore and help remain reachable.
- F14: marketing now lists only existing gated player analytics and My Team fantasy tools. Remote alerts remain explicitly unavailable and are not sold.
- F15/F18: paywall and PremiumGate use Arena palette/type roles; icon actions have accessible roles/labels and at least 44-point targets.
- F17: sign-out requires a confirmation that saved cards, watched players, and team preferences remain on the device.
- F19: onboarding storage rejection renders a recovery screen and does not alter local storage.

## Test results

- RED observed: missing policy module; missing paywall offering Retry/help; native dismissal called `onClose` during a pending purchase; Hub lacked sign-out confirmation and support modal.
- GREEN: `npx jest utils/__tests__/accountFlowPolicy.test.ts components/__tests__/HubScreen.test.tsx components/__tests__/PaywallModal.test.tsx components/__tests__/PremiumGate.test.tsx components/__tests__/SubscriptionProvider.test.tsx --runInBand --silent`
- Result: 5 suites passed, 55 tests passed.
- Owned diff whitespace check: `git diff --check -- <Task 3 files>` exited 0.
- Repository typecheck attempt: blocked by concurrent Task 1 red-phase test `services/__tests__/playerSearchSession.test.ts` importing the not-yet-created `services/playerSearchSession`; no Task 3 TypeScript diagnostic was reported.

## Gaps for integration verification

- Native Apple/Google authentication and store actions were not executed, per task constraints.
- VoiceOver/TalkBack, dynamic type at 200%, Android Back during a real store sheet, and 320-wide layout require the controller's simulator/device pass.
- No verified repository support contact exists. The help surface therefore stays fully useful in-app; external contact appears only when `EXPO_PUBLIC_SUPPORT_DESTINATION` is deliberately configured.
- Font loading errors remain handled by Expo Router's existing error boundary; the new launch recovery specifically covers the audited onboarding storage rejection.

## Fix round 1 after independent review

- Converted every visible paywall card, label, price, feedback, action, and progress state to current Arena palette/type roles. The Subscribe control now uses one `palette.action` surface with `palette.actionInk`, eliminating the broken light-page gradient contrast captured in `/tmp/puckiq-ux-paywall.jpg`.
- Added button/radio roles, labels, selected/disabled/busy state, and 48-point minimum targets to close, plan, Subscribe, help, and restore controls.
- Replaced all probability/forecast and generic analytics sales claims with the exact current gates: `Fantasy Projections` and `My Team`. Paywall and gate consume one shared policy.
- Added inline Retry for thrown, empty, and unpriced offerings.
- `ArenaHeader` now records an allowlisted Settings origin from Tonight, Following, Players, or League; Settings uses it only as the cold-entry fallback when native history is unavailable.
- Settings auth buttons show provider-specific progress text and indicators and expose busy/disabled accessibility state. Thrown provider launches recover inline.
- In-app help now directly opens Subscription options or Tonight. Configured external support failures render inline instead of rejecting silently.
- Launch recovery uses Arena surface/ink/action roles and semantic header/alert roles.
- Removed the root static notification import. Android Expo Go is the only skipped runtime because Expo Notifications throws during module evaluation there; iOS Expo Go and installed/development builds retain lazy notification initialization. No remote delivery claim changed.

### Fix-round tests

- RED observed for stale Pro copy, missing plan/control accessibility state, empty offering retry, source-origin mapping, auth progress, help recovery actions, and Android Expo Go notification import suppression.
- `npx jest utils/__tests__/accountFlowPolicy.test.ts utils/__tests__/runtimeCapabilities.test.ts --runInBand --silent --forceExit`: 2 suites passed, 7 tests passed.
- `npx jest components/__tests__/HubScreen.test.tsx --runInBand --silent --forceExit`: 1 suite passed, 25 tests passed.
- `npx jest components/__tests__/PaywallModal.test.tsx --runInBand --silent --forceExit`: 1 suite passed, 10 tests passed before the final shared-policy copy rename; the renamed literal is covered by `accountFlowPolicy.test.ts`.
- A later combined Paywall/PremiumGate invocation remained CPU-bound in the shared `ts-jest` transform for over 80 seconds without reporting a test result and was terminated. The controller owns the clean frozen full gate.
- Final scoped `git diff --check` exited 0.
# Narrow Task 1 round-2 follow-up

- Added `disabled={isLoading}` to both paywall plan controls so their touch behavior matches the published accessibility disabled state during purchase/restore.
- Extended the deferred transaction regression to assert both plan controls are actually disabled. The focused PaywallModal suite passed as part of the 4-suite round-2 run (41/41 tests).
