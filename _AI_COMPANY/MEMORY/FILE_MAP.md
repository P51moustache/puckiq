# PUCK-IQ File Map

<!-- Archivist and Builder update this as files change -->
<!-- Last Updated: 2026-02-03 -->

## App Screens (`app/(tabs)/`)
- `_layout.tsx` - Tab bar layout (3 visible tabs: Today, Learn, My IQ)
- `index.tsx` - Home/Today screen (1,359 lines — main hub, picks, streaks, rankings)
- `learn.tsx` - Learn tab (209 lines — weekly theme, factor leaderboard, lesson grid)
- `myiq.tsx` - My IQ tab (293 lines — accuracy stats, strengths, milestones)
- `explore.tsx` - Explore screen (133 lines — segmented: Teams / Players)
- `teams.tsx` - Teams sub-screen (1,671 lines — all 32 teams, advanced stats, charts)
- `more.tsx` - Players sub-screen (706 lines — rosters by position, player stats)
- `models.tsx` - Models tab (217 lines — model list, create/edit, backtest)
- `picks.tsx` - All picks screen (969 lines — today's games, AI + user picks)
- `mypicks.tsx` - My picks history (735 lines — pick history, filtering, stats)
- `profile.tsx` - Profile screen (594 lines — notification settings, stats, achievements)
- `settings.tsx` - Settings screen (594 lines — notifications, data management)

## Components (`components/`)

### Game & Prediction Cards
- `LockOfTheDayCard.tsx` - Hero card: top prediction with factor breakdown
- `SmartPickCard.tsx` - Medium card for AI picks with confidence
- `PickCard.tsx` - Smaller pick card for grid layout
- `TopPickCard.tsx` - Alternative hero card variant
- `MatchupGameCard.tsx` - Basic game matchup card
- `MatchupList.tsx` - List container for game cards
- `AnimatedProbabilityBar.tsx` - Visual win probability bar
- `ModelAccuracyCard.tsx` - Model historical accuracy display
- `YesterdayResultsCard.tsx` - Previous day's pick results summary
- `ResultsCard.tsx` - Generic results display card

### Modals
- `GameDeepDiveModal.tsx` - Detailed game analysis modal
- `LockInModal.tsx` - Team selection confirmation modal
- `ConfirmPickModal.tsx` - Pick confirmation dialog
- `PickHistoryModal.tsx` - Past picks and outcomes modal
- `PickResultModal.tsx` - Single pick result detail modal
- `DataSeedingModal.tsx` - Historical data loading progress modal

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

### Analysis & Stats
- `factorAnalysis.ts` - Factor importance calculations
- `advancedTeamStats.ts` - Advanced metrics (Corsi, Fenwick, xG)
- `teamComparison.ts` - Head-to-head team comparison
- `playerPrediction.ts` - Player-level prediction factors
- `weeklyTheme.ts` - Educational theme rotation

### User Preferences
- `teamFavorites.ts` - Favorite teams management
- `notificationSettings.ts` - Notification preferences
- `notifications.ts` - Notification scheduling (expo-notifications)
- `walletService.ts` - Confidence/points system (placeholder)

### Analytics
- `analytics/AnalyticsService.ts` - Firebase analytics singleton (batching, offline queue)
- `analytics/types.ts` - Analytics type definitions

## Hooks (`hooks/`)
- `useAnalytics.ts` - Analytics tracking hook
- `useAuth.ts` - Authentication hook
- `useColorScheme.ts` - Color scheme detection
- `useColorScheme.web.ts` - Web color scheme detection
- `useThemeColor.ts` - Theme color accessor
- `usePickAnimation.ts` - Pick confirmation animation hook

## Constants (`constants/`)
- `theme.ts` - Dark mode theme (364 lines)
- `modelFactors.ts` - Model factor definitions
- `achievements.ts` - Achievement definitions
- `advancedMetrics.ts` - Advanced metric definitions
- `Colors.ts` - Color constants

## Config
- `lib/firebase.ts` - Firebase initialization
- `lib/supabase.ts` - Supabase client
