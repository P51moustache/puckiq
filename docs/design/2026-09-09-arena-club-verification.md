# Arena Club native verification

Verified 2026-09-09 on branch `codex/arena-club-native`, based on `fix/ci-tests-cleanup-2026-06` at `3d593ec`.

## Implemented

The approved illustrated Arena Club direction now runs in the native app. Tonight has a game poster, raised controls, a finite card flip and a saved-card stamp. Game Preview replaces Shot Lab with team comparisons, goalie season numbers, special teams and comparable forecast changes. Season Book stores immutable game/forecast snapshots on the device and shows current results separately; cards captured after a final are labeled accordingly.

Following controls all 32 team palettes and the persisted home-team choice. Players, League, Settings and onboarding use the shared Arena typography and colors. Existing player detail, models, comparisons, authentication and notification settings remain reachable. Fictional skater art is unbranded and rendered with neutral equipment; real player portraits retain player identity.

## Verification results

- `npx tsc --noEmit && npm test -- --runInBand --silent`: passed, 110 suites, 1,701 tests passed, 1 skipped.
- `npm run lint`: exit 0; 94 warnings, 0 errors. The prior baseline was 96 warnings.
- `npm ci --dry-run --ignore-scripts`: passed after reconciling the SDK 57 lockfile with normal peer resolution.
- `git diff --check`: passed.
- SDK 57 iOS JavaScript bundle: successful; Metro returned `packager-status:running` on the LAN URL.
- Scratch SDK 57 native prebuild and CocoaPods installation: successful, 125 pods. The scratch directory was removed afterward to recover disk space.
- Independent implementation review: material findings fixed for future-game labeling, selected-team schedule coverage beyond the first 64 games, safe preference reads, 44-point home selection, Android safe areas and Settings inset spacing.

Behavior tests cover readable palette pairs for all 32 teams, first-follow/default behavior, saved selection, removal fallback, external favorite mutations, serialized writes, failed reads/writes, immutable saves, malformed storage, real probability validation, model comparability, NHL date boundaries and future versus current game labels.

## Native interaction checks

Expo Go 57.0.9, iPhone 17 Pro Max simulator, 440 × 956 points:

- Selected Edmonton through the team picker; the full palette and featured matchup changed.
- Selected Boston; the full gold/black palette and featured Boston matchup changed. Returned to Edmonton afterward.
- Flipped the featured card, opened the correct game preview and read the actual matchup data.
- Saved the Edmonton–Anaheim card; reloaded the app and confirmed both the home team and stored card survived.
- Opened Tonight, Following, Players, League and Settings; checked headers, safe-area spacing and the real standings snapshot label.
- Confirmed the CLI account with `npx expo whoami`: `zlce`. Restarted Metro online so Expo Go can discover the development session under that account.

The active server at handoff is `exp://192.168.4.34:8082`, started with `npx expo start --go --port 8082`. Phone and Mac must share a reachable network. This address lasts only while the Mac/server/network remain available.

## Runtime upgrade and release limits

The user's installed Expo Go required SDK 57; the project previously used SDK 54. Expo packages, React 19.2.3, React Native 0.86.3 and the required worklets peer were aligned. Navigation imports now use Expo Router's SDK 57 exports. The worklets native module has a matching Jest mock.

Required native runner changes were compared with a scratch prebuild and selectively ported. The directory, package name, Expo slug, scheme, app identifiers and existing version values were preserved. Unrelated existing native lock/workspace/privacy files were left untouched.

**The iOS minimum is now 16.4**, up from 15.1, because of the SDK upgrade. This changes store compatibility and must be included in release planning. No complete Xcode or Android release build, physical Android check, purchase flow, push delivery test or store submission was performed. Expo Go uses RevenueCat's preview/browser mode and has push-notification limitations.

The connected feed currently has no upcoming games and its latest standings snapshot is May 4, 2026. The app labels archived games and snapshot dates. Goalie season statistics are not represented as confirmed starters. The existing audit's data refresh, notification delivery, premium access and secondary-screen work still needs to be addressed before claiming the product is ready to sell.

## Running-app captures

- [Tonight — Edmonton](screenshots/arena-club/tonight-edmonton.png)
- [Tonight — Boston](screenshots/arena-club/tonight-boston.png)
- [Season Book](screenshots/arena-club/season-book.png)
- [Following](screenshots/arena-club/following.png)
- [Players](screenshots/arena-club/players.png)
- [League](screenshots/arena-club/league.png)
- [Settings](screenshots/arena-club/settings.png)

These are captures of the real native app and its connected feed, not the HTML concept. A blue floating gear visible in some captures belongs to Expo Go's developer tools.

## Typography correction

A follow-up native check reproduced cropped cap tops with Teko's forced line heights. The bundled font has a native ascent/descent total of 1.433em; the previous ~1.05em line boxes clipped glyphs on iOS. Display labels now use native line metrics. Two-line poster/onboarding headlines retain complete native text boxes and tighten only the unused interline space via `ArenaHeadline`. The font asset and selected design are unchanged.

Verified the card front, card back and Game Preview in Expo Go after a full reload. TypeScript and the complete Jest suite still pass (110 suites, 1,701 passed, 1 skipped); focused ESLint and diff checks pass. [Corrected poster](screenshots/arena-club/typography-fixed-poster.png) · [Corrected card back](screenshots/arena-club/typography-fixed-card-back.png).
