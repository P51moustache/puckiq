# Arena Club Native Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for isolated bounded work and keep shared-file integration in the primary agent.

**Goal:** Run the approved Arena Club experience in Expo, using persistent home-team themes, real game data, useful Game Preview, and a saved season book.

**Architecture:** A root Arena provider exposes one palette and followed-team state. Screens consume services and typed data; reusable native components render the poster/card flip, raised actions, team selector, and comparison views. Saved forecasts capture what the device actually knew when the user saved a game.

**Tech Stack:** Expo 57, React Native 0.86.3, TypeScript strict, Expo Router, AsyncStorage, existing Reanimated/SVG/Image packages, Supabase service layer.

**Spec:** docs/design/vision.md; docs/design/arena-team-palettes.json; accepted interactive Arena Club concept.

## Global Constraints

- Preserve `learning-project` name, slug, scheme, directory, native identifiers and existing versions.
- No Supabase calls in app/ or components/. No runtime NHL API calls.
- Support iOS and Android and run in the user’s current Expo Go. SDK 57 required aligned dependencies and the worklets peer (with a Jest mock). Generate native templates in a scratch directory, then selectively apply required changes; preserve identifiers and existing app versions.
- No fabricated live schedules, probabilities, goalie confirmations, history or player portraits. Label unavailable and stale data.
- All 32 active teams get complete palettes. First follow selects the initial home team; additional follows do not replace it. Removing it falls back to the earliest remaining team.
- Essential words remain readable; display imagery remains fictional unless identified accurately. A common monochrome illustration may be used for the generic game poster.
- Saved values are immutable; current results may be reconciled without replacing the saved forecast. Persist on device; do not claim cloud sync.
- Preserve secondary existing routes and capabilities while moving the visible navigation to Tonight, Following, Players, League. Settings remains reachable in the header.
- Run `npx tsc --noEmit && npm test`; inspect native screens and user interactions. Existing coverage thresholds are not a gate.

## Task 1: Team identity foundation

Files: constants/arenaTheme.ts, constants/arenaTeamPalettes.json, services/homeTeam.ts, services/teamFavorites.ts, components/arena/ArenaProvider.tsx, matching unit/provider tests.

Public interface:
```ts
interface ArenaPalette { hero:string; heroInk:string; action:string; actionInk:string; frame:string; frameInk:string; page:string; paper:string; soft:string; edge:string; ink:string; muted:string; link:string; focus:string }
interface ArenaTeam { abbrev:string; name:string; shortName:string; tokens:ArenaPalette }
// constants/arenaTheme.ts
getArenaTeam(abbrev:string): ArenaTeam | null;
getArenaPalette(abbrev?:string|null): ArenaPalette;
ARENA_TEAMS: readonly ArenaTeam[];
// components/arena/ArenaProvider.tsx
useArena(): { palette:ArenaPalette; homeTeam:ArenaTeam|null; followedTeams:FavoriteTeam[]; loading:boolean; chooseHomeTeam(abbrev:string):Promise<void>; followTeam(abbrev:string):Promise<void>; unfollowTeam(abbrev:string):Promise<void>; refreshTeams():Promise<void> };
```

- [x] Write behavior tests for 32 palettes/readable color pairs, neutral fallback, persisted choice, first-follow default, multiple follows retaining selection, removed-team fallback and failed writes.
- [x] Implement storage under `puckiq_home_team`, preserving existing `puckiq_favorite_teams`. Add a subscription for existing favorite mutations so all consumers update immediately.
- [x] Provide safe neutral context defaults for isolated component tests, and no import-time network access.
- [x] Run focused tests, then review the task diff before root provider integration.

## Task 2: Real game data and season book

Files: types/arena.ts, services/arenaData.ts, services/seasonBook.ts, hooks/useArenaGames.ts, tests.

- [x] Define game, standings, goalie, and forecast types. Verify actual schema and service return shapes before writing queries.
- [x] Test schedule ordering, home-team priority, null/missing forecasts, invalid probability values, data timestamps and upcoming/offseason states. Read games/standings/ML through a service, preserving error signals.
- [x] Use latest coherent standings snapshot and game-specific season for comparisons. Derive rate values from valid counts; do not use zero for missing rates.
- [x] Test first save, immutable forecast, removal, corrupt storage and concurrent saves. Store under `puckiq_season_book_v1` and expose subscriptions.
- [x] Display stored versus current estimates only when models/versions are comparable; record actual capture time. Reconcile game results by ID.

## Task 3: Native Arena game experience

Files: components/arena/ArenaButton.tsx, ArenaHeader.tsx, TeamPicker.tsx, GamePoster.tsx, GamePreview.tsx, SeasonBook.tsx, TonightScreen.tsx, app/(tabs)/index.tsx, app/_layout.tsx, app/(tabs)/_layout.tsx, assets/arena/.

- [x] Copy the approved artwork into project assets and bundle the display font. Generic art must remain unlabeled as a real player.
- [x] Implement the poster with readable GAME NIGHT / NEXT GAME / SEASON AHEAD states, team names, real time/date, and probability only when available.
- [x] Implement raised buttons, finite card flip, stamped save, reduced motion, screen reader labels and 44-point controls.
- [x] Connect Tonight / Game Preview / Season Book to the selected real game. Game Preview shows supported goalie/team data and honest missing states; no Shot Lab.
- [x] Test that changing team updates palette and featured-game selection, saving survives reload, all game rows open the correct game, and unsupported forecasts remain unavailable.
- [x] Integrate root provider and themed navigation/status bar while preserving native identifiers and versions. SDK 57 runtime compatibility changes are recorded in the verification report.

## Task 4: Cohesive primary navigation

Files: app/(tabs)/following.tsx, app/(tabs)/players.tsx, app/(tabs)/stats.tsx, app/(tabs)/hub.tsx and focused arena wrappers/components as needed.

- [x] Make Following useful for adding/removing teams and selecting home team while preserving existing watchlists.
- [x] Carry Arena headers, type, surfaces and team accents through Players and League, retaining player search/detail and standings/comparisons access.
- [x] Keep Settings, models and other secondary screens reachable with compatible route names.
- [x] Update onboarding's entry styling and remove any misleading sample-preview implication about running live data; preserve authentication and completion state.
- [x] Review tab navigation and key detail screens for visual cohesion and functional regressions.

## Task 5: Verification and handoff

- [x] Run typecheck and complete Jest suite; fix introduced lint warnings.
- [x] Launch the current project explicitly in Expo Go on the available simulator, test theme selection, card flip, Game Preview, season book, navigation and restart persistence.
- [x] Capture real app screenshots. Confirm the running Metro URL and expose it for the user's Expo Go device.
- [x] Perform an independent focused review of the branch; resolve material findings.
- [x] Commit only intended app/design/test/assets changes. Keep unrelated user files intact and do not publish or submit a store build.

## Runtime compatibility adjustment

The phone’s current Expo Go requires SDK 57. The app was upgraded from SDK 54, its navigation imports migrated to the Expo Router exports, and native runner changes compared against a scratch prebuild. The resulting iOS minimum is 16.4. Full iOS and Android release builds remain a separate release check; no store submission was performed. See [verification](../../design/2026-09-09-arena-club-verification.md) for measured results and limitations.
