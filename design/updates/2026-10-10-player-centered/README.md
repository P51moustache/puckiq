# Player-centered dark update candidate

PuckIQ now brings player details, saved lineup plans, and personal insights into the dark red visual direction approved in the concepts. The candidate is running in the PuckIQ Test iPhone simulator.

Branch: `codex/player-centered-dark-update`. Local changes are uncommitted. No remote push, OTA publication, App Store upload, or submission was performed. Existing marketing and design work was preserved.

## Concept coverage

| Requested direction | Implemented behavior |
| --- | --- |
| Fading player portrait | NHL headshot fades into charcoal, faint jersey number, name and team, fallback when an image fails. |
| Compact player stats | GP, goals, assists, points and shots/game tiles; goalie-specific stats. |
| Season projection | Remaining scheduled regular-season games and pace/form estimates, with the calculation basis available from the estimate information control. Goalies include estimated starts. |
| Stats as graphs | Selectable points/goals/assists/shots/fantasy graphs and goalie saves/SV%/GA graphs. Tap a bar for game details. Signed values share a zero baseline; missing save percentage remains unknown. |
| Upcoming schedule assessment | Four upcoming opponents in the overview, all five in Schedule, with cyan favorability stars and an explanation control. Schedule tab chooses the saved plan's game date. |
| Bottom player action | Persistent add-to-team or starters/bench action, date, availability/IR/lock states, and fantasy-host handoff text. |
| Unified best lineup | Slot/player/value rows, a compact 14-day date picker, best-versus-saved comparison, fixed bottom apply action, bench choices, coaching, gaps linked to pickups, and host link. |
| Insights | Roster coaching, trending players, real credited news, waiver targets, trade tools, and generated cinematic hockey footer. |
| Dark mode and red highlights | Shared near-black/charcoal surfaces, readable light text, normal name casing, red selections and actions, native dark status/sheet/tab treatment. |
| Player-centered navigation | Home, Players, Lineup, Insights, More. Week, Pickups, League and Settings remain reachable. |

## Gaps filled to make the concept functional

- Lineup choices persist per team and date through the existing team store. Imported rosters are not presented as imported host starting assignments.
- Eligibility, IR and scratched players constrain the solver. Invalid or removed player choices are reconciled; malformed persisted choices are discarded.
- Full starting slots offer an eligible starter swap. Applying the optimizer saves the exact suggested starts and sits. Restoring automatic recommendations affects only the selected date.
- Editing checks the actual clock again at action time, including alert callbacks. A conservative whole-day lock begins at the first puck drop, even if a feed still marks that game future.
- Remaining games come from the club's actual season schedule. Prior-season pace tempers early-season samples; recent form contributes only with sufficient games.
- Opponent assessments use defense for skaters and offense for goalies. Missing strength data stays unknown.
- Fantasy game-log values disclose missing hits/blocks when those weights apply. Waiver availability and goalie start probabilities remain explicitly estimated.
- Existing roster search/import, league rooms, scoring settings, Pro restrictions, recent form, NHL EDGE, full game logs, injury controls, widgets, notifications and live scoring remain in their existing flows.

## Verification

| Check | Result |
| --- | --- |
| TypeScript | Passed: `npm run typecheck`. |
| Full Jest suite | 97 suites, 906 tests passed. |
| Lint | 0 errors, 198 warnings; warnings remain to be cleaned up separately. |
| Native simulator build | Signed Debug iOS simulator build succeeded. Installed and launched with the existing team data retained. |
| Production JavaScript export | iOS Hermes production bundle exported successfully. This is separate from a distribution archive. |
| Manual simulator checks | Optimizer apply, saved-plan comparison, player bench/start actions, persistent choices across reload, metric switching, chart game tooltip, schedule date selection, and Insights tabs checked. |

New behavior coverage includes eligibility conflicts, IR/scratch reconciliation, bounded date history, corrupted persistence, late-lock timing, scoring estimates, opponent direction, incomplete goalie data, signed chart scale, Pro gates, and player/lineup integration.

The first unsigned simulator build produced an Expo notifications keychain entitlement error. Rebuilding with simulator signing corrected it; the signed session launched cleanly. RevenueCat has no key in this local preview, so purchasing was not exercised.

## Compact refinement, October 11

The player overview now fits the fading portrait, season stat tiles, insight, season estimate, selectable graph, four upcoming games, and bottom action in the initial simulator viewport. The full schedule, estimate basis, rating explanation, additional game logs and related players remain accessible.

The optimizer uses 44-point player rows with larger names, visible chevrons, and full-row detail links. Ten starters fit in the first best-lineup view; the others remain in the same list. Apply lineup and the host handoff stay fixed above the tabs. The Edit my lineup tab exposes labeled Start and Bench controls. Selecting a future date was checked in the simulator, and a regression test proves that applying that date does not replace today's saved choices.

Insights uses four initial 44-point trend rows, an expandable twelve-player list, three compact horizontal action rows, generated art behind the featured insight, and the same generated hero art below. All three action rows fit in the initial viewport; the footer artwork follows them. Shared headers, cards, buttons, chart controls, and typography follow the concept's compact treatment and charcoal/red/cyan colors.

The iOS tab bar caps the bottom inset at 12 points, reducing the extra margin. The lineup footer follows the actual tab height. The tested NHL portrait is already a transparent RGBA PNG; shared framing trims its embedded empty space and makes faces fill the roster and trend tiles without generating replacements.

Current JavaScript was loaded through Metro into the existing signed simulator app, and all three compact screens were visually inspected. The production Hermes bundle was re-exported after these changes. Checks at the earlier density pass: TypeScript passed, 96 Jest suites / 898 tests passed, lint has 0 errors / 198 warnings, and `git diff --check` passed. Logs: `/tmp/puckiq-compact-typecheck.log`, `/tmp/puckiq-compact-tests.log`, `/tmp/puckiq-compact-lint.log`, `/tmp/puckiq-production-export.log`.

Latest raw simulator captures:

- [Compact player overview](compact/player.png)
- [Compact lineup and reduced tab padding](compact/lineup.png)
- [Compact Insights and generated art](compact/insights.png)

The older screenshots below preserve the previous, more spacious implementation for comparison.

### Readability adjustment

Compact body text, labels, controls, table rows, and navigation labels were increased by one point. Player name and headline stat values received the same small increase. Minor player-card spacing and chart-height adjustments preserve the full four-game overview schedule in the initial viewport. This earlier pass retained all 13 lineup starters in the first view. The later usability pass below gives player rows more space for easier tapping. The 12-point bottom tab inset is unchanged.

Player, Lineup, and Insights were visually checked in the simulator again and the compact captures above were refreshed. TypeScript and all 898 tests pass; lint remains at 0 errors / 198 warnings, and the production iOS export was refreshed. Earlier typography check logs use `/tmp/puckiq-type-nudge-*`; the latest usability checks appear below.

### Insights and optimizer usability adjustment

The primary tabs on these two pages have 44-point targets. Lineup and trend rows now show larger names, stronger press feedback and chevrons. Start/Bench buttons replace the tiny plus/minus icons, the plan tab is labeled Edit my lineup, and the date control and reset action are easier to tap. The compact player page and reduced tab inset retain their previous sizing.

Insight action tiles became wide 76-point rows with explicit Details links. A detail sheet shows the full explanation and every affected player; choosing a player waits for the native insight sheet to dismiss before presenting that player's card. The sheet also links to the optimizer or pickup finder. Waiver card and detail copy share the same measured schedule assessment, and Pro visibility remains enforced.

Native checks verified the eight-player group insight, selecting Jack Hughes from that group, the single-goalie detail sheet, Review my lineup navigation, opening Nathan MacKinnon from the lineup list, and the enlarged date control. These checks did not change the roster or saved player choices. Best-lineup and edit-tab layouts were visually inspected. All 97 suites / 906 tests pass, TypeScript passes, lint remains 0 errors / 198 warnings, `git diff --check` passes, and the production iOS export was refreshed. Latest logs use `/tmp/puckiq-usability-*` and `/tmp/puckiq-production-export.log`.

Latest review captures:

- [Readable best lineup](compact/lineup.png)
- [Labeled lineup editing](compact/lineup-edit.png)
- [Readable Insights](compact/insights.png)
- [Full group insight](compact/insight-details.png)

## Screenshots

- [Player overview](screenshots/player-overview.png)
- [Final simulator screen with the starter restored](screenshots/player-final.png)
- [Player graphs](screenshots/player-stats.png)
- [Player schedule](screenshots/player-schedule.png)
- [Lineup optimizer and actual saved-plan gain](screenshots/lineup-optimizer.png)
- [Personal insights](screenshots/insights.png)
- [News](screenshots/insights-news.png)
- [Generated artwork in the app](screenshots/insights-art.png)

These are raw simulator captures. The lineup gain screenshot was captured after deliberately benching McDavid; the starter choice was then restored. Week, Pickups, League and Settings links were also exercised in the simulator.

[Candidate manifest](candidate-manifest.json) records source/asset hashes, build paths and verification evidence.

## Simulator review

Device: PuckIQ Test iPhone, iOS 26.5, UDID `CE32BC5F-D3E7-4996-B622-9F2F575553C2`.
Bundle: `com.zlce.hockeystats`.
Native app: `/tmp/puckiq-player-update-build/Build/Products/Debug-iphonesimulator/PuckIQ.app`.

The preview uses the existing Top Shelf roster with 16 sample players and 5 previously added players. No team data was cleared. The game day and clock are pinned for a useful pre-lock review, and Pro is enabled for preview only:

```sh
EXPO_PUBLIC_DEV_PRO=1 EXPO_PUBLIC_DEV_DATE=2026-10-13 EXPO_PUBLIC_DEV_NOW=2026-10-13T17:00:00Z npx expo start --dev-client --port 8081
xcrun simctl openurl CE32BC5F-D3E7-4996-B622-9F2F575553C2 'puckiq://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'
```

Release builds ignore the development Pro/date/clock overrides. Player, schedule and news requests use the existing live services and caches; these are not generated concept statistics.

## Release gates

This is a review candidate. Pro purchase/restore, physical-device scrolling and performance, notification/widget/live-game behavior, small-screen and large-text acceptance still require device testing. Simulator automation did not establish swipe behavior, so no touch-scroll acceptance is claimed.

Pace projections are estimates that assume availability, not a trained prediction service. NHL/host availability can lag news, and users still need to check current injuries and goalie starters. Category leagues rank using their derived scoring weights rather than optimizing each category independently. The plan is local to PuckIQ; applying actual host roster changes remains the user's host workflow.

Before shipping: review this candidate visually, run the device/store checks, choose the release version/build, make a distribution archive, and refresh the store screenshots/release notes. The app version has not been bumped from 3.2.0.

[Artwork prompt and provenance](art-provenance.md) records the generated asset used by the app.
