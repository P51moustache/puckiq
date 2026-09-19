# PuckIQ — Arena Club UX audit and prototype

[Open the Penpot file](https://design.penpot.app/#/workspace?team-id=c514c1fb-1cda-8125-8008-a13ef69bae1f&file-id=d8ac01df-6646-81d2-8008-a14503e28fce&page-id=85d394a9-7232-5dcd-b0ba-0c2a2709c84c) · [Start the prototype](https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a14503e28fce&page-id=20cecc8d-0359-5055-861f-cf534493f05d&section=interactions&frame-id=847edb16-7283-5f69-9b51-65585f9cb541&index=105)

Created in Penpot following the requested platform switch. Seven pages separate current evidence, proposed behavior, clickable scenarios and implementation handoff. No Figma artifact was created.

Evidence captured 2026-09-12T22:55:37.525Z; commit `7dde1799dedb6997c440ef6d9c1a65d41720d55f`; branch `codex/arena-club-native`. The current dirty checkout was inspected read-only. Full source fingerprints and captured git status are in evidence.json. App code, git state, credentials, native projects and production data were not changed.

## Coverage matrix

| Item | Mapped / created | Verification | Remaining work |
|---|---:|---|---|
| Route files | 9 + 2 layouts | Source inspected | Native/platform walkthrough |
| Current surface groups | 28 / 28 | Source inspected, mapped | Faithful visual coverage of every conditional surface |
| Shared state patterns | 19 | Named screen inheritance | Rendered combinations and native gestures |
| JSX interaction sites | 281 | Extracted callbacks, source IDs, outcomes or exclusions | Full per-control/per-state semantics; normalize native dialogs and generated controls |
| Route-reachable sites | 158 | Conservative import graph | Import reachability does not prove each export renders |
| Other sites | 123 | Legacy/infrastructure exclusion recorded | Reconcile any dynamic runtime entry points |
| Findings | 20 | Source-grounded | Reproduce in current bundle |
| Proposed states | 53 definitions / 106 team variants | Native Penpot links; sampled traversal | Preset inputs, model drafts and store selection are not fully interactive |
| Usability tasks | 11 | Scripts supplied | Participant sessions not performed |
| App controls runtime-verified | 0 | One read-only iOS paywall observation only | Android, accessibility, native sheets, text scaling, narrow layouts |

The audit is broad, but **not a certification that every rendered control and state has been fully validated**. Raw JSX counts include callback bindings, exits and repeated entity templates. Read individual status and exclusion fields before treating an item as active functionality.

## Prototype verification

- The native seven-page archive imported successfully. Text shaping was corrected and visually checked with Teko and DM Sans.
- 1,206 reaction bindings resolve to valid destinations or previous-screen actions. Bounds checks passed. These include separate text/hit-area reactions, so the count is not unique buttons.
- Walked first launch, Edmonton selection, forecast context, save/result, remove/undo, player search/watchlist/return, Boston home switch, team comparison/back stack, AI provenance, model draft cancel/keep/save, simulated sign-in, purchase cancellation, restore/no entitlement, unavailable alerts, offseason subscription access, failed restore/retry and failed save/retry.
- The walkthrough caught misleading account and selected-plan labels; final labels identify scenario context and the example monthly plan.
- All consequential outcomes are simulated. Search uses one example query/result; model weights are a preset draft; only Boston and Edmonton demonstrate home identity. App account, store and storage state are not continuously simulated.
- Penpot viewer caveat: switching flows occasionally hid body text until the viewer was reloaded at the destination frame. Direct launch and normal onboarding button transitions were visually verified. Use the supplied launch link if a flow switch renders blank.
- Failure starting points are in the viewer's flow menu. Page 03 contains further shared-state specifications. Future permission-denial support is backend-blocked.
- Reviewed 414px boards. Responsive 320–375px implementation, Dynamic Type, VoiceOver/TalkBack and reduced-motion settings remain untested. No participant usability testing occurred.

## Prioritized findings

### F01 · P1 · Search closes after the first character

handleSearchChange sets isSearchActive=false for length<2. The active TextInput exists only inside the isSearchActive branch. Normal one-character typing unmounts it.

Source: app/(tabs)/players.tsx:229. Surfaces: S11.

Recommendation: Keep search UI active until explicit Cancel. Debounce results independently; show a two-character hint.

Acceptance: Type C then o without tapping Search again; keyboard and query remain; deletion to one character keeps input; cancel restores prior list.

### F02 · P1 · Watchlist journey cannot be completed for an arbitrary player

Watch toggle exists on elevated leader rows, while search results, leader hero and detail lack it. Following reads only a count and sends users to general Players.

Source: components/ElevatedPlayerRow.tsx:50; components/PlayerDetailModal.tsx:110; app/(tabs)/following.tsx:104. Surfaces: S03, S08, S10, S11, S12.

Recommendation: Use one watch action on every player detail and a watched-player collection in Following; keep search and ranking independent of ability to follow.

Acceptance: Search any valid player, watch, close, find in Following, reopen, unwatch; removed player can be restored with Undo.

### F03 · P1 · Watch toggle can report a save that failed

State toggles before storage write; catch only logs and does not roll back. No busy serialization or accessible state announcement.

Source: components/ElevatedPlayerRow.tsx:62. Surfaces: S10.

Recommendation: Centralize watch storage and serialize writes; rollback on failure, keep visible Retry and pressed-state label.

Acceptance: Simulate failed write and concurrent taps; all rows/count agree with persisted IDs and no false success remains.

### F04 · P1 · Active model language does not explain Arena forecast provenance

League says review the model behind your forecasts and adjust weights. ModelList activates local weights; Arena reads stored ML forecasts. Current model picker with synthetic AI entry is unreachable from route graph.

Source: app/(tabs)/stats.tsx:115; components/model-builder/ModelList.tsx:61; services/arenaData.ts:120. Surfaces: S06, S13, S16, S17.

Recommendation: Separate Published PuckIQ AI from My models. Explicitly explain which model produced each displayed number and where local experiments apply.

Acceptance: Change local weights; published probability and source stay unchanged and UI explains why. AI detail is read-only; local edit is labeled experimental.

### F05 · P1 · Authentication failures disappear from the journey

Provider stores error and returns false; neither onboarding nor Settings renders the error. Settings also renders Apple on Android, where the handler only alerts unsupported platform.

Source: components/auth/AuthProvider.tsx:116; components/HubScreen.tsx:78; components/arena/ArenaOnboarding.tsx:20. Surfaces: S01, S22, S28.

Recommendation: Render inline provider-specific failure with Retry/Continue as guest; reflect busy state; show Apple only where available.

Acceptance: Simulated cancelled, missing-token, network and expired-session returns have distinct outcomes; inputs/context retained; Android has valid providers only.

### F06 · P1 · Native dismissal bypasses model draft protection

Editor Cancel asks to discard unsaved changes, but parent Modal.onRequestClose directly clears the editing model.

Source: app/(tabs)/models.tsx:163; components/model-builder/ModelEditScreen.tsx:144. Surfaces: S17.

Recommendation: Route all exits through the same draft guard; allow Keep editing and deliberate Discard.

Acceptance: Change a weight, press Android Back, tap Cancel and interrupt editor; each preserves draft until explicit discard or successful save.

### F07 · P1 · Support control has no action

Pressable labeled Support has no onPress or link destination. Transaction recovery cannot reach help.

Source: components/HubScreen.tsx:271. Surfaces: S22.

Recommendation: Provide a supported contact/help destination with offline fallback. Show support from store errors as well.

Acceptance: Support opens a real destination; failed/open-cancel returns to origin; offline shows copyable help details. Product must supply support destination.

### F08 · P1 · Return paths lose the entry context

Team detail always pushes League, even from Following; Settings always pushes Home; Preview/Book are internal state with no return stack; Models lacks dedicated exit.

Source: app/(tabs)/teams.tsx:43; components/HubScreen.tsx:153; components/arena/TonightScreen.tsx:202. Surfaces: S06, S07, S14, S16, S22.

Recommendation: Use origin-aware back with safe fallback and preserve list/query/selection/scroll. Use one Game detail destination opened from Home or Book.

Acceptance: Following→team→Back returns Following at same row; Book→game→Back returns Book; cold links have explicit safe fallback; no repeated back-push loops.

### F09 · P1 · Failures masquerade as empty player data

Feed fetch failure logs only; search errors set []; detail error has no retry; failed team-list load silently finishes. Search responses have no generation guard.

Source: app/(tabs)/players.tsx:181; app/(tabs)/players.tsx:245; components/PlayerDetailModal.tsx:148; components/TeamHeadToHead.tsx:167. Surfaces: S10, S11, S12, S15.

Recommendation: Separate loading/empty/error/stale; retain query and prior list; explicit Retry; ignore outdated requests.

Acceptance: Two out-of-order searches show latest query only. Offline never says No players found. Retry reuses query; closing detail returns unchanged results.

### F10 · P1 · Saved card removal is immediate and unrecoverable in UI

Trash writes removal directly. A saved prediction is immutable; re-saving later cannot recreate the original timestamp and forecast.

Source: components/arena/SeasonBook.tsx:212; services/seasonBook.ts:89. Surfaces: S07.

Recommendation: Confirm removal or offer timed Undo retaining the original snapshot; choose one consistent pattern.

Acceptance: Remove and Undo restores exact forecast/version/publication/savedAt, not a fresh snapshot; failed delete leaves card and retry.

### F11 · P1 · Missing final scores can leak into Season Book

Book uses isFinalGame then interpolates away_score/home_score without finite-score guard. Home archive separately filters invalid scores.

Source: components/arena/SeasonBook.tsx:177. Surfaces: S07.

Recommendation: Reuse explicit final-score availability semantics on every saved result.

Acceptance: Final game with null, absent or invalid score shows Final score unavailable with freshness; 0 is displayed as valid.

### F12 · P2 · Historical data UI promises a download it never performs

Banner and replay CTA say download; dialog only counts stored games. Models checks current season while dialog counts all seasons. Progress state is never populated.

Source: app/(tabs)/models.tsx:139; components/DataSeedingModal.tsx:79; components/model-builder/BacktestPanel.tsx:336. Surfaces: S16, S20, S21.

Recommendation: Rename to Check replay data; scope check to selected season/range; report availability and freshness, not transfer progress.

Acceptance: An old season cannot enable replay for an empty requested season; retry never implies download; result says Available records.

### F13 · P2 · Store recovery and dismissal need a coherent outcome contract

Offering load failure has no inline Retry; restore is only in paywall; setup failure shows Retry setup. Visual close is disabled during transaction but Android request-close is not.

Source: components/PaywallModal.tsx:103; components/PaywallModal.tsx:193; components/HubScreen.tsx:134. Surfaces: S22, S23, S24.

Recommendation: Keep Subscription, Restore, and Help visible regardless of games; distinguish setup/offerings/entitlement errors; preserve pending status across return.

Acceptance: No-games and stale-feed states can reach Subscription. Missing prices disable purchase only. Cancel returns safely; failed restore can retry; pending entitlement never shows Pro until confirmed.

### F14 · P2 · Some advertised Pro features are not gated in current routes

Paywall lists ML predictions, custom models and forecast history; Arena previews/book and model route have no PremiumGate. Current gates cover selected player sections and My Team.

Source: components/PaywallModal.tsx:32; app/(tabs)/models.tsx:151; components/arena/GamePreview.tsx:22. Surfaces: S06, S16, S23, S24.

Recommendation: Define the entitlement matrix, then describe actual incremental value. Audit proposes no arbitrary new restriction.

Acceptance: For guest/free/premium, every offered feature has a documented policy and matching UI; never sell disabled remote alerts.

### F15 · P2 · Legacy secondary screens break Arena Club continuity

Player detail, model editor, paywall and roster still use dark legacy surfaces/type and hardcoded accent colors. Primary tabs use home-team roles.

Source: components/PlayerDetailModal.tsx:16; components/PaywallModal.tsx:196; app/(tabs)/models.tsx:24. Surfaces: S12, S16, S17, S19, S21, S23, S24, S25, S26, S27.

Recommendation: Apply Arena paper/ink/action tokens and Teko/DM Sans to secondary surfaces; keep opponent identity local; semantic states independent of team color.

Acceptance: Switch home team then visit all secondary surfaces; readable home identity persists; no decorative palette clashes; enlarged type does not clip.

### F16 · P2 · Roster draft and failure states are ambiguous

Roster initializes state from props once, searches last name despite by-name label, hides failures, cannot save an empty roster and discards via Cancel without guard. Route has no in-app entry.

Source: components/RosterBuilder.tsx:41; components/RosterBuilder.tsx:105. Surfaces: S25, S26.

Recommendation: Decide whether fantasy roster belongs in Following; reset draft on open with explicit preservation rules; show save failure; clarify empty/delete semantics.

Acceptance: Reopen changed roster correctly; search documented fields; failed save retains draft with Retry; dirty close asks; empty action is explicit.

### F17 · P2 · Local data ownership is unclear when switching accounts

Book/watch/team preferences use device-wide keys. Signing out does not clear them. userSync is a one-time migration service with no current route/provider caller found.

Source: services/seasonBook.ts:4; components/ElevatedPlayerRow.tsx:18; components/auth/AuthProvider.tsx:105. Surfaces: S01, S07, S08, S10, S22.

Recommendation: Explain On this device. Decide account-scoped migration separately; do not promise cloud sync. Provide explicit choice before any future merge.

Acceptance: Account A→guest→B does not claim B owns A’s data or that it was synced; sign-out message describes retained local data.

### F18 · P2 · Accessible action meaning and recovery are inconsistent

Several icon-only controls lack accessibilityLabel; watch uses testID only; Compare clear icons have no team/slot label; League refresh icon looks actionable but is not.

Source: components/ElevatedPlayerRow.tsx:119; components/PlayerDetailModal.tsx:129; components/TeamHeadToHead.tsx:125; app/(tabs)/stats.tsx:133. Surfaces: S05, S08, S10, S11, S12, S13, S15, S17, S23.

Recommendation: Use explicit action+entity labels, checked/selected/busy semantics, 44pt iOS/48dp Android targets, visible refresh CTA and consistent reduced-motion behavior.

Acceptance: VoiceOver/TalkBack can identify every icon and state; keyboard/focus return works; 200% type and 320-wide layouts retain actions. Runtime verification required.

### F19 · P2 · Launch storage failure can leave a blank app

onboardingComplete starts null; AsyncStorage getItem only has then; rejection leaves AppContent returning null.

Source: app/_layout.tsx:27. Surfaces: S01.

Recommendation: Render recoverable initialization error with Retry and explain any guest fallback; preserve stored data.

Acceptance: Reject onboarding read and font/session setup in isolated test environment; useful recovery appears instead of blank screen.

### F20 · P3 · Cold-link and notification routing remain partially unverified

Entity query routes exist with validation. Referral handler and notification-response listener have no current consumer. OAuth callback uses auth session, but no callback route exists.

Source: services/referrals.ts:9; services/notifications.ts:338; components/auth/AuthProvider.tsx:152. Surfaces: S06, S12, S14, S15, S27, S28.

Recommendation: Document one deep-link resolver with safe fallback and origin; test cold/warm/auth-interrupted launches before claiming support.

Acceptance: Invalid and legacy entity links recover; supported notification opens correct entity; unsupported referral clearly recovers; OAuth callback completes without not-found flash.

## Implementation order

1. Fix search lifecycle and arbitrary-player watchlist journeys, including write failure feedback.
2. Separate AI provenance from personal models; protect saved forecast/result truth and deletion recovery.
3. Normalize return origins, draft guards, authentication feedback and fetch/store recovery.
4. Reconcile Pro gates and claims, supply Support, then align secondary screens with Arena Club.
5. Validate native platforms and accessibility before enabling backend-dependent alerts or expanding account sync.

## Product decisions

- Which features are truly Pro-only?
- Should My Team become discoverable or be retired?
- Should local data remain device-wide, or move to account-scoped storage through an explicit migration?
- What is the verified Support destination?
- What source-age policy and backend-readiness checks govern forecasts and alerts?

## Usability task scripts

Use 5–8 representative fans, including fantasy and non-fantasy users. Ask them to think aloud. Record first click, completion, backtracks and interpretation of data freshness. Do not explain where a control is. Start each task using its named flow.

- **J01 First launch to useful Home** — Choose a team and explain what determines the app colors. Success: Home and selected team are clear; guest path works.
- **J02 Forecast to saved result** — Find the model and publication context, save the card, revisit its result. Success: Can distinguish saved forecast from result and return to Book.
- **J03 Find and watch a player** — Search a player, watch them, find the saved player, then return to search. Success: Watching works independently of ranking and has a discoverable destination.
- **J04 Following and home identity** — Change home team without losing a watched player. Success: Palette changes; follows and navigation context remain.
- **J05 League and comparison** — Open a team, choose opponent and compare the same season. Return to origin. Success: Can explain snapshot age and return without losing selected team.
- **J06 Model provenance and draft** — Inspect AI, adjust a personal model, cancel then keep editing and save. Success: Understands personal weights do not change AI; draft guard works.
- **J07 Account and purchase cancellation** — Sign in, inspect options, cancel a simulated purchase, return to Settings. Success: No false Pro success; restore stays discoverable.
- **J08 Offseason and unavailable feed** — Without games, find something useful and locate subscription restore. Success: Watchlist/Book alternatives and restore discoverable.
- **J09 Recovery** — Recover from feed failure and a failed save. Success: Retry retains context; original stored data preserved.
- **J10 Restore, expiry and denial** — Find restore after expiry, retry failure, understand unavailable alerts. Success: No unavailable alerts sold; meaningful recovery.
- **J11 Destructive actions** — Remove and undo a saved card. Success: Original immutable snapshot is restored.

## Current surfaces

### S01 Launch and onboarding

Entry: First launch, incomplete local onboarding flag

Controls: Team picker; guest start; Apple on iOS; Google

Current: Success writes completion flag; false auth result stays; thrown error gives alert

Exit: No back; authentication can cancel. Local flag read rejection has no UI recovery

Source: app/_layout.tsx; components/arena/ArenaOnboarding.tsx. Status: code-inspected; runtime unverified

### S02 Home / current slate

Entry: Visible Home tab, /?game= optional

Controls: Shared header; Home/Preview/Book; refresh; poster; games; archive; year guide

Current: Schedules refresh on focus/resume timer; retained data on failure

Exit: Tab destinations; internal sections do not have a native back stack

Source: components/arena/TonightScreen.tsx. Status: code-inspected; runtime unverified

### S03 Home / offseason and preseason

Entry: Feed-informed season or explicitly labeled calendar fallback

Controls: Build watchlist; Your teams; Season book; next game; year guide

Current: Watchlist CTA routes to general Players feed; not a watched-player list

Exit: Home tabs remain; Settings independent of games

Source: components/arena/SeasonHub.tsx. Status: code-inspected; runtime unverified

### S04 Home / playoffs

Entry: Selected phase playoffs with series data

Controls: Horizontal series game rows

Current: Opens selected game, fetches full context

Exit: Game Preview section; phase guide does not change actual season

Source: components/arena/PlayoffSeries.tsx. Status: code-inspected; runtime unverified

### S05 Game poster front/back

Entry: Featured game when rendered

Controls: Flip/back; Save/Saved; open preview (two entry controls)

Current: Finite flip with reduced-motion handling; save immutable snapshot

Exit: Flip back; Preview changes Home section

Source: components/arena/GamePoster.tsx. Status: code-inspected; runtime unverified

### S06 Game Preview

Entry: Home section or valid game deep link

Controls: Try again; Save to season book

Current: Current regular-season context; unconfirmed goalie profiles; publication/source times; forecast change if comparable

Exit: Home/Season book segment or tab; no dedicated return-to-origin

Source: components/arena/GamePreview.tsx. Status: code-inspected; runtime unverified

### S07 Season Book

Entry: Home internal section; local storage

Controls: Open saved card; Remove; inherited refresh

Current: Snapshot retained; results fetched separately; removal immediate

Exit: Home/Preview section; no undo for removal

Source: components/arena/SeasonBook.tsx. Status: code-inspected; runtime unverified

### S08 Following

Entry: Visible tab

Controls: Browse players; team detail; Follow/Unfollow ×32; Make home where eligible

Current: Local team writes serialized; busy; alert on error; home fallback on unfollow

Exit: Tabs; team-detail Back to League loses Following origin

Source: app/(tabs)/following.tsx. Status: code-inspected; runtime unverified

### S09 Home-team picker

Entry: Shared header or onboarding

Controls: Search; choose team ×32; close

Current: Choosing unfollowed team follows then selects home; busy and error alert

Exit: Close or Android request-close; iOS pageSheet gesture unverified; no search-empty copy

Source: components/arena/ArenaPrimitives.tsx. Status: code-inspected; runtime unverified

### S10 Players feed

Entry: Visible tab

Controls: Search opener; PTS/G/A/SOG; refresh; player cards/rows; limited watch toggles; Pro gates

Current: Leaders, trends, goalie profiles and conditional projections; top-level failures console-only

Exit: Tabs; detail closes into existing list

Source: app/(tabs)/players.tsx. Status: code-inspected; runtime unverified

### S11 Players search

Entry: Search opener

Controls: Input; clear/close; result row

Current: 300ms debounce; <2 characters sets search inactive and unmounts input; failed request becomes empty results

Exit: Clear exits search; no distinct Cancel label; outdated results can race

Source: app/(tabs)/players.tsx. Status: code-inspected; runtime unverified

### S12 Player detail

Entry: Player row or ?player=validID

Controls: Close; native request-close

Current: Skater/goalie branches; loading/error; no Watch action or inline retry

Exit: Full-screen modal close; query context retained by parent

Source: components/PlayerDetailModal.tsx. Status: code-inspected; runtime unverified

### S13 League standings

Entry: Visible League tab

Controls: Standings/Compare; pull refresh; Models; team rows

Current: Dated standings snapshot; loading/empty/error; refresh icon is decoration

Exit: Tabs; hidden model route has no dedicated return control

Source: app/(tabs)/stats.tsx. Status: code-inspected; runtime unverified

### S14 Team detail

Entry: Hidden /teams?team=ABBR; Following or League

Controls: Compare this team; Back to League; shared header

Current: Loads newest standings snapshot; invalid/missing/error notes

Exit: Pushes League regardless of entry origin; no direct retry

Source: app/(tabs)/teams.tsx. Status: code-inspected; runtime unverified

### S15 Team compare

Entry: League Compare or ?teamA=&teamB=

Controls: Choose team from grid; clear A/B; inherited League switcher

Current: Requires two distinct teams; snapshot comparison; loading/error

Exit: Clear/reselect is retry workaround; empty + PICK TEAM slots are noninteractive

Source: components/TeamHeadToHead.tsx. Status: code-inspected; runtime unverified

### S16 Models

Entry: Hidden route, linked from League

Controls: Activate card; Edit; Duplicate; Delete; new; refresh; data availability banner

Current: Local model selection; errors native alerts; Classic delete protected

Exit: Visible tabs only; no app header/back; does not control Arena ML forecasts

Source: app/(tabs)/models.tsx; components/model-builder/ModelList.tsx. Status: code-inspected; runtime unverified

### S17 Model editor

Entry: New or Edit

Controls: Name; Save; Cancel; preview expand; category collapse/reset; factor slider; reset all; replay

Current: Name 2–50 chars; draft weights; save error alert; onscreen Cancel protects unsaved edits

Exit: Outer Modal Android request-close bypasses editor discard confirmation

Source: components/model-builder/ModelEditScreen.tsx. Status: code-inspected; runtime unverified

### S18 Duplicate model dialog

Entry: Duplicate action

Controls: Name; Duplicate; Cancel; backdrop

Current: Copies local model; empty-name alert; errors alert; no busy guard

Exit: Cancel/backdrop/native request-close; inner no-op Pressable is backdrop interception

Source: components/model-builder/ModelList.tsx. Status: code-inspected; runtime unverified

### S19 Factor help dialog

Entry: Info beside factor

Controls: Close; backdrop; reset factor

Current: Range/default/current; reset writes draft weight and closes

Exit: Backdrop/close/native request-close; labels and slider accessibility need runtime check

Source: components/model-builder/WeightSlider.tsx. Status: code-inspected; runtime unverified

### S20 Replay and live preview

Entry: Model editor panels

Controls: 30 days / 3 months / season; Run replay; Compare vs Classic; data prompt

Current: Replay is four-factor historical subset; reports progress/results/error and invalidates on relevant weights

Exit: No explicit running replay cancel; editor can close

Source: components/model-builder/BacktestPanel.tsx; components/model-builder/LivePreview.tsx. Status: code-inspected; runtime unverified

### S21 Historical data availability

Entry: Models banner or replay prompt

Controls: Check Data/Retry; Skip/Cancel; Continue/close

Current: Only checks database count; never downloads; progress branch never populated

Exit: Close sets abort ref; UI labels still claim download/loaded

Source: components/DataSeedingModal.tsx. Status: code-inspected; runtime unverified

### S22 Settings

Entry: Hidden /hub via shared gear

Controls: Back; subscription setup/options; five disabled alert toggles; Apple/Google/sign-out; Support

Current: Remote alerts hard-disabled; subscription entry available without games; Support lacks handler

Exit: Back pushes Home; auth errors held in provider but not shown

Source: components/HubScreen.tsx. Status: code-inspected; runtime unverified

### S23 Subscription options

Entry: Global provider, Settings or feature gate

Controls: Monthly/Annual; Subscribe; Restore; close

Current: Real store prices only; loading/unavailable/error; cancelled/no-entitlement feedback; active result closes

Exit: Visible close disabled during action, native request-close not guarded; offering retry requires reopen

Source: components/PaywallModal.tsx. Status: code-inspected; runtime unverified

### S24 Premium gate

Entry: Conditional player sections or hidden My Team

Controls: View subscription options / Retry setup

Current: Child content dimmed with pointerEvents none; entitlement needed; unavailable setup status

Exit: Containing tabs/close remain; dark legacy styling

Source: components/PremiumGate.tsx. Status: code-inspected; runtime unverified

### S25 My Team legacy route

Entry: Hidden /myteam; no in-app navigation caller found; Pro gate

Controls: Add players; edit roster; refresh

Current: Fantasy roster/start-sit/weekly/waiver content; unavailable recommendations handled

Exit: Visible tab bar; roster opens modal

Source: components/MyTeamScreen.tsx. Status: code-inspected; runtime unverified

### S26 Roster builder

Entry: My Team Add/Edit, Pro path

Controls: Cancel; Save; Yahoo/ESPN; search; add/remove player

Current: Last-name search; local draft; cannot save empty roster; failed save logs only

Exit: Cancel/native close without discard; initial state not resynced to changed existing roster

Source: components/RosterBuilder.tsx. Status: code-inspected; runtime unverified

### S27 Unknown route

Entry: Invalid path, including unhandled referral path

Controls: Go to home screen

Current: Default themed error surface; Home link

Exit: Home link and root stack behavior; Arena style not adopted

Source: app/+not-found.tsx. Status: code-inspected; runtime unverified

### S28 Native alerts and external auth/store

Entry: Conditional action or legacy enabled notification setting

Controls: Native Apple consent; Google browser auth; store confirmation; OS permission; alert OK/Cancel/Delete

Current: Consequential actions not exercised; simulate all outcomes; no notification routing caller found

Exit: Provider cancellation and OS back vary; runtime verification blocked

Source: components/auth/AuthProvider.tsx; services/notifications.ts; services/subscription.ts. Status: code-inspected; runtime unverified


## State inheritance

- **ST01 Guest / signed-in / account switch** — S01, S08, S09, S22, S23, S24, S25, S26, S28. Guest browsing works. Account switch invalidates subscription identity and closes paywall. Local teams/watchlist/book persist by device, not account. Auth failure has no rendered message.
- **ST02 Free / premium / expired / identity unknown** — S10, S22, S23, S24, S25. Gate until entitlement confirmed; listener updates status. Model editor and Arena forecast are currently ungated. Do not imply all paywall-listed tools are exclusive.
- **ST03 First load / fonts / storage failure** — S01, S02, S07, S08, S09, S16. AppContent onboarding read lacks catch; blank app is possible. Arena team read failure ends spinner without notice. Book preserves invalid stored entries with error.
- **ST04 Loading / refreshing** — S02, S06, S10, S11, S12, S13, S14, S15, S16, S20, S21, S23, S25, S26. Per-surface spinners exist. Keep last successful content when safe; hide outdated per-entity detail. Loading source and origin must remain visible.
- **ST05 Offline / failed fetch / retry** — S02, S06, S07, S10, S11, S12, S13, S14, S15, S20, S21, S25, S26. Home retains schedule; preview has retry; Players/search failures become console/empty; detail requires reopen; compare requires reselection. Proposed shared explicit retry retains inputs.
- **ST06 Empty / no scheduled games** — S02, S03, S07, S10, S11, S13, S14, S15, S20, S25. Distinguish genuine empty, absent feed and query error. Settings remains independent. Empty book has instructions but no direct browse CTA.
- **ST07 Stale / unknown / unavailable source** — S02, S03, S05, S06, S07, S10, S12, S13, S14, S15. Source timestamps and missing data notes implemented in Arena views. Do not turn last-loaded data into live confirmation. Stale is inherited per source, not a global badge.
- **ST08 Offseason / preseason** — S02, S03, S05, S06, S10, S13. Calendar fallback is labeled. Preseason separated from regular-season totals. User guide selections are explanations, not season overrides.
- **ST09 Regular season / playoffs / incomplete series** — S02, S04, S05, S06, S07. Only known series games shown; no complete bracket assumption. No scheduled games may coexist with a live season.
- **ST10 Upcoming / live / final / missing scores** — S02, S04, S05, S06, S07. Home archive filters invalid finals. Season Book interpolates nullable scores for final games, so missing score may render as null. Must use explicit unavailable state.
- **ST11 Forecast absent / incomparable / saved after final** — S05, S06, S07, S16, S20. Save still captures card without prediction. Version/publication stored. Distinguish snapshot vs latest; never recompute historical expectation with a current model.
- **ST12 Player missing / goalie context unconfirmed** — S06, S10, S11, S12, S25. No fictional starter claims. Partial player context remains readable. Disabled recommendation and missing fantasy data are distinct from low projections.
- **ST13 Permission denied / alerts unavailable** — S22, S28. All five Settings toggles disabled by REMOTE_ALERTS_AVAILABLE=false; no current enabled toggle path. OS permission is only potential via notification service initialization when old enabled settings exist. Proposed unavailable explanation first; permission CTA only after backend supports delivery.
- **ST14 Store setup / offering unavailable** — S22, S23, S24. Settings retry setup is separate from paywall offering errors. Offerings require priceString. Restore remains inside paywall even with missing offerings, but setup failure prevents opening it.
- **ST15 Purchase / cancel / failed / pending entitlement** — S23, S28. Cancelled returns feedback; no entitlement advises Restore; active refreshes and closes. Interrupted action native close diverges from disabled visual close.
- **ST16 Restore / no entitlement / expired** — S22, S23, S24, S28. Restored closes; no active entitlement informs; errors render. No renewal management or actionable support entry in current Settings.
- **ST17 Invalid / unavailable entity deep link** — S02, S06, S10, S11, S12, S13, S14, S15, S27. /?game; /players?player; /teams?team; /stats?teamA&teamB; legacy /stats?game or team redirects. Invalid IDs produce text recovery; arbitrary routes go to not-found. OAuth callback is external protocol path without route file; native return unverified.
- **ST18 Save / remove / unsaved draft / interrupted action** — S07, S08, S09, S11, S17, S18, S19, S23, S26. Book save serialized; remove has no undo. Home-team switch may partly follow before failing. Watch optimistic state has no rollback. Native model dismiss bypasses discard guard.
- **ST19 Resume / account return / text scale / reduced motion** — S01, S02, S05, S08, S09, S10, S17, S22, S23, S28. Home refreshes at resume and 60s while active; team provider refreshes at resume. Player data lacks equivalent focus refresh. Reduced motion implemented for poster/season guide, not all legacy animations. iOS and Android native behavior remains untested.
