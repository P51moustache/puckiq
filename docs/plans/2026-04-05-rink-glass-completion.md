# Rink Glass Completion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete every remaining gap in the Rink Glass redesign — wire real data into all 6 dashboard modules, restyle My Team tab, clean up the Today tab layout, add missing interactions (swipe gestures, card flip, haptics), polish animations, and make every screen cohesive under the Rink Glass visual identity.

**Architecture:** The dashboard modules already exist as components with mock data. Each module needs a data-fetching hook that calls existing services (`fantasyProjections`, `playerTrends`, `insightGenerator`, etc.) and transforms the response into the module's prop shape. The My Team tab and its child components need full rinkGlass token adoption. The Today tab needs its legacy content removed/restructured so the dashboard is front-and-center.

**Tech Stack:** React Native / Expo, react-native-reanimated v4, react-native-gesture-handler (already installed), AsyncStorage, TypeScript, Jest

**Design doc:** `docs/plans/2026-04-05-rink-glass-redesign-design.md`

---

## Task 1: Create Dashboard Data Hooks

Create a single `hooks/useDashboardData.ts` hook that fetches real data for all 6 modules and transforms it into the shapes each module expects. This replaces all mock data in DashboardContainer.

**Files:**
- Create: `hooks/useDashboardData.ts`
- Create: `hooks/__tests__/useDashboardData.test.ts`
- Modify: `components/dashboard/DashboardContainer.tsx` (remove mock data, use hook)

**Step 1: Write the hook**

The hook should:
- Call `getProjectionsForRoster()` → transform to `StartSitPlayer[]`
- Call `getTrendingPlayers('up', 5)` → transform to `TrendingPlayer[]` (derive `flameCount` from `hotColdScore`: 5=HOT, 4=WARM, 3=STEADY, 2=COOL, 1=COLD; build `recentPoints` from `avgPoints5g` × 5 + `avgPoints10g` × 5)
- Build alerts from today's games data (goalie confirmations, injury reports) → `FantasyAlert[]`
- Call `getWaiverWireRecommendations()` → transform to `WaiverPlayer[]` (slice top 3, compute `valueScore` as `fantasyPoints - lowestRosterPlayerPoints`)
- Build matchup edge data from projections + game context → `MatchupEdge[]` (top 5 by edge rating, derive rating 1-10 from confidence + matchup favorability)
- Call `generateInsights()` → pick top insight, reshape to `DailyInsight` (map `text` → `headline`, `shareText` → `context`, map sentiment: positive→bullish, negative→bearish, neutral→surprising)
- Return `{ startSitPlayers, trendingPlayers, alerts, waiverPlayers, matchups, dailyInsight, isLoading, refresh }`
- Use `useState` + `useEffect` with 5-minute cache via timestamp check
- Wrap all fetches in try-catch, return empty arrays on failure

**Step 2: Write tests**

Test the hook using `renderHook` from `@testing-library/react-native`:
- Mock all service functions
- Verify each transform produces correct shape
- Verify loading state
- Verify error handling returns empty data

**Step 3: Wire into DashboardContainer**

- Remove all `MOCK_*` constants from DashboardContainer
- Import and call `useDashboardData()`
- Pass real data to each `renderModule()` call
- Show skeleton/loading state while `isLoading` is true
- Pass `refresh` to parent ScrollView's RefreshControl

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git commit -m "feat: wire real data into all dashboard modules via useDashboardData hook"
```

---

## Task 2: Restructure Today Tab Layout

The Today tab currently shows HeroBanner → FinishSetupCard → LiveNowBar → DashboardContainer → EmptyState. The design says "remove hero banner as fixed element" and make the dashboard the primary content. Restructure so the dashboard modules are front-and-center.

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Step 1: Restructure the layout**

New layout order:
1. **Compact header**: "PuckIQ" title + date + SettingsButton (single row, no hero banner)
2. **LiveNowBar** (if games live — compact ticker, stays)
3. **DashboardContainer** (the main content — all modules)
4. **FinishSetupCard** only if `!hasRoster` (move below dashboard, less prominent)

Remove:
- `HeroBanner` component rendering (keep the import for now but don't render it)
- `AllGamesCard`, `Spotlight`, `InsightFeed`, `StatOfTheNight`, `StandingsWidget`, `CompactGameRow` — these are legacy pre-dashboard components that the dashboard modules now replace
- All the hero game state management (`heroGame`, `heroPrediction`, `heroConfidence`, `heroH2H`, `heroSituationalFactors`, etc.) — the matchup data now flows through dashboard modules
- `GameDeepDiveModal` and related state — can be added back later if needed

The header should use Display-Bold font for "PuckIQ", rinkGlass.textPrimary color, with the date subtitle in rinkGlass.textSecondary.

**Step 2: Clean up unused imports and state**

Remove imports for components no longer rendered. Remove state variables that only served the removed components.

**Step 3: Verify in simulator**

Navigate to Today tab, take scroll-screenshot, verify:
- Compact header at top
- Dashboard modules immediately visible
- No more giant hero banner consuming the entire first screen

**Step 4: Commit**

```bash
git commit -m "feat: restructure Today tab with dashboard-first layout"
```

---

## Task 3: Restyle My Team Tab with Rink Glass

The My Team tab and all its child components (`MyTeamScreen`, `StartSitCard`, `WeeklyOutlook`, `WaiverWireSection`) use old hardcoded theme colors. Convert everything to rinkGlass tokens.

**Files:**
- Modify: `components/MyTeamScreen.tsx`
- Modify: `components/StartSitCard.tsx`
- Modify: `components/WeeklyOutlook.tsx`
- Modify: `components/WaiverWireSection.tsx`
- Modify: `components/RosterBuilder.tsx`

**Step 1: Restyle MyTeamScreen**

Replace all hardcoded colors:
- `#071023` → `rinkGlass.ice`
- `#60a5fa` → `rinkGlass.blueLight`
- `#e6eef8` → `rinkGlass.textPrimary`
- `#98a6bf` → `rinkGlass.textSecondary`
- Card backgrounds → `rinkGlass.glass` with `rinkGlass.glassBorder` border
- Section headers → Display-Bold font family
- CTA buttons → blueLight background

The empty state should use glass card styling with the trophy icon in blueLight, and the teaser cards should use glass backgrounds with module accent colors.

**Step 2: Restyle StartSitCard**

- Card background: `rinkGlass.glass` with `glassBorder`
- Left stripe: `rinkGlass.faceoffDot` (START) or `rinkGlass.redLine` (SIT) or `rinkGlass.powerPlay` (UPSIDE) or `rinkGlass.blueLight` (FLEX)
- Badge colors match stripe
- Player name: `rinkGlass.textPrimary`
- Subtext: `rinkGlass.textSecondary`
- Large projected points: Display-Bold font
- Floor/ceiling bar: glass background with accent fill

**Step 3: Restyle WeeklyOutlook**

- Card background: `rinkGlass.glass`
- Section header: Display-Bold
- Category labels: `rinkGlass.textSecondary`
- Bar chart: `rinkGlass.blueLight` fill on `rinkGlass.boards` background
- Edge badges: `rinkGlass.faceoffDot` (positive), `rinkGlass.redLine` (negative)
- Value numbers: `rinkGlass.textPrimary`, monospace font

**Step 4: Restyle WaiverWireSection**

- Card background: `rinkGlass.glass`
- Rank badge: gradient with `rinkGlass.blueLight`
- Player name: `rinkGlass.textPrimary`
- Points: Display-Bold, `rinkGlass.blueLight`
- "HOT" badge: `rinkGlass.goalLight` background
- "See All" button: `rinkGlass.blueLight` text

**Step 5: Restyle RosterBuilder**

- Modal background: `rinkGlass.ice`
- Search input: `rinkGlass.boards` background, `rinkGlass.glassBorder` border, `rinkGlass.textPrimary` text
- Player list items: `rinkGlass.glass` background
- Add/remove buttons: `rinkGlass.faceoffDot` / `rinkGlass.redLine`
- Save button: `rinkGlass.blueLight`
- Scoring format selector: glass pill buttons

**Step 6: Verify in simulator**

Navigate to My Team tab, take scroll-screenshot, verify cohesive Rink Glass appearance.

**Step 7: Commit**

```bash
git commit -m "feat: restyle My Team tab with Rink Glass tokens"
```

---

## Task 4: Restyle Player Row Components

The player row components used across the Players tab still reference the old `theme` object. Convert to rinkGlass.

**Files:**
- Modify: `components/CompactPlayerRow.tsx`
- Modify: `components/PlayerProjectionCard.tsx` (if exists)
- Modify: `components/ElevatedPlayerRow.tsx` (if exists)

**Step 1: Update CompactPlayerRow**

- Replace `theme.text` → `rinkGlass.textPrimary`
- Replace `theme.subtext` → `rinkGlass.textSecondary`
- Replace `theme.accent` → `rinkGlass.blueLight`
- Stat value: monospace font (`rinkGlass.fonts.mono`)
- Trend pill colors: HOT → `rinkGlass.goalLight`, WARM → `rinkGlass.powerPlay`, COLD → `rinkGlass.blueLight`

**Step 2: Update PlayerProjectionCard**

- Card bg: `rinkGlass.glass` with `glassBorder`
- Accent bar: team color (keep) but fallback to `rinkGlass.blueLight`
- Projection values: Display-Bold font for numbers
- Confidence badge: use semantic colors from rinkGlass
- Direction badge (ABOVE/BELOW): `rinkGlass.faceoffDot` / `rinkGlass.redLine`

**Step 3: Update ElevatedPlayerRow** (if exists)

Same pattern — replace old theme refs with rinkGlass tokens.

**Step 4: Verify Players tab in simulator**

**Step 5: Commit**

```bash
git commit -m "feat: restyle player row components with Rink Glass tokens"
```

---

## Task 5: Add Sparklines and Flame Badges to Players Tab

The design spec calls for inline sparklines on player rows and flame intensity badges on trending players in the main list.

**Files:**
- Modify: `app/(tabs)/players.tsx`
- Modify: `components/CompactPlayerRow.tsx` or `components/ElevatedPlayerRow.tsx`

**Step 1: Add sparkline to player rows**

For league leader rows (#2-5 elevated, #6-10 compact):
- Add a small `<Sparkline>` component showing last 5-10 game trend
- Data comes from `getLeaderTrends()` which already returns `LeaderTrend` with rolling stats
- Position sparkline to the right of the stat value, before the row edge
- Size: width=50, height=18

**Step 2: Add flame count badge to trending players**

In the Spotlight section and any trending player display:
- Show flame emoji count (1-5) derived from `hotColdScore`
- Position next to player name or as overlay on card

**Step 3: Add "Watch" / "Compare" quick actions**

Add small action buttons to player rows:
- "Watch" icon button (eye outline) — adds player to watchlist (`puckiq_watchlist` in AsyncStorage)
- "Compare" icon button (git compare) — could open inline comparison or modal
- These go in the elevated player rows, not compact rows (too small)

**Step 4: Verify in simulator**

**Step 5: Commit**

```bash
git commit -m "feat: add sparklines, flame badges, and quick actions to Players tab"
```

---

## Task 6: Restyle HubScreen with Consistent Rink Glass

The HubScreen uses a custom `DT` token object that's partially rinkGlass but inconsistent. Make it fully rinkGlass.

**Files:**
- Modify: `components/HubScreen.tsx`

**Step 1: Replace DT tokens with rinkGlass**

- Remove the local `DT` object entirely
- Import `rinkGlass` from constants/theme
- Map all DT references:
  - `DT.bg` → `rinkGlass.ice`
  - `DT.card` → `rinkGlass.boards`
  - `DT.glass` → `rinkGlass.glass`
  - `DT.border` → `rinkGlass.glassBorder`
  - `DT.accent` → `rinkGlass.blueLight`
  - `DT.textPrimary` → `rinkGlass.textPrimary`
  - `DT.textSecondary` → `rinkGlass.textSecondary`
  - `DT.textMuted` → `rinkGlass.textMuted`
  - `DT.proBadge` → `rinkGlass.powerPlay`
  - `DT.goalLight` → `rinkGlass.goalLight`
- Stat card numbers: Display-Bold font
- Section headers: Display-Bold font
- Notification category icons: use module accent colors from `rinkGlass.moduleAccents`

**Step 2: Verify in simulator**

**Step 3: Commit**

```bash
git commit -m "feat: unify HubScreen with rinkGlass tokens"
```

---

## Task 7: Add Swipe Gestures to Alerts and Start/Sit

The design spec requires swipe gestures on Alerts (swipe right = dismiss, left = save) and Start/Sit (swipe left = dismiss, right = pin).

**Files:**
- Modify: `components/dashboard/AlertsModule.tsx`
- Modify: `components/dashboard/StartSitModule.tsx`
- Modify: `services/fantasyAlerts.ts` (wire dismiss/save)

**Step 1: Add swipeable alert cards**

Use `react-native-gesture-handler`'s `Swipeable` or build with `PanGestureHandler` + reanimated:
- Swipe right reveals green "Dismiss" action → calls `dismissAlert(id)` from fantasyAlerts service
- Swipe left reveals blue "Save" action → calls `saveAlert(id)` from fantasyAlerts service
- On complete swipe, card animates out (height collapses to 0)
- Show small icon hint (checkmark for dismiss, bookmark for save) during swipe

**Step 2: Add swipeable Start/Sit cards**

- Swipe left → dismiss card (fade out + height collapse)
- Swipe right → pin card (blue border highlight, moves to front)
- Haptic feedback on swipe threshold

**Step 3: Wire fantasyAlerts service**

Connect `getDismissedAlertIds()` and `getSavedAlertIds()` to filter alerts on load. When user dismisses, persist to AsyncStorage via the existing service functions.

**Step 4: Write tests for swipe behavior**

Test that:
- Dismissing an alert calls the service and removes from list
- Saving an alert calls the service
- Dismissed alerts don't reappear on next load

**Step 5: Commit**

```bash
git commit -m "feat: add swipe gestures to Alerts and Start/Sit modules"
```

---

## Task 8: Add Card Flip Animation to Trending

The design spec calls for a 3D Y-axis rotation when tapping a Trending card to reveal the "why" details.

**Files:**
- Modify: `components/dashboard/TrendingModule.tsx`

**Step 1: Implement 3D card flip**

Using react-native-reanimated:
- `useSharedValue` for rotation (0 or 180 degrees)
- Front face: player name, flame count, sparkline, trend arrow
- Back face: stats breakdown (ownership %, matchup, recent performance), Watch button
- `useAnimatedStyle` with `rotateY` transform
- Card has `backfaceVisibility: 'hidden'` on both faces
- Tap toggles rotation with `withTiming(180, { duration: 400 })`
- Front face visible when rotation < 90, back face when >= 90

**Step 2: Verify animation smoothness in simulator**

**Step 3: Commit**

```bash
git commit -m "feat: add 3D card flip animation to Trending module"
```

---

## Task 9: Polish Animations Across All Modules

Add the missing animation polish from the design spec.

**Files:**
- Modify: `components/dashboard/StartSitModule.tsx` (color wash sweep)
- Modify: `components/dashboard/DailyInsightModule.tsx` (share card animation)
- Modify: Various module components (card press scale)

**Step 1: Color wash sweep on START/SIT toggle**

When toggling START↔SIT:
- Animated color band sweeps across the card from left to right
- Use `useSharedValue` for sweep position (0 → card width)
- Render a thin colored overlay with animated `translateX`
- Duration: 300ms with easing
- Add haptic feedback (`expo-haptics` light impact) on toggle

**Step 2: Universal card press animation**

For every tappable module card, wrap in Pressable with:
- `useAnimatedStyle` → `scale: withTiming(pressed ? 0.98 : 1, { duration: 100 })`
- Shadow deepens on press (shadow radius increases)
- Use `rinkGlass.pressScale` (0.98) and `rinkGlass.pressShadow` tokens

**Step 3: Entry animations consistency**

Verify all modules use consistent entry stagger:
- `FadeInUp.delay(index * theme.animation.staggerDelay).duration(theme.animation.entryDuration)`
- Spring physics on card entry: `FadeInUp.springify().damping(15).stiffness(150)`

**Step 4: Commit**

```bash
git commit -m "feat: polish animations — color wash, card press, spring entry"
```

---

## Task 10: Tab Bar Glow Dot and Badge Count

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

**Step 1: Add glow dot under active icon**

Below the active tab icon, render a small (6px) circular dot in `rinkGlass.blueLight` with a subtle glow shadow (`shadowColor: rinkGlass.blueLight, shadowRadius: 6, shadowOpacity: 0.6`). Use `tabBarIcon` render prop to conditionally show the dot when `focused` is true.

**Step 2: Add badge count on Today tab**

Show a red badge on the Today tab when there are pending/unread alerts:
- Use `tabBarBadge` prop on the Today tab
- Count comes from alerts data (unread alerts not yet dismissed)
- Badge color: `rinkGlass.goalLight`

**Step 3: Commit**

```bash
git commit -m "feat: add glow dot and alert badge to tab bar"
```

---

## Task 11: Explore Tab Typography and Visual Polish

**Files:**
- Modify: `app/(tabs)/stats.tsx`

**Step 1: Larger typography on Edge stats**

In the Edge segment:
- Season leader values (hardest shot speed, fastest skater speed): Display-Bold, fontSize 28
- Player names: fontSize 16, semibold
- "Season Leaders" section header: Display-Bold

**Step 2: Team card visual hierarchy**

In the Teams segment:
- Team abbreviation badges: larger (40px circle), Display-Bold font
- Record text: monospace font for alignment
- Points: Display-Bold, blueLight color for emphasis
- Add subtle card glow on favorite teams

**Step 3: Factor leaderboard polish**

- Category values: Display-Bold for numbers
- Bar chart fills: use rinkGlass accent colors instead of generic blue

**Step 4: Commit**

```bash
git commit -m "feat: polish Explore tab typography and visual hierarchy"
```

---

## Task 12: Model Disagreement Indicator on Start/Sit

**Files:**
- Modify: `components/dashboard/StartSitModule.tsx`
- Modify: `hooks/useDashboardData.ts`

**Step 1: Add disagreement data to hook**

In `useDashboardData`, when building StartSit data:
- Check if `confidence` is 'low' or if `recommendation` differs from what a simple points threshold would suggest
- Add `hasDisagreement: boolean` and `disagreementReason: string` to the StartSitPlayer type

**Step 2: Render amber pulse border**

When `hasDisagreement` is true on a player card:
- Add animated pulsing border in `rinkGlass.powerPlay` (amber)
- Use `withRepeat(withTiming(...))` for pulse (opacity 0.4 → 1.0, 1.5s cycle)
- Show one-line reason text below the projected points

**Step 3: Commit**

```bash
git commit -m "feat: add model disagreement amber pulse indicator to Start/Sit"
```

---

## Task 13: Full Simulator Audit and Visual Fix Pass

**Files:** Various — depends on issues found

**Step 1: Screenshot every tab**

Use `./scripts/sim-control.sh scroll-screenshot` on:
- Today tab (verify dashboard-first layout, all modules with real data)
- My Team tab (verify rinkGlass styling)
- Players tab (verify sparklines, flame badges, rinkGlass rows)
- Explore tab (verify typography, team cards)
- Hub tab (verify unified rinkGlass tokens)

**Step 2: Fix visual issues**

Common fixes to look for:
- Inconsistent spacing between modules
- Text color mismatches (any remaining old theme colors)
- Font family not applied (Display-Bold missing on headers)
- Card border radius inconsistency
- Shadow/elevation differences between screens

**Step 3: Run full test suite**

```bash
npx jest --no-coverage
```

Expect no new regressions from pre-existing 19 failing suites.

**Step 4: Final commit**

```bash
git commit -m "feat: complete Rink Glass redesign — all screens polished and cohesive"
```
