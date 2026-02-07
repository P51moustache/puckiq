# PuckIQ — Current App State

This file describes what the app looks and feels like TODAY. Strategy Squad (especially CoS) reads this to translate abstract CEO directives like "feels too cluttered" or "needs more energy" into concrete, actionable scope.

**Last Updated:** 2026-02-07 (Cycle 8 — YourTeamCard removed, StatOfTheNight redesigned)

---

## Tab Bar (2 Visible Tabs)

| Tab | Label | Icon | Purpose |
|-----|-------|------|---------|
| 1 | Tonight | Home | Cinematic analytics terminal — hero matchup, game cards, player spotlight, standings, edge stats |
| 2 | Explore | Search | Teams, Players, Edge IQ, Factors, Models segments |

Hidden routes (accessible via navigation, not tab bar): Learn, My IQ, MyPicks, Models, Profile, Picks, Teams, Settings

---

## Screen-by-Screen Inventory

### TONIGHT (Home) — `app/(tabs)/index.tsx` — 397 lines

The main screen. A cinematic analytics terminal with clean vertical scroll:

1. **HeroBanner** — Cinematic hero zone: bundled photo background (8 images, daily rotation), PuckIQ wordmark + tagline branding bar, team logo matchup overlay with VS + probability percentages + ConfidenceBadge, insight chips bar (H2H, B2B/REST, streak) on frosted BlurView, share button, spring press animation
2. **LiveNowBar** — Compact red-accented bar showing live game scores with pulsing dot (only during live games)
3. **StatOfTheNight** — Redesigned bold single-stat card: hero number extraction (42px mono), team logo (20x20), team color accent stripe (4px left border), context text, share button
4. **PlayerSpotlightCarousel** — Horizontal scroll of tonight's top players sorted by points, team color gradient accent
5. **More Games** — First 2 remaining games as full AllGamesCards (team colors, probability bar, H2H, insights, momentum arrows, rest icons)
6. **StandingsWidget** — Division standings table for user's favorite team division (W-L-OTL-PTS)
7. **Also Tonight** — Remaining games as CompactGameRows (condensed single-row cards)
8. **EdgeSpotlight** — Horizontal scroll of hot players + Edge stat leaders (max 5)
9. **InsightFeed** — Vertical feed of analytical insight nuggets with team color accents
10. **EmptyNightCard** — Shows when no games tonight (team standings + next game info)

**Modals:** Deep Dive (game analysis), Toast (model switch confirmation)

**Removed in Cycle 8:**
- YourTeamCard — favorite team personalization card removed (redundant with HeroBanner)

**CEO Translation Guide:**
- "Too cluttered" → 9 sections but most are compact. CompactGameRows and EdgeSpotlight are efficient. Could hide InsightFeed.
- "Feels generic" → HeroBanner personalizes with team logos, colors, and insight chips. EmptyNightCard shows team-specific standings.
- "Not enough energy" → HeroBanner has spring press animation, photo backgrounds, frosted glass. StatOfTheNight has hero numbers.
- "Want my team first" → HeroBanner can show YOUR TEAM badge (isYourTeam prop exists but currently not wired since YourTeamCard removal).

---

### LEARN — `app/(tabs)/learn.tsx` — 209 lines

Relatively simple screen:

1. **Header** — "Learn" + "Become a hockey expert"
2. **Weekly Theme Banner** — Same component as Today
3. **Factor Leaderboard** — Which prediction factors are most accurate this week
4. **Coach's Corner** — 2x2 grid of lesson categories (Fundamentals, Goaltending, Advanced Analytics, Coaching Concepts), 4 lessons each. Tap goes nowhere yet (console.log placeholder).
5. **Teams & Players Link** — CTA to Explore tab

**CEO Translation Guide:**
- "Feels empty" → Only 5 lightweight sections. Lesson cards are placeholders (no lesson content exists yet).
- "Not useful" → Factor Leaderboard is the only data-driven piece. Coach's Corner has no actual content behind the cards.
- "Should be more interactive" → Currently read-only. No quizzes, no "test your knowledge," no progress tracking.

---

### MY IQ — `app/(tabs)/myiq.tsx` — 293 lines

User progress dashboard:

1. **Header** — "My Hockey IQ" + "Track your progress"
2. **Overall Stats Card** — Large accuracy % center, total picks + current streak below
3. **Your Strengths** — Top 3 factors the user is best at (factor name + accuracy + pick count)
4. **Room to Grow** — 3 weakest factors (<55%), growth tip
5. **Milestones** — 3-card grid: longest streak, best week, lessons completed
6. **Encouragement Message** — Motivational text

**Note:** Currently uses hardcoded mock data (USER_STATS, FACTOR_ACCURACY arrays). Not connected to real user pick history yet.

**CEO Translation Guide:**
- "Feels fake" → It IS mock data right now. Connecting to real pickTracking service is the fix.
- "Not rewarding enough" → Milestones section is basic (3 cards). Needs more achievements, celebration animations, progress bars.
- "Boring" → No animations, no color beyond theme defaults, no team identity.

---

### EXPLORE — `app/(tabs)/explore.tsx` — 133 lines (+ 2,377 lines in sub-screens)

Segmented controller with 2 sub-tabs:

**Teams** (1,671 lines): Searchable list of all 32 NHL teams. Each card shows name, record, points. Tap for deep view: advanced stats (Corsi, Fenwick, xG), home/road splits, recent form, streaks, goal differential, trend charts. Favorite toggle (heart icon).

**Players** (706 lines): Team dropdown, roster by position (F/D/G). Each player shows name, number, position. Tap for player stats and highlights.

**CEO Translation Guide:**
- "Too much data" → Teams deep view is very dense (advanced stats, splits, charts). May need progressive disclosure.
- "Can't find my team" → No favorite-first sorting. User has to scroll or search.
- "Players feel empty" → Player cards show minimal info. No headshots, no season stats at a glance.

---

### MODELS — `app/(tabs)/models.tsx` — 217 lines

Power user screen (mostly Shark territory):

1. **Model List** — All prediction models, accuracy stats, creation date. "New Model" button.
2. **Model Edit** — Factor weight sliders, real-time preview, backtest panel. Save/Cancel.
3. **Data Seeding Modal** — Loads historical game data for backtesting (one-time).

**CEO Translation Guide:**
- "Too complicated" → This is intentionally a power-user feature. Homer should never land here accidentally.
- "Doesn't feel connected" → Model changes should visibly affect Today screen picks. Currently the link is functional but not communicated.

---

### PROFILE — `app/(tabs)/profile.tsx` — 594 lines

Settings + stats:

1. Notification settings (toggles, time picker)
2. AccuracyTrendsCard, PickPerformanceChart, StreakBadge
3. Overall stats (accuracy %, total picks, win/loss)
4. Achievements list
5. Data management (clear picks, clear AI history)

**CEO Translation Guide:**
- "Too similar to My IQ" → Profile and My IQ overlap (both show accuracy/stats). Needs differentiation — Profile = settings/account, My IQ = gamified progress.

---

## Component Count by Category

| Category | Count | Examples |
|----------|-------|---------|
| Hero/Terminal (Tonight) | 9 | HeroBanner, HeroMatchup, ProbabilityArc, AllGamesCard, CompactGameRow, StatOfTheNight, LiveNowBar, StandingsWidget, PlayerSpotlightCarousel |
| Feed/Spotlight | 3 | InsightFeed, EdgeSpotlight, EmptyNightCard |
| Analytics Engine (Edge) | 6 | SpeedGauge, MomentumSparkline, ClutchBadge, ZoneTimeChart, ShotLocationMap, EdgeIntelSection |
| Modals | 5 | GameDeepDiveModal, LockInModal, PickHistoryModal, PickResultModal, ModelPickerModal |
| Stats/Analytics | 7 | PowerRankingsWidget, StreakTracker, AccuracyTrendsCard, FactorLeaderboard, QuickStatsBar, HotPlayersSection, StandingsSnapshot |
| Team/Player | 6 | TeamCard, TeamModal, TeamPlayerHighlightsCard, AdvancedStatCard, TeamSearchBar, StatComparisonRow |
| Shared UI | 4 | ConfidenceBadge, ShareableCard, SeasonSeriesBadge, Toast |
| User Progress | 3 | StreakBadge, AchievementBadge, ThemeBanner |
| Design System | 3 | Button, Card, Typography |
| UI Utilities | 8 | EmptyState, ErrorState, SkeletonLoader, Collapsible, Dropdown, SettingsButton, DailyBrief, DailyIntelBrief |
| Model Builder | 6 | ModelEditScreen, WeightSlider, FactorEditor, LivePreview, BacktestPanel, ModelList |
| Providers | 2 | AuthProvider (placeholder), AnalyticsProvider |
| Legacy (unused) | 3 | GameTicker, MatchupGameCard, MatchupList |
| **Total** | **~65** | |

**Deleted Components (Cycle 3-8):** TopPickCard, SmartPickCard, PickCard, LockOfTheDayCard, ConfirmPickModal, YesterdayResultsCard, YourTeamCard

## Services Count

| Service | Lines | Status |
|---------|-------|--------|
| pickTracking.ts | 364 | Production (critical path) |
| streakTracking.ts | 149 | Production (critical path) |
| modelPrediction.ts | ~200 | Production |
| modelStorage.ts | ~150 | Production |
| backtesting.ts | ~150 | Production |
| ~~historicalGames.ts~~ | -- | DELETED (replaced by Supabase sync) |
| gameResults.ts | ~200 | Production (Supabase H2H) |
| playerStats.ts | ~150 | Production (NHL API + cache) |
| edgeStats.ts | ~200 | Production (Edge API + 5-min cache) |
| derivedStats.ts | ~150 | Production (momentum, clutch, rest) |
| insightGenerator.ts | ~200 | Production (Insight[] generation) |
| analytics/AnalyticsService.ts | ~200 | Production |
| weeklyTheme.ts | ~80 | Production |
| factorAnalysis.ts | ~100 | Production |
| ~~advancedTeamStats.ts~~ | -- | DELETED (fake data removed) |
| teamComparison.ts | ~80 | Production |
| teamFavorites.ts | ~60 | Production |
| playerPrediction.ts | ~80 | Production |
| notificationSettings.ts | ~80 | Production |
| notifications.ts | ~100 | Production |
| walletService.ts | ~50 | Placeholder |

## Known UX Gaps

- **My IQ uses mock data** — not connected to real pick history
- **Learn lessons are placeholders** — Coach's Corner cards lead nowhere (hidden route)
- **Profile and My IQ overlap** — both show accuracy stats (both hidden routes)
- **No onboarding** — new user lands on Tonight with no context
- **YOUR TEAM badge not wired** — `isYourTeam` prop exists on HeroBanner but not passed since YourTeamCard removal. Could re-wire to show when user's team is the hero game.
- **GameDeepDiveModal has 20+ TS errors** — Pre-existing type issues with `game: any` prop (deferred since Cycle 5)
- **Settings duplicated** — Profile and Settings screens show same notification controls
