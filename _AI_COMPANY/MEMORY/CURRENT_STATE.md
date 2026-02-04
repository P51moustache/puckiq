# PuckIQ — Current App State

This file describes what the app looks and feels like TODAY. Strategy Squad (especially CoS) reads this to translate abstract CEO directives like "feels too cluttered" or "needs more energy" into concrete, actionable scope.

**Last Updated:** 2026-02-03

---

## Tab Bar (3 Visible Tabs)

| Tab | Label | Icon | Purpose |
|-----|-------|------|---------|
| 1 | Today | Home | Daily picks, game cards, streaks |
| 2 | Learn | Book | Hockey analytics education |
| 3 | My IQ | Brain | User stats, accuracy, milestones |

Hidden screens (accessible via navigation, not tab bar): Explore, Models, Profile, Picks, MyPicks, Teams, Settings

---

## Screen-by-Screen Inventory

### TODAY (Home) — `app/(tabs)/index.tsx` — 1,359 lines

The main screen. A long vertical scroll with ~7 sections:

1. **Header** — "PuckIQ" title, "Smart NHL Picks" subtitle, random hero image (8 rotate), model switcher pill ("PuckIQ Classic"), streak badge, settings gear
2. **Weekly Theme Banner** — Current coaching theme (e.g., "Goaltending") with "Learn More" link
3. **Yesterday's Results Card** — 3-row stat summary (Lock, Smart Picks, User Picks) with accuracy %, expandable to individual results
4. **Lock of the Day** — Large hero card: matchup, time, confidence badge, win probability bars, expandable factor breakdown, "Lock In" button
5. **More Picks Grid** — 2-column grid of SmartPickCards, "View All Picks" link
6. **Game Breakdowns** — Top 3 games with factor analysis, weekly theme focus
7. **Power Rankings Widget** — All teams ranked with momentum indicators
8. **Hot/Cold Streaks** — Teams on 3+ game win/loss streaks

**Modals:** Deep Dive (game analysis), Lock-In Confirmation (pick team), Model Picker (switch models), Info Modals (divisions, schedule, stats)

**CEO Translation Guide:**
- "Too cluttered" → likely means too many sections visible at once (7-8 cards in scroll). Consider collapsing, hiding, or paginating.
- "Feels generic" → the hero image rotation and lack of team-specific personalization. Homer wants their team front and center.
- "Not enough energy" → the Lock of the Day card may need more visual punch (animations, color, confidence badge styling).
- "Too much going on" → Power Rankings + Hot/Cold + Breakdowns may feel like noise below the fold. Consider which sections earn their space.

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
| Game/Prediction cards | 10 | LockOfTheDayCard, SmartPickCard, PickCard, TopPickCard |
| Modals | 6 | GameDeepDiveModal, LockInModal, ConfirmPickModal, PickHistoryModal |
| Stats/Analytics | 7 | PowerRankingsWidget, StreakTracker, AccuracyTrendsCard, FactorLeaderboard |
| Team/Player | 6 | TeamCard, TeamModal, TeamPlayerHighlightsCard, AdvancedStatCard |
| User Progress | 3 | StreakBadge, AchievementBadge, ThemeBanner |
| Design System | 3 | Button, Card, Typography |
| UI Utilities | 6 | EmptyState, ErrorState, SkeletonLoader, Collapsible, Dropdown |
| Model Builder | 6 | ModelEditScreen, WeightSlider, FactorEditor, LivePreview, BacktestPanel |
| Providers | 2 | AuthProvider (placeholder), AnalyticsProvider |
| **Total** | **~49** | |

## Services Count

| Service | Lines | Status |
|---------|-------|--------|
| pickTracking.ts | 364 | Production (critical path) |
| streakTracking.ts | 149 | Production (critical path) |
| modelPrediction.ts | ~200 | Production |
| modelStorage.ts | ~150 | Production |
| backtesting.ts | ~150 | Production |
| historicalGames.ts | ~150 | Production |
| analytics/AnalyticsService.ts | ~200 | Production |
| weeklyTheme.ts | ~80 | Production |
| factorAnalysis.ts | ~100 | Production |
| advancedTeamStats.ts | ~100 | Production |
| teamComparison.ts | ~80 | Production |
| teamFavorites.ts | ~60 | Production |
| playerPrediction.ts | ~80 | Production |
| notificationSettings.ts | ~80 | Production |
| notifications.ts | ~100 | Production |
| walletService.ts | ~50 | Placeholder |

## Known UX Gaps

- **My IQ uses mock data** — not connected to real pick history
- **Learn lessons are placeholders** — Coach's Corner cards lead nowhere
- **Profile and My IQ overlap** — both show accuracy stats
- **No onboarding** — new user lands on Today with no context
- **No share flow** — Debater can't share picks or stats (no share button anywhere)
- **No team personalization on Today** — Homer's team isn't prioritized
- **Settings duplicated** — Profile and Settings screens show same notification controls
