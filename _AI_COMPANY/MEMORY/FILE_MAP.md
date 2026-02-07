# PUCK-IQ File Map

<!-- Archivist and Builder update this as files change -->
<!-- Last Updated: 2026-02-07 (Cycle 7 — The Hero Zone — IN PROGRESS) -->

## App Screens (`app/(tabs)/`)
- `_layout.tsx` - Tab bar layout (2 visible tabs: Tonight, Explore; mypicks/learn/myiq/explore/models/profile hidden)
- `index.tsx` - Tonight screen — Compact header (date + headline + settings + last-updated) + LiveNowBar + YourTeamCard + HeroMatchup (top edge) + StatOfTheNight + PlayerSpotlightCarousel + AllGamesCards (featured 2) + StandingsWidget + CompactGameRows (remaining) + EdgeSpotlight + InsightFeed + EmptyNightCard. 442 lines (from 299, added new sections). Cycle 7 overhaul.
- `stats.tsx` - Explore screen — 5 segments: Teams/Players/Edge/Factors/Models
- `learn.tsx` - ~~Learn tab~~ (hidden route — Factor Leaderboard moved to Explore)
- `myiq.tsx` - ~~My IQ tab~~ (hidden route)
- `mypicks.tsx` - ~~My Picks tab~~ (hidden route — model accuracy accessible in Explore → Models)
- `explore.tsx` - Explore screen (133 lines — segmented: Teams / Players)
- `teams.tsx` - Teams sub-screen (1,671 lines — all 32 teams, advanced stats, charts)
- `more.tsx` - Players sub-screen (706 lines — rosters by position, player stats)
- `models.tsx` - Models tab (217 lines — model list, create/edit, backtest)
- `picks.tsx` - All picks screen (969 lines — today's games, AI + user picks)
- `profile.tsx` - Profile screen (594 lines — notification settings, stats, achievements)
- `settings.tsx` - Settings screen (594 lines — notifications, data management)

## Components (`components/`)

### War Room Components (Cycle 3)
- `HeroMatchup.tsx` - Cinematic hero game card with team color gradient split, ProbabilityArc, insight chips, share button, MomentumSparkline + ClutchBadge
- `ProbabilityArc.tsx` - SVG semicircular probability gauge with animated fill (Reanimated)
- `GameTicker.tsx` - Horizontal scrollable game capsule strip with micro-bars and confidence dots (no longer used on Tonight screen — replaced by LiveNowBar + AllGamesCard in Cycle 4)
- `InsightFeed.tsx` - Vertical feed of shareable analytical nuggets with team color accents

### Full Terminal Components (Cycle 4)
- `QuickStatsBar.tsx` - Horizontal stat pills bar (game count, close matchups, division battles; Edge-aware: top shot speed, momentum, rest edge when available)
- `LiveNowBar.tsx` - Compact red-accented bar showing live game scores with pulsing dot
- `AllGamesCard.tsx` - Full-width vertical game card with team color accent, probability bar, H2H, insight, momentum arrows, rest icons (React.memo)
- `HotPlayersSection.tsx` - Horizontal scroll of top player highlight cards with team colors, Edge shot speed + last 5 stats
- `StatOfTheNight.tsx` - Bold single-stat shareable card with large typography
- `StandingsSnapshot.tsx` - Compact division leaders table with expand/collapse, momentum column (MTM)

### Modals
- `GameDeepDiveModal.tsx` - Detailed game analysis modal (Overview, Recent, H2H, Players, Edge IQ, Schedule tabs)
- `LockInModal.tsx` - Team selection confirmation modal
- `PickHistoryModal.tsx` - Past picks and outcomes modal
- `PickResultModal.tsx` - Single pick result detail modal
- `DataSeedingModal.tsx` - Historical data loading progress modal

### Game Cards (Legacy — kept for routing)
- `MatchupGameCard.tsx` - Basic game matchup card
- `MatchupList.tsx` - List container for game cards
- `AnimatedProbabilityBar.tsx` - Visual win probability bar
- `ModelAccuracyCard.tsx` - Model historical accuracy display
- `ResultsCard.tsx` - Generic results display card

### Stats & Analytics
- `PowerRankingsWidget.tsx` - All teams ranked with momentum
- `StreakTracker.tsx` - Teams on hot/cold streaks
- `AccuracyTrendsCard.tsx` - User accuracy trend chart
- `PickPerformanceChart.tsx` - Pick breakdown by result type
- `FactorLeaderboard.tsx` - Factor accuracy rankings
- `BreakdownCard.tsx` - Educational factor breakdown for games
- `StatExplainer.tsx` - Tooltip/explainer for stats

### Team & Player
- `TeamCard.tsx` - Team info card (record, points)
- `TeamModal.tsx` - Team detail modal
- `TeamPlayerHighlightsCard.tsx` - Key players and stats
- `TeamSearchBar.tsx` - Search component for teams
- `TeamStatusBadges.tsx` - Team status indicator badges
- `StatComparisonRow.tsx` - Side-by-side team stat comparison
- `AdvancedStatCard.tsx` - Advanced analytics card (Corsi, xG)

### User Progress & Engagement
- `StreakBadge.tsx` - Current streak with dynamic styling
- `StreakIndicator.tsx` - Alternative streak display
- `AchievementBadge.tsx` - Achievement milestone display
- `ThemeBanner.tsx` - Weekly coaching theme banner
- `PuckBalance.tsx` - Confidence/wallet balance display

### Analytics Engine Components (Cycle 5)
- `SpeedGauge.tsx` - Speed value display with animated count-up, percentile bar, league avg comparison
- `MomentumSparkline.tsx` - 5-game trend sparkline (SVG), compact (80×24) and full modes, team-colored, animated line draw
- `ClutchBadge.tsx` - Performance badge (CLUTCH/CLOSER/ICE COLD), color-coded
- `ZoneTimeChart.tsx` - Stacked bar for offensive/neutral/defensive zone time with league avg
- `ShotLocationMap.tsx` - Simplified half-rink SVG with 17 zones, hot/cold coloring, tap for tooltip
- `EdgeIntelSection.tsx` - 2×2 grid of Edge stat cards (shot speed, skating speed, zone time, shot map), FadeInUp animation

### Personal Terminal Components (Cycle 6)
- `YourTeamCard.tsx` - Favorite team personalization card with team color gradient, logo, probability, ConfidenceBadge. Shows when selectedTeam is playing tonight. FadeInUp entry. (242 lines)
- `EmptyNightCard.tsx` - Enhanced empty state card when no games tonight. Shows favorite team's standings position, next game, and fun stat. Team logo + color accents. (192 lines)
- `EdgeSpotlight.tsx` - Merged HotPlayers + EdgeIntel horizontal scroll. Max 5 spotlight items (hot players + Edge leaders) with team logos, FadeInRight. "See all" link to Explore. Replaces HotPlayersSection + EdgeIntelSection on Tonight screen. (278 lines)
- `ModelPickerModal.tsx` - Modal for switching prediction models. Overlay with model list, active checkmark, cancel button. (133 lines)
- `Toast.tsx` - Simple toast notification overlay for model switch confirmation. Auto-dismisses. (37 lines)

### Hero Zone Components (Cycle 7)
- `HeroBanner.tsx` - Cinematic hero zone with bundled photo background (8 images, daily rotation), PuckIQ wordmark + tagline branding bar, team logo matchup overlay with VS + probability percentages + ConfidenceBadge, insight chips bar (H2H, B2B/REST, streak) on frosted BlurView, share button, YOUR TEAM badge, spring press animation via Reanimated. (470 lines)
- `PlayerSpotlightCarousel.tsx` - Horizontal FlatList of tonight's top players sorted by points. Team logo, player name, G/A/P stats, team color gradient accent. FadeInRight staggered entry. Links to Explore. (221 lines)
- `CompactGameRow.tsx` - Condensed single-row game card for "Also Tonight" section. Team logos, abbreviations, probability, ConfidenceBadge, game status (time/live/final). FadeInUp entry. Haptic feedback on press. (186 lines)
- `StandingsWidget.tsx` - Division standings table for user's favorite team's division. Team logos, W-L-OTL-PTS columns, selected team highlight row. Links to full standings via Explore. (244 lines)

### Shared UI Components
- `ConfidenceBadge.tsx` - LOCK/STRONG/LEAN/TOSS-UP confidence badge (sm/md/lg sizes)
- `ShareableCard.tsx` - Shareable card with Share API + PuckIQ branding. Also exports `ShareButton`, `sharePick()`, `shareStat()`
- `SeasonSeriesBadge.tsx` - Compact H2H season series badge for game cards

### Design System (`design-system/`)
- `Button.tsx` - Reusable button component
- `Card.tsx` - Reusable card container
- `Typography.tsx` - Text style definitions

### UI Utilities (`ui/`)
- `EmptyState.tsx` - Empty state placeholder
- `ErrorState.tsx` - Error state display
- `SkeletonLoader.tsx` - Loading skeleton placeholders
- `TabBarBackground.tsx` - Tab bar background
- `TabBarBackground.ios.tsx` - iOS-specific tab bar background
- `IconSymbol.tsx` - Icon component
- `IconSymbol.ios.tsx` - iOS SF Symbol icons

### General Utilities
- `ThemedView.tsx` - Themed container
- `ThemedText.tsx` - Themed text component
- `ParallaxScrollView.tsx` - Parallax scrollview
- `Collapsible.tsx` - Expandable/collapsible section
- `Dropdown.tsx` - Dropdown/select component
- `ExternalLink.tsx` - External URL link
- `HapticTab.tsx` - Tab button with haptic feedback
- `HelloWave.tsx` - Wave animation component
- `SettingsButton.tsx` - Settings gear button
- `DailyBrief.tsx` - Daily summary brief
- `DailyIntelBrief.tsx` - Advanced daily brief

### Model Builder (`model-builder/`)
- `index.ts` - Component exports
- `ModelList.tsx` - List of available models
- `ModelEditScreen.tsx` - Edit/create model screen
- `WeightSlider.tsx` - Factor weight slider
- `FactorEditor.tsx` - Individual factor editor
- `LivePreview.tsx` - Real-time model impact preview
- `BacktestPanel.tsx` - Backtest model against history

### Providers
- `auth/AuthProvider.tsx` - Authentication context (placeholder)
- `analytics/AnalyticsProvider.tsx` - Firebase analytics setup
- `analytics/AnalyticsDashboard.tsx` - Analytics debug view

## Services (`services/`)

### Core Prediction & Tracking
- `pickTracking.ts` - Pick calculation & storage (CRITICAL — 364 lines)
- `streakTracking.ts` - Streak logic (CRITICAL — 149 lines)
- `modelPrediction.ts` - Prediction engine with model weights
- `modelStorage.ts` - Model persistence (AsyncStorage)
- `backtesting.ts` - Model validation against historical games
- `historicalGames.ts` - Historical game data seeding
- `insightGenerator.ts` - Generates analytical Insight[] from game data (H2H, streaks, player stats, standings, Edge IQ)

### Analysis & Stats
- `factorAnalysis.ts` - Factor importance calculations
- `advancedTeamStats.ts` - Advanced metrics (Corsi, Fenwick, xG)
- `teamComparison.ts` - Head-to-head team comparison
- `playerPrediction.ts` - Player-level prediction factors
- `weeklyTheme.ts` - Educational theme rotation
- `gameResults.ts` - Supabase game results: `seedCurrentSeason()`, `syncRecentResults()`, `getH2HRecord()`, `getH2HForGames()`, `formatH2HSummary()`, `fetchGameResults()`
- `playerStats.ts` - NHL API player stats with in-memory cache: `getTeamPlayerStats()`, `getKeyPlayersForGame()`, `clearPlayerStatsCache()`

### Edge Analytics (Cycle 5)
- `edgeStats.ts` - Edge API client with 5-min in-memory cache: `fetchSkaterEdge`, `fetchTeamEdge`, `fetchGoalieEdge`, `fetchTeamZoneTime`, `fetchEdgeByTheNumbers`, `fetchEdgeSkaterLanding`, `fetchEdgeGoalieLanding`, `fetchEdgeTeamLanding`, `clearEdgeCache`
- `derivedStats.ts` - Derived stat calculations: `calculateMomentum`, `calculateClutchRating`, `calculateRestAdvantage`, `calculateXGApprox`, `buildEdgeQuickStats`

### User Preferences
- `teamFavorites.ts` - Favorite teams management
- `notificationSettings.ts` - Notification preferences
- `notifications.ts` - Notification scheduling (expo-notifications)
- `walletService.ts` - Confidence/points system (placeholder)

### Analytics
- `analytics/AnalyticsService.ts` - Firebase analytics singleton (batching, offline queue)
- `analytics/types.ts` - Analytics type definitions

## Hooks (`hooks/`)
- `useTonightData.ts` - Tonight screen data hook (566 lines). Extracted from index.tsx. Owns all state, NHL/Edge API data fetching, predictions, derived stats (momentum, clutch, rest), H2H, insights, headline generation, model management, and refresh logic. Returns TonightData interface. (Cycle 6)
- `useAnalytics.ts` - Analytics tracking hook
- `useAuth.ts` - Authentication hook
- `useColorScheme.ts` - Color scheme detection
- `useColorScheme.web.ts` - Web color scheme detection
- `useThemeColor.ts` - Theme color accessor
- `usePickAnimation.ts` - Pick confirmation animation hook
- `useHaptics.ts` - Haptic feedback hook: `tap` (light), `press` (medium), `success` (notification), `selection`. Platform-aware (iOS/Android only). (31 lines, Cycle 7)

## Constants (`constants/`)
- `theme.ts` - Dark mode theme (364 lines)
- `teamColors.ts` - 32-team color map (primary/secondary hex)
- `modelFactors.ts` - Model factor definitions
- `achievements.ts` - Achievement definitions
- `advancedMetrics.ts` - Advanced metric definitions
- `Colors.ts` - Color constants

## Tests

### Service Tests (`services/__tests__/`)
- `insightGenerator.test.ts` - All insight categories, empty/partial data, cap, structure. 30 tests.
- `gameResults.test.ts` - Supabase game results: formatH2HSummary, getH2HRecord, getH2HForGames, seedCurrentSeason, syncRecentResults. 31 tests.
- `playerStats.test.ts` - NHL API player stats: cache, fetching, name mapping, sorting, errors, parallel fetch. 15 tests.
- `edgeStats.test.ts` - Edge API client: mock fetch, cache TTL, error handling, all endpoints. 16 tests.
- `derivedStats.test.ts` - Momentum/clutch/rest/xG/buildEdgeQuickStats calculations, edge cases. 34 tests.

### Component Tests (`components/__tests__/`)
- `HeroMatchup.test.tsx` - Matchup text, TOP EDGE label, onPress/onShare callbacks, H2H chip, game time, ConfidenceBadge. 7 tests.
- `GameTicker.test.tsx` - Empty guard, header, team abbreviations, onGamePress callback. 4 tests.
- `InsightFeed.test.tsx` - Empty guard, header, insight text, onShare callback. 4 tests.
- `ConfidenceBadge.test.tsx` - Tier boundary tests (0-100), size variants, testID. 13 tests.
- `ShareableCard.test.tsx` - sharePick/shareStat helpers, confidence label mapping, h2hSummary, callbacks, error resilience. 11 tests.
- `SeasonSeriesBadge.test.tsx` - getSeriesText variants (9 cases), component rendering states (5 cases). 14 tests.
- `QuickStatsBar.test.tsx` - Null guard, pill rendering, stat values, testID. (Cycle 4)
- `LiveNowBar.test.tsx` - Null guard, LIVE/CRIT games, team display, testID. (Cycle 4)
- `AllGamesCard.test.tsx` - Matchup text, game states (future/live/final/TBD), H2H, insight, testID. (Cycle 4)
- `HotPlayersSection.test.tsx` - Null guard, player extraction, HOT badge, cap at 5, testID. (Cycle 4)
- `StatOfTheNight.test.tsx` - Null guard, stat text, share button, label, testID. (Cycle 4)
- `StandingsSnapshot.test.tsx` - Null guard, division rendering, toggle, testID. (Cycle 4)
- `SpeedGauge.test.tsx` - Speed display, testID, value/label, custom unit, percentile bar, league avg. 6 tests.
- `MomentumSparkline.test.tsx` - Compact/full modes, trend arrow, team color, null guard. 6 tests.
- `ClutchBadge.test.tsx` - All 3 rating states + null guard. 4 tests.
- `ZoneTimeChart.test.tsx` - Segments render, zone labels, colors, percentages. 6 tests.
- `ShotLocationMap.test.tsx` - Empty zones, valid data, legend, unknown zones, tooltip. 6 tests.
- `EdgeIntelSection.test.tsx` - Null data, shot/skating speed, team cards, header, 4-card limit. 6 tests.

### Personal Terminal Tests (Cycle 6)
- `components/__tests__/YourTeamCard.test.tsx` - YOUR TEAM rendering, team colors, logo, game time, confidence badge, non-playing state.
- `components/__tests__/EmptyNightCard.test.tsx` - Empty state rendering, standings info, next game display, no-team fallback.
- `components/__tests__/EdgeSpotlight.test.tsx` - Spotlight items, player cards, Edge leaders, max 5 cap, null data.
- `components/__tests__/ModelPickerModal.test.tsx` - Modal visibility, model list, active model, switch callback, cancel.
- `hooks/__tests__/useTonightData.test.ts` - Hook data fetching, state management, model switching, refresh.
- `utils/__tests__/headlineGenerator.test.ts` - Headline generation: rivalry, division, streak, rest, momentum, default.
- `devData/__tests__/sampleGames.test.ts` - Sample data shape validation, game states, team structure.

### Hook Tests (`hooks/__tests__/`)
- `useHaptics.test.ts` - Haptic feedback hook: platform detection, feedback types, method calls. (Cycle 7)

### Constants Tests (`constants/__tests__/`)
- `teamColors.test.ts` - All 32 teams valid hex, default fallback, ARI legacy, distinct colors. 36 tests.

## Types (`types/`)
- `predictions.ts` - Prediction-related types (ShareablePickData, ShareableStatData)
- `teamStats.ts` - Team comparison types (TeamComparisonStats, CategoryWinner)
- `gameResults.ts` - Game results types: GameResult, H2HRecord, PlayerStatLine, GoalieStatLine, TeamPlayerStats, NHLNameField, NHLRawSkater, NHLRawGoalie, NHLScheduleGame
- `insights.ts` - Insight type for InsightFeed nuggets
- `edgeStats.ts` - Edge API types: SkaterEdgeDetail, TeamEdgeDetail, GoalieEdgeDetail, EdgeByTheNumbers, EdgeSkaterLanding, EdgeGoalieLanding, EdgeTeamLanding, ShotLocationZone, ZoneTimeDetail, SpeedStat, DistanceStat, MomentumData, ClutchRating, EdgeQuickStats, DerivedTeamStats
- `teamForm.ts` - Team recent form types: TeamFormData (teamAbbrev, last-10 results W/L/OTL, wins, losses, otLosses, streak string). (14 lines, Cycle 7)

## Utils (`utils/`)
- `headlineGenerator.ts` - Tonight's Headline auto-generator. Produces editorial one-liner from game data. Priority: Rivalry > Division Showdown > Revenge > Streak > Rest Mismatch > Momentum > Default. Target <50 chars. (263 lines, Cycle 6)
- `teamLogo.ts` - Returns NHL CDN URL for team SVG logo: `getTeamLogoUrl(abbrev)` → `https://assets.nhle.com/logos/nhl/svg/{abbrev}_light.svg`. (7 lines, Cycle 6)
- `logger.ts` - Logging utility
- `predictionHelpers.ts` - Prediction helper functions
- `predictionUtils.ts` - Prediction utility functions (calculateWinProbabilityEnhanced)
- `situationalFactors.ts` - Situational factor calculations (B2B, rest, travel)
- `accuracyTracking.ts` - Accuracy tracking utilities
- `recentForm.ts` - Recent form calculations
- `weightCalibration.ts` - Weight calibration utilities
- `haptics.ts` - Haptic feedback utilities
- `teamStatsForPrediction.ts` - Team stats for prediction pipeline

## Dev Data (`devData/`)
- `sampleGames.ts` - Sample NHL game data for development/testing without live API (Cycle 6)

## Assets

### Hero Banner Photos (`assets/images/topimages/`)
- `image1.jpg` through `image8.jpg` — 8 bundled hockey arena/atmosphere photos used by HeroBanner. Daily rotation via day-of-year modulo. (Cycle 7 — previously unused)

## Config
- `lib/firebase.ts` - Firebase initialization
- `lib/supabase.ts` - Supabase client

## Deleted in Cycle 3
- `components/TopPickCard.tsx` - Replaced by HeroMatchup
- `components/SmartPickCard.tsx` - Replaced by GameTicker
- `components/PickCard.tsx` - Replaced by GameTicker
- `components/LockOfTheDayCard.tsx` - Replaced by HeroMatchup
- `components/ConfirmPickModal.tsx` - Lock-in flow removed
- `components/YesterdayResultsCard.tsx` - Yesterday results removed
