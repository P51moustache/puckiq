# Implementation Log

## Cycle 8 Sprint Summary — YourTeamCard Removal + StatOfTheNight Redesign (2026-02-07)

Two focused changes to the Tonight screen: removed YourTeamCard component entirely, and redesigned StatOfTheNight with a cinematic hero-number treatment.

### Change 1: YourTeamCard Removal

**Rationale**: YourTeamCard duplicated information already available in HeroBanner's YOUR TEAM badge. Removing it simplifies the scroll depth and eliminates redundant state logic.

**Files Deleted:**
- `components/YourTeamCard.tsx` (242 lines) — Component file deleted
- `components/__tests__/YourTeamCard.test.tsx` — Test file deleted

**Files Modified:**
- `app/(tabs)/index.tsx` — Removed YourTeamCard import, `yourTeamGame` / `yourTeamIsHero` / `filteredRemainingGames` / `yourTeamPrediction` / `yourTeamConfidence` computed values, `handleShareYourTeam` callback, JSX render block, and `isYourTeam` prop from HeroBanner. Simplified `featuredGames`/`compactGames` to use `remainingGames` directly. 442 → 397 lines (-45 lines).

**Impact**: `isYourTeam` prop still exists on HeroBanner/HeroMatchup interfaces (optional `?` prop) but is no longer passed. YOUR TEAM badge on hero simply won't appear. No breaking changes.

### Change 2: StatOfTheNight Redesign

**Rationale**: Original was a plain text card with purple accent. Redesigned to be a visually distinct "hero number" card that pulls the leading stat number into large 42px mono typography, adds team logo and team-color accent stripe.

**Files Modified:**
- `components/StatOfTheNight.tsx` — Complete redesign. Added `extractHeroNumber()` helper that regex-matches patterns like "5 points", "4-game streak", etc. New layout: team color 4px left border, team logo (20x20) in top-right via expo-image, "STAT OF THE NIGHT" label chip, hero number (42px mono bold), context text (13px subtext), share button (bottom-right). Card: 16px border-radius, subtle shadow, minHeight 120. React.memo wrapped. 151 lines.
- `components/__tests__/StatOfTheNight.test.tsx` — Updated with 2 new tests: hero number extraction ("5" from "5 points in his last 2 games") and no-number fallback rendering. Now 7 tests total (was 5).

### Build Health

- **Tests**: 70 suites, 1131 passing, 0 failures (after Jest cache clear — stale YourTeamCard reference resolved)
- **TypeScript**: Pre-existing GameDeepDiveModal type errors only (not introduced by this sprint)
- **Status**: GREEN

---

## Cycle 7 Build Summary (In Progress)

The Hero Zone — Replaced the old compact header + HeroMatchup with a cinematic HeroBanner component featuring bundled photo backgrounds, PuckIQ branding, and matchup overlay. Restructured the Tonight screen layout with new content zones: PlayerSpotlightCarousel, CompactGameRow, StandingsWidget. Added useHaptics hook and TeamFormData type. Hero photo selection uses daily rotation (day-of-year modulo 8) from 8 bundled arena photos (`assets/images/topimages/image1-8.jpg`).

### Files Created (Cycle 7)

1. **`components/HeroBanner.tsx`** (470 lines) — Cinematic hero zone component. 4-layer architecture: (1) Background photo from bundled HERO_IMAGES array with 35% opacity via expo-image, (2) Gradient overlay (LinearGradient with 3-stop dark-to-opaque), (3) Team color tint (subtle diagonal gradient), (4) Content layers. Branding bar with "PuckIQ" wordmark + tagline + date + SettingsButton. Matchup zone with optional YOUR TEAM badge, auto-generated headline, team logos (48x48 via NHL CDN), team abbreviations, probability percentages (32px mono font), VS divider with ConfidenceBadge (lg). Game time (with LIVE state). Bottom insight chips bar on frosted BlurView (H2H record, B2B/REST, streak) + TOP EDGE label + share button. Spring press animation via Reanimated `useSharedValue`/`withSpring`. Photo selection: `dayOfYear % 8` for daily rotation, stable per session via `useMemo([])`.

2. **`components/PlayerSpotlightCarousel.tsx`** (221 lines) — Horizontal FlatList of tonight's top players. Builds spotlight players from `playerStatsMap` sorted by points. Cards show team logo, player name, G/A/P stats. Team color gradient accent (LinearGradient). FadeInRight staggered entry animation. Links to Explore tab for full player list.

3. **`components/CompactGameRow.tsx`** (186 lines) — Condensed single-row game card for "Also Tonight" section (games beyond the top 2 featured). Shows team logos, abbreviations, probability split, ConfidenceBadge, game status (time/live/final with score). FadeInUp staggered entry. Haptic feedback on press (expo-haptics). Team color left accent border.

4. **`components/StandingsWidget.tsx`** (244 lines) — Division standings table showing user's favorite team's division. Gets division teams from standings data. Team logos, W-L-OTL-PTS columns, selected team row highlighted. Links to Explore tab. FadeInUp entry.

5. **`hooks/useHaptics.ts`** (31 lines) — Haptic feedback hook. Exposes `tap` (Light impact), `press` (Medium impact), `success` (notification), `selection` (selection feedback). Platform-aware: only fires on iOS/Android. Used by HeroBanner and CompactGameRow.

6. **`types/teamForm.ts`** (14 lines) — TypeScript interface `TeamFormData`: `teamAbbrev`, `results` (last-10 as W/L/OTL array), `wins`, `losses`, `otLosses`, `streak` string. Used by HeroBanner, AllGamesCard, HeroMatchup for team form indicators.

### Files Modified (Cycle 7)

1. **`app/(tabs)/index.tsx`** — Restructured from 299 to 442 lines. Now imports HeroBanner (not yet wired as hero replacement -- still uses HeroMatchup). Added: PlayerSpotlightCarousel, CompactGameRow, StandingsWidget, InsightFeed sections. New layout: Compact header (with team logo, date, headline, settings, last-updated time) > LiveNowBar > YourTeamCard > HeroMatchup > StatOfTheNight > PlayerSpotlightCarousel > "More Games" (first 2 AllGamesCards) > StandingsWidget > "Also Tonight" (CompactGameRows) > EdgeSpotlight > InsightFeed > EmptyNightCard. Added share handlers for games, insights, and your team. Added `filteredRemainingGames` split into `featuredGames` (first 2) and `compactGames` (rest). Added `heroSituationalFactors` computed from restMap.

### Assets Activated (Cycle 7)
- `assets/images/topimages/image1.jpg` through `image8.jpg` — 8 bundled hockey arena/atmosphere photos. Previously unused, now `require()`'d by HeroBanner for daily rotation background.

### Test Files (Cycle 7)
- `hooks/__tests__/useHaptics.test.ts` — useHaptics hook tests

---

## Cycle 6 Build Summary

The Personal Terminal — Tonight Tab Overhaul. Implemented Option B (Bold). Streamlined scroll depth by ~60%, removed 3 redundant sections, compacted header with auto-generated editorial headlines, added favorite team personalization, merged HotPlayers + EdgeIntel into EdgeSpotlight, added team logos via NHL CDN, extracted useTonightData hook reducing index.tsx from 744 to 299 lines (60% reduction), added factor split indicators on AllGamesCards, promoted game insights to bold team-colored text, fixed 4 dead interactions. 10 new files, 4 modified files. 35 new tests (1004 total passing). Zero regressions.

### Files Created (Cycle 6) — 10 files

1. **`devData/sampleGames.ts`** (165 lines) — Dev-only sample NHL game data shaped like `/v1/score/{date}` response. Includes SampleTeam, SampleGame, SampleGamesResponse types. Multiple game states (FUT, LIVE, FINAL, OFF). Used via `__DEV__` fallback when NHL API is unavailable.

2. **`hooks/useTonightData.ts`** (566 lines) — Extracted from index.tsx. Owns all Tonight screen state: NHL/Edge API data fetching, predictions (win probability), derived stats (momentum, clutch, rest), H2H records, insight generation, headline generation, model management (load/switch/toast), refresh logic. Returns `TonightData` interface with 30+ properties.

3. **`components/YourTeamCard.tsx`** (242 lines) — Favorite team personalization card. Team color gradient background (LinearGradient), 24x24 team logo (expo-image), opponent info, probability, ConfidenceBadge, game time formatting (future/live/final). Shows when selectedTeam is playing tonight. FadeInUp entry animation.

4. **`components/EmptyNightCard.tsx`** (192 lines) — Enhanced empty state for no-game nights. Shows favorite team's logo, standings position (division rank, conference, W-L-OTL, PTS), next game (opponent + date/time), and motivational message. Falls back to generic message when no team selected.

5. **`components/EdgeSpotlight.tsx`** (278 lines) — Merged replacement for HotPlayersSection + EdgeIntelSection. Horizontal FlatList of spotlight items: tonight's hot players (sorted by points, max 3) + Edge leaders (hardest shot, fastest skater from landing data). Max 5 items total. Each card shows team logo, player/stat label, value, team color accent. FadeInRight staggered entry. "See all" link to Explore tab.

6. **`components/ModelPickerModal.tsx`** (133 lines) — Modal overlay for switching prediction models. Lists all available models with active checkmark. Transparent overlay with dark background. Cancel button. Fires `onModelSwitch` callback.

7. **`components/Toast.tsx`** (37 lines) — Simple toast notification. Positioned at bottom of screen. Shows message text on dark card background. Null guard (returns null when no message). Used for model switch confirmation.

8. **`utils/headlineGenerator.ts`** (263 lines) — Tonight's Headline auto-generator. `generateTonightHeadline(games, standings, h2hMap, momentumMap)` produces editorial one-liner. Priority cascade: Rivalry ("Original Six Showdown") > Division ("Divisional Battle Night") > Revenge (team that lost H2H series) > Streak (5+ game streak) > Rest Mismatch > Momentum (hot team) > Game Count Default. Target <50 chars, max 60.

9. **`utils/teamLogo.ts`** (7 lines) — `getTeamLogoUrl(abbrev)` returns NHL CDN SVG logo URL: `https://assets.nhle.com/logos/nhl/svg/{abbrev}_light.svg`. Compatible with expo-image SVG rendering.

10. **`devData/__tests__/sampleGames.test.ts`** + **`utils/__tests__/headlineGenerator.test.ts`** + **`hooks/__tests__/useTonightData.test.ts`** + **`components/__tests__/YourTeamCard.test.tsx`** + **`components/__tests__/EmptyNightCard.test.tsx`** + **`components/__tests__/ModelPickerModal.test.tsx`** + **`components/__tests__/EdgeSpotlight.test.tsx`** — 7 new test files, 35 tests total.

### Files Modified (Cycle 6)

1. **`app/(tabs)/index.tsx`** — Complete rewrite from 744 to 299 lines (60% reduction). Now a thin render shell: imports `useTonightData()` hook for all state/logic, renders compact header (date + auto-headline + model pill + settings gear), YourTeamCard (if playing), HeroMatchup, LiveNowBar, AllGamesCards (with factor splits + bold insights + team logos), EdgeSpotlight, EmptyNightCard. ModelPickerModal + Toast overlays. Removed: QuickStatsBar, HotPlayersSection, EdgeIntelSection, InsightFeed, StatOfTheNight, StandingsSnapshot, all inline data fetching/state.

2. **`components/AllGamesCard.tsx`** — Added factor split indicators (MTM/REST/H2H colored dots below probability bar). Added team logos (24x24 via getTeamLogoUrl). Promoted game insight text from 11px italic to bold team-colored text. Fixed dead `onPress` interaction.

3. **`components/HeroMatchup.tsx`** — Added team logos (24x24) next to team abbreviations.

4. **`components/GameDeepDiveModal.tsx`** — Silenced Supabase game_results error spam in dev logs.

### Test Results (Cycle 6)
- **35 new tests** across 7 test files
- **1004 total tests passing** (66 suites, 59 passing)
- **7 pre-existing failing suites** (19 tests) — all teamComparison-related, NOT introduced by Cycle 6
- **Zero regressions** from Cycle 6 changes

### Sections Removed from Tonight Screen
- StatOfTheNight — redundant with InsightFeed (insights inline on game cards)
- StandingsSnapshot — moved to Explore tab
- InsightFeed standalone — insights now inline on AllGamesCards
- QuickStatsBar — absorbed into compact header
- HotPlayersSection — merged into EdgeSpotlight
- EdgeIntelSection — merged into EdgeSpotlight

### New Sections on Tonight Screen
- Compact header with date, auto-generated headline, model picker pill, settings gear
- YourTeamCard — favorite team personalization (shows when team is playing)
- EdgeSpotlight — merged HotPlayers + EdgeIntel horizontal scroll
- EmptyNightCard — enhanced empty state with team info

---

## Cycle 5 Ops Fixes

### Blocking Issues Fixed (6/6)
1. **GameDeepDiveModal.tsx**: `fetchTeamEdge(homeAbbrev)` passed string abbreviation but function expected `teamId: number`. Fixed by extracting `homeTeamId`/`awayTeamId` from `game.homeTeam.id`/`game.awayTeam.id` and passing those instead.
2. **GameDeepDiveModal.tsx**: ZoneTimeChart called with wrong prop names (`offensivePct`/`neutralPct`/`defensivePct` → `offPctg`/`neutPctg`/`defPctg`).
3. **GameDeepDiveModal.tsx**: MomentumSparkline received `MomentumData` object as `data` prop. Fixed by destructuring: `data={momentum.history} trend={momentum.trend} teamAbbrev={abbrev}`.
4. **InsightFeed.tsx**: `getTeamColors(insight.teamAbbrev)` failed because `teamAbbrev` is now optional. Fixed with nullish coalescing: `insight.teamAbbrev ?? ''`.
5. **derivedStats.ts**: Replaced 5 `any` types with typed interfaces (`StandingsResponse`, `StandingsEntry`, `ScheduleGame`). Made `gamesPlayed`, `goalFor`, `goalAgainst` optional with `?? 0` fallbacks.
6. **insightGenerator.ts**: Replaced 6 `any` types with typed interfaces (`ScheduleGame`, `StandingsEntry`, `StandingsResponse`). Updated `generateInsights`, `generateStreakInsights`, `generateStandingsInsights`, `getTodayTeamAbbrevs` signatures.

### Advisory Issues Deferred (7)
1. GameDeepDiveModal at 2003 lines (major refactor)
2. `game: any` and `prediction: any` props on GameDeepDiveModal (pre-existing)
3. No `useCallback`/`useMemo` in Edge tab render (performance, not correctness)
4. Edge cache has no max size (acceptable for mobile)
5. Hardcoded season '20252026' in fetchGameResults (low priority)
6. Supabase `.or()` string interpolation (pre-existing from Cycle 2)
7. No integration tests for Edge IQ tab (components tested individually)

---

## Cycle 5 Build Summary
The Analytics Engine — Integrated NHL Edge IQ tracking data (shot speed, skating speed, zone time, shot location) and derived stats (momentum index, clutch rating, rest advantage, xG approximation) across the entire app. 4 phases: Foundation (types + services), Core UI (6 new components), Integration (9 existing files wired), Polish (MEMORY updates). 82 new tests across 8 test suites, all passing.

### Files Created (Cycle 5)
- `types/edgeStats.ts` — TypeScript interfaces for all Edge API responses (~250 lines). Key types: SkaterEdgeDetail, TeamEdgeDetail, GoalieEdgeDetail, EdgeByTheNumbers, EdgeSkaterLanding, EdgeGoalieLanding, EdgeTeamLanding, ShotLocationZone, ZoneTimeDetail, SpeedStat, DistanceStat, MomentumData, ClutchRating, EdgeQuickStats, DerivedTeamStats
- `services/edgeStats.ts` — Edge API client with 5-min in-memory cache, generic `fetchEdge<T>()`. 8 endpoint functions for landing + detail data.
- `services/derivedStats.ts` — Derived stat calculations: `calculateMomentum` (5-game rolling, -10..+10), `calculateClutchRating` (CLUTCH/CLOSER/ICE COLD), `calculateRestAdvantage` (0-100), `calculateXGApprox`, `buildEdgeQuickStats`
- `components/SpeedGauge.tsx` — Speed display with animated count-up, percentile bar, league avg comparison
- `components/MomentumSparkline.tsx` — SVG sparkline with trend arrow, compact (80x24) and full modes
- `components/ClutchBadge.tsx` — Performance badge (CLUTCH=#22c55e, CLOSER=#eab308, ICE COLD=#94a3b8)
- `components/ZoneTimeChart.tsx` — Stacked horizontal bar (green=off, gray=neutral, red=def) with zone labels
- `components/ShotLocationMap.tsx` — Half-rink SVG with 17 zones, hot/cold coloring, tap tooltip
- `components/EdgeIntelSection.tsx` — 2x2 grid of Edge stat cards with FadeInUp stagger animation
- `services/__tests__/edgeStats.test.ts` — 16 tests: mock fetch, cache TTL, error handling, JSON parse failures
- `services/__tests__/derivedStats.test.ts` — 34 tests: momentum (9), clutch (7), rest (8), xG (6), quickStats (4)
- `components/__tests__/SpeedGauge.test.tsx` — 6 tests
- `components/__tests__/MomentumSparkline.test.tsx` — 6 tests
- `components/__tests__/ClutchBadge.test.tsx` — 4 tests
- `components/__tests__/ZoneTimeChart.test.tsx` — 6 tests
- `components/__tests__/ShotLocationMap.test.tsx` — 6 tests
- `components/__tests__/EdgeIntelSection.test.tsx` — 6 tests

### Files Modified (Cycle 5)
- `app/(tabs)/index.tsx` — Added Edge API calls parallel with NHL calls, derived stat computation useEffect, EdgeIntelSection between HotPlayers and InsightFeed. QuickStatsBar gets edgeStats, HeroMatchup gets momentum+clutch, AllGamesCard gets momentum+rest, StandingsSnapshot gets momentumMap.
- `app/(tabs)/stats.tsx` — Added 'edge' segment with EdgeContent component (Season Leaders, Last Game Night, Team Edge Rankings)
- `components/QuickStatsBar.tsx` — Edge-aware: shows top shot speed, momentum, rest edge when Edge data available. `value` changed from number to string.
- `components/AllGamesCard.tsx` — Added momentum arrows and rest icons inline with team names
- `components/HeroMatchup.tsx` — Added MomentumSparkline row + ClutchBadge row below probability arc
- `components/StandingsSnapshot.tsx` — Added MTM column with momentum arrow and color coding
- `components/HotPlayersSection.tsx` — Cards enlarged to 160x150, shows "Last 5" stats and shot speed from Edge data
- `components/GameDeepDiveModal.tsx` — Added Edge IQ tab with: Shot Speed comparison, Skating Speed, Zone Time, Momentum sparklines, Clutch badges, Shot Quality table
- `services/insightGenerator.ts` — Added EdgeInsightData interface, generateEdgeInsights(), edge insights prioritized first in feed
- `services/gameResults.ts` — Added `fetchGameResults()` for current season results from Supabase
- `types/insights.ts` — Added 'edge' category, made teamAbbrev optional
- `components/__tests__/QuickStatsBar.test.tsx` — Updated value expectations from number to string

### Test Results (Cycle 5)
- **82 new tests** across 8 new test suites, all passing
- **183 total** Edge-related tests passing (including pre-existing modified component tests)
- 5 pre-existing test failures unrelated to Edge changes (backtesting, realDataBug, categoryWinner variants)

---

## Cycle 4 Ops Fixes

### CEO Bug Fix: ConfidenceBadge TOSS-UP on Every Card
- **Root Cause**: `ConfidenceBadge` tier thresholds (LOCK >=85, STRONG >=70, LEAN >=55) were calibrated for a 0-100 range, but the confidence formula `Math.abs(homeWinProb - 50) * 2` produces scores of 0-64 for typical NHL games (55-82% probabilities). This meant almost every game fell into TOSS-UP.
- **Fix**: Lowered thresholds to LOCK >=70, STRONG >=45, LEAN >=20, TOSS-UP <20.
  - `components/ConfidenceBadge.tsx`: Updated `getTier()` thresholds
  - `components/__tests__/ConfidenceBadge.test.tsx`: Updated boundary test expectations
- **Result**: 74% → STRONG, 73% → STRONG, 66% → LEAN, 59% → TOSS-UP, 52% → TOSS-UP. Tiers now distribute meaningfully.

### Advisory Fixes
- **QuickStatsBar.tsx**: Replaced invalid `'hockey-puck'` Ionicons glyph with valid `'ellipse'`. Removed conflicting `width: '100%'` from container style (conflicts with `marginHorizontal: 16`).
- **index.tsx**: Wrapped `.json()` calls in `loadNHLData()` with individual try-catch blocks (lines 140, 146). Added `logger.warn` for JSON parse failures.
- **index.tsx**: Removed `as any` cast on Skeleton `width` prop (Skeleton already accepts `string` width).

### Deferred Issues
- 22 `any` types (pre-existing NHL API response types undefined)
- StandingsSnapshot expand/collapse animation (visual polish)
- HOT badge format deviation (cleaner than spec's emoji format)
- Helper function unit tests (tested indirectly)

---

## Cycle 4 Rework (Execution)
**Reason**: Formatting broken after Intel Feed — InsightFeed cards overlapping StatOfTheNight and Standings sections. Text from insights bleeding/garbled into subsequent sections.

**Root Cause**: InsightFeed used `gap: 12` on its container combined with `FadeInUp` entering animations on each card. Reanimated's entering animations cause layout measurement to be deferred, so the parent container doesn't properly account for the animated children's height, causing subsequent sections to render overlapping.

**Fixes Applied**:
- `components/InsightFeed.tsx`: Removed `gap: 12` from container (replaced with `marginBottom: 12` on each card). Added `overflow: 'hidden'` on cards to prevent text bleed.
- `components/StatOfTheNight.tsx`: Added `overflow: 'hidden'` to container style.
- `components/StandingsSnapshot.tsx`: Added `overflow: 'hidden'` to container style.
- `app/(tabs)/index.tsx`: Added `width: '100%'` to InsightFeed wrapper (was missing, inconsistent with other sections).

**Verification**: Screenshot confirms Intel Feed cards render cleanly, Stat of the Night properly separated below, Standings section at bottom with correct formatting. All 22 affected tests pass.

---

## Cycle 4 Build Summary
The Full Terminal — Transformed Tonight screen from 3 sections (HeroMatchup, GameTicker, InsightFeed) to 8+ content zones. Implementing Option B (Bold). Created 6 new components: QuickStatsBar, LiveNowBar, AllGamesCard, HotPlayersSection, StatOfTheNight, StandingsSnapshot. Rewrote Tonight screen with full analytics terminal layout. GameTicker replaced by LiveNowBar (live games only) + AllGamesCard (full-width cards for every game). Added division battle detection, game-specific insights, and stat of the night selection. No new API calls — all data consumed from existing fetches.

### Files Created (Cycle 4)
- `components/QuickStatsBar.tsx` — Horizontal row of 3 stat pills (game count, close matchups, division battles) with Ionicons. FadeIn entry.
- `components/LiveNowBar.tsx` — Compact red-accented bar for LIVE/CRIT games only. Pulsing red dot via Reanimated withRepeat. FadeInDown entry. Returns null when no live games.
- `components/AllGamesCard.tsx` — Full-width vertical game card with team color left border (4px), probability bar, ConfidenceBadge, H2H chip, insight text. React.memo wrapped. FadeInUp staggered entry.
- `components/HotPlayersSection.tsx` — Horizontal FlatList of player cards (140x120). Top 2 scorers per team, sorted by points, capped at 5. HOT badge when goals/GP > 0.5. Team color top accent. FadeInRight staggered entry.
- `components/StatOfTheNight.tsx` — Bold single-stat card (24px text), purple accent border, share button. FadeInUp entry.
- `components/StandingsSnapshot.tsx` — Compact division leaders table. Collapsed: 1 team per division. Expanded: 3 per division. Team color dots, W/L/OTL/PTS columns. Toggle button.
- `components/__tests__/QuickStatsBar.test.tsx` — Tests for null guard, pill rendering, values, testID
- `components/__tests__/LiveNowBar.test.tsx` — Tests for null guard, LIVE/CRIT rendering, team display, testID
- `components/__tests__/AllGamesCard.test.tsx` — Tests for matchup text, game states, H2H, insight, testID
- `components/__tests__/HotPlayersSection.test.tsx` — Tests for null guard, player extraction, HOT badge, testID
- `components/__tests__/StatOfTheNight.test.tsx` — Tests for null guard, stat text, share button, label, testID
- `components/__tests__/StandingsSnapshot.test.tsx` — Tests for null guard, division rendering, standings toggle, testID

### Files Modified (Cycle 4)
- `app/(tabs)/index.tsx` — Complete rewrite of render section. Removed GameTicker import. Added 6 new component imports. Added helpers: `getDivisionBattles()`, `getInsightForGame()`. Added computed values via useMemo: `closeMatchups`, `divisionBattles`, `statOfTheNight`. New render order: Header → QuickStatsBar → HeroMatchup → LiveNowBar → ALL GAMES section → HotPlayersSection → InsightFeed → StatOfTheNight → StandingsSnapshot → Empty state.

### Analytics Events Added (Cycle 4)
- `stat_of_night_shared` — Share stat of the night. Params: `{ stat_id, category }`

### Dependencies Installed (Cycle 4)
None — all features built with existing stack.

---

## Cycle 3 Build Summary
The War Room — Complete rework of PuckIQ from picks tracker into analytics terminal. Implementing Option B (Bold). Deleted all pick-centric card components (TopPickCard, SmartPickCard, PickCard, LockOfTheDayCard, ConfirmPickModal, YesterdayResultsCard). Built three new component systems from scratch: HeroMatchup (cinematic hero game card with team color gradient split, ProbabilityArc, insight chips, share), GameTicker (horizontal scrollable game capsule strip), InsightFeed (vertical feed of shareable analytical nuggets). Created insightGenerator service to produce analytical insights from existing data. Rewrote Tonight screen (595 lines, down from 776). Restructured from 3 tabs to 2 (Tonight + Explore). Added Models segment to Explore tab. 13/13 tasks completed across 4 phases.

### Files Created (Cycle 3)
- `types/insights.ts` — Insight type definition (id, text, teamAbbrev, category, shareText)
- `services/insightGenerator.ts` — Pure function `generateInsights(games, standings, h2hMap, playerStatsMap?)` → `Insight[]`. Categories: H2H, streak, player, standings. Priority-sorted, capped at 10.
- `components/ProbabilityArc.tsx` — SVG semicircular probability gauge with Reanimated animated fill (600ms withTiming). Shows favored team % and abbreviation.
- `components/HeroMatchup.tsx` — Cinematic hero game card: LinearGradient team color split, ProbabilityArc, insight chips (H2H, B2B/REST, streak), TOP EDGE label, ConfidenceBadge, share button. FadeInDown entry.
- `components/GameTicker.tsx` — Horizontal FlatList of game capsules (140x72). Confidence dot, team names, probability micro-bar, 1-line insight. FadeInRight staggered entry.
- `components/InsightFeed.tsx` — Vertical list of insight nuggets with team color left accent (4px border), share button. FadeInUp staggered entry.
- `services/__tests__/insightGenerator.test.ts` — 31 tests (30 original + 1 ops streak filter)
- `components/__tests__/HeroMatchup.test.tsx` — 7 tests
- `components/__tests__/GameTicker.test.tsx` — 4 tests
- `components/__tests__/InsightFeed.test.tsx` — 4 tests

### Files Modified (Cycle 3)
- `app/(tabs)/index.tsx` — Complete rewrite as TonightScreen. Removed: all pick-centric state, lock-in flow, yesterday's results, pick saving, notification scheduling. Added: insight generation, player stats fetching, game sorting by edge strength (hero=top, ticker=rest). 595 lines.
- `app/(tabs)/_layout.tsx` — 3 visible tabs → 2 (Tonight + Explore). mypicks hidden.
- `app/(tabs)/stats.tsx` — Renamed to Explore, added 4th segment "Models" with lazy-loaded content.

### Files Deleted (Cycle 3)
- `components/TopPickCard.tsx` — Replaced by HeroMatchup
- `components/SmartPickCard.tsx` — Replaced by GameTicker
- `components/PickCard.tsx` — Replaced by GameTicker
- `components/LockOfTheDayCard.tsx` — Replaced by HeroMatchup
- `components/ConfirmPickModal.tsx` — Lock-in flow removed
- `components/YesterdayResultsCard.tsx` — Yesterday results removed

### Analytics Events Added (Cycle 3)
- `game_deep_dive_opened` — Tap hero or ticker capsule → deep dive. Params: `{ game_id, home_team, away_team, matchup, game_state }`
- `insight_shared` — Share insight from InsightFeed. Params: `{ insight_id, category, team }`
- `hero_shared` — Share hero matchup. Params: `{ matchup }`
- `model_switched` — Switch model via pill. Params: `{ model_id, model_name }`
- `explore_tab_changed` — Segment change in Explore tab. Params: `{ segment }`

### Dependencies Installed (Cycle 3)
None — all features built with existing stack:
- `react-native-svg` (15.12.1) for ProbabilityArc
- `react-native-reanimated` (4.1) for animations
- `expo-linear-gradient` for HeroMatchup gradient
- `@expo/vector-icons` for share icons

### Ops Fixes Applied (Cycle 3)
- **HeroMatchup.tsx**: Removed dead code — unreachable `else if (situationalFactors.awayBackToBack)` at lines 68-74
- **index.tsx**: Removed unused `favoriteTeam` state and `getFavoriteTeams` import — dead state that ran async on mount for no purpose
- **index.tsx**: Replaced `console.warn`/`console.error` with `logger.warn()`/`logger.error()` at 3 call sites
- **insightGenerator.ts**: Added `todayTeams` filter to `generateStreakInsights()` — streak insights now only show teams playing tonight
- **insightGenerator.test.ts**: Fixed OT streak test (BUF→NYR, a team in mockGames). Added new test: "filters out teams not playing today" (EDM, VGK excluded). 31 tests total.

---

## Cycle 2 Build Summary
MVP Prediction Companion implementing Option C (Scrappy) — Supabase game results with H2H season series, Key Player stats, enriched share cards, and companion positioning. Built gameResults service (Supabase seed/sync/H2H queries), playerStats service (NHL API with in-memory cache), SeasonSeriesBadge component. Integrated H2H badges on TopPickCard and PickCard. Rewrote GameDeepDiveModal H2H tab to use Supabase + added Key Players tab. Enriched share text with H2H summaries. Rewrote MISSION.md with companion positioning. 60 new tests across 3 test files. 14/14 tasks completed.

### Files Created (Cycle 2)
- `services/gameResults.ts` - Supabase game results: `seedCurrentSeason()`, `syncRecentResults()`, `getH2HRecord()`, `getH2HForGames()`, `formatH2HSummary()`
- `services/playerStats.ts` - NHL API player stats with in-memory cache: `getTeamPlayerStats()`, `getKeyPlayersForGame()`, `clearPlayerStatsCache()`
- `components/SeasonSeriesBadge.tsx` - Compact pill badge showing H2H season series (e.g., "TOR leads 3-1", "Tied 2-2", "First meeting")
- `types/gameResults.ts` - TypeScript interfaces: GameResult, H2HRecord, PlayerStatLine, GoalieStatLine, TeamPlayerStats, NHLNameField, NHLRawSkater, NHLRawGoalie, NHLScheduleGame
- `services/__tests__/gameResults.test.ts` - 31 tests: formatH2HSummary, getH2HRecord, getH2HForGames, seedCurrentSeason, syncRecentResults
- `services/__tests__/playerStats.test.ts` - 15 tests: cache clearing, stat fetching, name mapping, sorting, error handling, parallel fetching
- `components/__tests__/SeasonSeriesBadge.test.tsx` - 14 tests: getSeriesText variants, component rendering states

### Files Modified (Cycle 2)
- `components/TopPickCard.tsx` - Added `h2hRecord` prop + SeasonSeriesBadge rendering below time
- `components/PickCard.tsx` - Added `h2hRecord` prop + compact SeasonSeriesBadge rendering
- `app/(tabs)/index.tsx` - Added H2H state/fetch via `getH2HForGames()`, `syncRecentResults()` call, h2hRecord props to cards, subtitle changed to "Your Edge Before Every Pick"
- `components/GameDeepDiveModal.tsx` - Replaced NHL API H2H with Supabase `getH2HRecord()`, added Key Players tab with skater/goalie tables via `getKeyPlayersForGame()`
- `components/ShareableCard.tsx` - `sharePick()` now accepts `h2hSummary?` and appends it to share text + new tagline
- `_AI_COMPANY/MEMORY/MISSION.md` - Complete rewrite with companion positioning, new tagline, updated value props, v2.2.0

### Ops Fixes Applied (Cycle 2)
- **ShareableCard.tsx**: Added tagline "— Your Edge Before Every Pick" to `formatShareText()` (both pick and stat branches) and `shareStat()` — all 3 share text generators now consistent
- **GameDeepDiveModal.tsx**: Fixed `tab.id as any` → `tab.id as typeof activeTab` at line 1639
- **ShareableCard.test.tsx**: Updated 5 existing test expectations for new tagline, added 2 new tests for `sharePick()` with `h2hSummary` parameter — now 11 tests total (was 8)

---

## Cycle 1 Build Summary
Full persona-first app reorganization implementing Option B (Bold) — "Stats App, Day One". Restructured from 5 tabs (Today/Learn/My IQ + hidden Explore/Models) to 3 tabs (Today/Stats/My Picks). Created reusable ConfidenceBadge (LOCK/STRONG/LEAN/TOSS-UP) and ShareableCard components. Slimmed Today screen by removing 5 sections. Rewired My Picks to real pickTracking data. Added team comparison tool, stat tooltips, animated matchup reveals, and team color accents. 14/14 tasks completed across 4 phases.

### Files Created (Cycle 1)
- `constants/teamColors.ts` - 32-team NHL color map with `getTeamColors()` helper and `TeamColors` type
- `components/ConfidenceBadge.tsx` - LOCK/STRONG/LEAN/TOSS-UP pill badge with sm/md/lg sizes
- `components/ShareableCard.tsx` - Shareable card with Share API, `ShareButton` component, `sharePick()`/`shareStat()` helpers
- `app/(tabs)/stats.tsx` - Stats tab with Teams/Players/Factors segments, stat tooltips (10 advanced metrics), team comparison tool

### Files Modified (Cycle 1)
- `app/(tabs)/_layout.tsx` - 3 visible tabs (Today/Stats/My Picks), learn/myiq/explore/models/profile set to `href: null`
- `app/(tabs)/index.tsx` - Stripped from ~1,360 to ~740 lines. Removed: hero images, Weekly Theme Banner, Game Breakdowns, Power Rankings, Hot/Cold Streaks, StreakBadge, info modals. Added: Reanimated FadeInDown animations with staggered delay, favorite team color accent (left border), getTeamColors/getFavoriteTeams imports
- `app/(tabs)/mypicks.tsx` - Full rewrite. Wired to real pickTracking service
- `components/LockOfTheDayCard.tsx` - Replaced old confidence text with `ConfidenceBadge` + `ShareButton`
- `components/SmartPickCard.tsx` - Replaced old confidence text with `ConfidenceBadge` + `ShareButton`
- `components/PickCard.tsx` - Replaced old confidence text with `ConfidenceBadge`

### Ops Fixes Applied (Cycle 1)
- **mypicks.tsx**: Fixed 51 TS errors
- **index.tsx**: Fixed FavoriteTeam type error
- **ShareableCard.tsx**: Changed `catch (error: any)` to `catch (error: unknown)`
- **stats.tsx**: Added `useAnalytics('Stats')` screen name

### Tests Added (Ops — Cycle 1)
- `components/__tests__/ConfidenceBadge.test.tsx` — 13 tests
- `components/__tests__/ShareableCard.test.tsx` — 8 tests
- `constants/__tests__/teamColors.test.ts` — 36 tests
- **Total: 57 tests, all passing**

## Known Gaps
- `situationalFactors` always passed as `null` to HeroMatchup — B2B/REST chips never appear (requires wiring `calculateSituationalFactors()`)
- Missing "Tap for full breakdown" CTA text on HeroMatchup (spec item)
- Missing breathing glow animation for live games (static border only)
- Extensive `any` types on NHL API game/standings props (pre-existing pattern)
- Team comparison fetches live NHL API data on each team selection (no caching)
- Stat tooltips are static text, not wired to real-time data
