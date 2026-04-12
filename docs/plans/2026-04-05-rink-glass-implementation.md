# Rink Glass Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform PuckIQ from a passive data viewer into a fun, customizable fantasy hockey tool with the "Rink Glass" visual identity and interactive dashboard modules.

**Architecture:** Update the design token system first (foundation), then build the customizable dashboard module infrastructure, then implement each interactive module, then restyle remaining screens. Each task is independently testable and committable.

**Tech Stack:** React Native / Expo, expo-linear-gradient, react-native-reanimated v4, AsyncStorage, TypeScript, Jest

**Design doc:** `docs/plans/2026-04-05-rink-glass-redesign-design.md`

---

## Task 1: Rink Glass Design Tokens

Update `constants/theme.ts` with the new Rink Glass color system, typography tokens, and card treatment tokens. This is the foundation everything else builds on.

**Files:**
- Modify: `constants/theme.ts`
- Test: `constants/__tests__/theme.test.ts` (create)

**Step 1: Write the test**

```typescript
// constants/__tests__/theme.test.ts
import { theme, rinkGlass, textStyles } from '../theme';

describe('Rink Glass Design Tokens', () => {
  it('exports rinkGlass color tokens', () => {
    expect(rinkGlass.ice).toBe('#0a0e1a');
    expect(rinkGlass.blueLight).toBe('#4cc9f0');
    expect(rinkGlass.goalLight).toBe('#f72585');
    expect(rinkGlass.faceoffDot).toBe('#06d6a0');
    expect(rinkGlass.redLine).toBe('#e63946');
    expect(rinkGlass.powerPlay).toBe('#ffd60a');
  });

  it('exports glass card tokens', () => {
    expect(rinkGlass.glass).toContain('rgba');
    expect(rinkGlass.glassBorder).toContain('rgba');
  });

  it('keeps backwards-compatible theme export', () => {
    expect(theme.background).toBeDefined();
    expect(theme.card).toBeDefined();
    expect(theme.text).toBeDefined();
    expect(theme.accent).toBeDefined();
  });

  it('has card accent colors for each module type', () => {
    expect(rinkGlass.moduleAccents.startSit).toBe(rinkGlass.faceoffDot);
    expect(rinkGlass.moduleAccents.trending).toBe(rinkGlass.goalLight);
    expect(rinkGlass.moduleAccents.alerts).toBe(rinkGlass.powerPlay);
    expect(rinkGlass.moduleAccents.waiverWire).toBe(rinkGlass.blueLight);
    expect(rinkGlass.moduleAccents.matchupEdge).toBe('#a78bfa');
    expect(rinkGlass.moduleAccents.dailyInsight).toBe('#f97316');
  });
});
```

**Step 2: Run test — expect FAIL** (rinkGlass not exported yet)

Run: `npx jest constants/__tests__/theme.test.ts --no-coverage`

**Step 3: Add rinkGlass tokens to theme.ts**

Add a new `rinkGlass` export alongside the existing `theme` export (don't break existing imports). Include:
- Background colors: `ice`, `glass`, `boards`, `zamboni`
- Accent colors: `blueLight`, `goalLight`, `powerPlay`, `faceoffDot`, `redLine`
- Text colors: `textPrimary`, `textSecondary`, `textMuted`
- Glass tokens: `glassBorder`, `glassHighlight`, `cardGlow`
- Module accent map: `moduleAccents` object mapping each module type to its accent color
- Card press animation values: `pressScale: 0.98`, `pressShadow` object

**Step 4: Run test — expect PASS**

Run: `npx jest constants/__tests__/theme.test.ts --no-coverage`

**Step 5: Commit**

```bash
git add constants/theme.ts constants/__tests__/theme.test.ts
git commit -m "feat: add Rink Glass design tokens to theme system"
```

---

## Task 2: Load Display Font

Add a bold condensed display font for headlines and large numbers. Use `expo-font` (already available via Expo).

**Files:**
- Modify: `app/_layout.tsx` (add font to useFonts)
- Download: A bold condensed font file to `assets/fonts/`

**Step 1: Check available fonts and download**

Check what's in `assets/fonts/`. We need a condensed/compressed bold display font. Options:
- Use `Oswald-Bold.ttf` (Google Fonts, free, condensed sporty feel)
- Or `Barlow-Condensed-Bold.ttf`

Download from Google Fonts CDN and save to `assets/fonts/`.

**Step 2: Add font to useFonts in app/_layout.tsx**

In `app/_layout.tsx`, find the `useFonts` call and add the new font:
```typescript
const [loaded] = useFonts({
  SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  'Display-Bold': require('../assets/fonts/Oswald-Bold.ttf'),
});
```

**Step 3: Add font token to theme.ts**

Add to `rinkGlass`:
```typescript
fonts: {
  display: 'Display-Bold',     // Headlines, big numbers
  body: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
}
```

**Step 4: Verify font loads**

Run app, check console for font loading errors. Navigate to any screen.

**Step 5: Commit**

```bash
git add assets/fonts/ app/_layout.tsx constants/theme.ts
git commit -m "feat: add condensed display font for Rink Glass headlines"
```

---

## Task 3: Tab Bar Redesign

Restyle the tab bar with the Rink Glass aesthetic — near-black background, glow dot under active tab, icy blue active color.

**Files:**
- Modify: `app/(tabs)/_layout.tsx`
- Test: `app/(tabs)/__tests__/_layout.test.tsx` (create if not exists)

**Step 1: Write the test**

```typescript
describe('Tab Layout', () => {
  it('renders all 5 visible tabs', () => {
    // Verify Today, My Team, Players, Explore, Hub tabs render
  });

  it('uses Rink Glass colors for tab bar', () => {
    // Verify tab bar background is dark, active tint is blueLight
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Update _layout.tsx**

- Set `tabBarStyle.backgroundColor` to `rinkGlass.ice` with subtle top border
- Set `tabBarActiveTintColor` to `rinkGlass.blueLight`
- Set `tabBarInactiveTintColor` to `rinkGlass.textMuted`
- Add a glow dot indicator under active tab using a custom `tabBarIcon` wrapper
- Remove any default header styling, set `headerShown: false`

**Step 4: Run test — expect PASS**

**Step 5: Verify in simulator** — navigate between tabs, check glow dot animates

**Step 6: Commit**

```bash
git add app/(tabs)/_layout.tsx app/(tabs)/__tests__/
git commit -m "feat: redesign tab bar with Rink Glass aesthetic"
```

---

## Task 4: Dashboard Module Infrastructure

Create the customizable module system — a service for managing module preferences (order, enabled/disabled) and a container component that renders modules.

**Files:**
- Create: `services/dashboardModules.ts`
- Create: `services/__tests__/dashboardModules.test.ts`
- Create: `components/dashboard/DashboardContainer.tsx`
- Create: `components/dashboard/__tests__/DashboardContainer.test.tsx`
- Create: `types/dashboard.ts`

**Step 1: Write types**

```typescript
// types/dashboard.ts
export type ModuleId = 'startSit' | 'trending' | 'alerts' | 'waiverWire' | 'matchupEdge' | 'dailyInsight';

export interface ModuleConfig {
  id: ModuleId;
  enabled: boolean;
  order: number;
}

export interface DashboardPreferences {
  modules: ModuleConfig[];
  lastCustomized: string | null;
}

export const DEFAULT_MODULES: ModuleConfig[] = [
  { id: 'startSit', enabled: true, order: 0 },
  { id: 'trending', enabled: true, order: 1 },
  { id: 'alerts', enabled: true, order: 2 },
  { id: 'waiverWire', enabled: true, order: 3 },
  { id: 'matchupEdge', enabled: true, order: 4 },
  { id: 'dailyInsight', enabled: true, order: 5 },
];

export const MODULE_META: Record<ModuleId, { title: string; icon: string; description: string }> = {
  startSit: { title: 'Start / Sit', icon: 'swap-horizontal', description: 'Quick lineup decisions for tonight' },
  trending: { title: 'Trending Now', icon: 'trending-up', description: 'Hottest players right now' },
  alerts: { title: 'Alerts', icon: 'notifications', description: 'Injuries, confirmations, lineup changes' },
  waiverWire: { title: 'Waiver Wire', icon: 'search', description: 'Top available pickups' },
  matchupEdge: { title: 'Matchup Edge', icon: 'flash', description: 'Best player matchups tonight' },
  dailyInsight: { title: 'Daily Insight', icon: 'bulb', description: 'One bold insight from our model' },
};
```

**Step 2: Write service tests**

```typescript
// services/__tests__/dashboardModules.test.ts
import { loadDashboardPrefs, saveDashboardPrefs, reorderModules, toggleModule } from '../dashboardModules';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('dashboardModules', () => {
  beforeEach(() => AsyncStorage.clear());

  it('returns default modules when no prefs saved', async () => {
    const prefs = await loadDashboardPrefs();
    expect(prefs.modules).toHaveLength(6);
    expect(prefs.modules[0].id).toBe('startSit');
  });

  it('saves and loads custom preferences', async () => {
    const custom = { modules: [{ id: 'trending', enabled: true, order: 0 }], lastCustomized: '2026-04-05' };
    await saveDashboardPrefs(custom);
    const loaded = await loadDashboardPrefs();
    expect(loaded.modules[0].id).toBe('trending');
  });

  it('toggles a module on/off', () => {
    const modules = [{ id: 'alerts', enabled: true, order: 0 }];
    const result = toggleModule(modules, 'alerts');
    expect(result[0].enabled).toBe(false);
  });

  it('reorders modules', () => {
    const modules = [
      { id: 'startSit', enabled: true, order: 0 },
      { id: 'trending', enabled: true, order: 1 },
    ];
    const result = reorderModules(modules, 1, 0); // move trending to top
    expect(result[0].id).toBe('trending');
    expect(result[0].order).toBe(0);
  });
});
```

**Step 3: Run test — expect FAIL**

**Step 4: Implement dashboardModules.ts**

Pure functions + AsyncStorage persistence:
- `loadDashboardPrefs()` — reads from `puckiq_dashboard_modules`, returns defaults if empty
- `saveDashboardPrefs(prefs)` — writes to AsyncStorage
- `toggleModule(modules, id)` — flips enabled boolean
- `reorderModules(modules, fromIndex, toIndex)` — moves item, recalculates order values

**Step 5: Run test — expect PASS**

**Step 6: Write DashboardContainer component**

A component that:
- Loads module preferences on mount
- Renders enabled modules in order
- Has an "edit mode" toggled by a gear icon
- In edit mode: shows drag handles and enable/disable toggles
- Each module slot renders a placeholder for now (actual modules come in Tasks 5-10)

**Step 7: Write DashboardContainer test**

```typescript
describe('DashboardContainer', () => {
  it('renders modules in order', () => { ... });
  it('hides disabled modules', () => { ... });
  it('shows edit mode when gear tapped', () => { ... });
  it('calls onReorder when module dragged', () => { ... });
});
```

**Step 8: Run all tests — expect PASS**

**Step 9: Commit**

```bash
git add types/dashboard.ts services/dashboardModules.ts services/__tests__/dashboardModules.test.ts \
  components/dashboard/
git commit -m "feat: add customizable dashboard module infrastructure"
```

---

## Task 5: Start/Sit Module

The hero module — shows the user's roster players playing tonight with a tactile START/SIT toggle.

**Files:**
- Create: `components/dashboard/StartSitModule.tsx`
- Create: `components/dashboard/__tests__/StartSitModule.test.tsx`

**Step 1: Write the test**

```typescript
describe('StartSitModule', () => {
  it('renders player cards with projected points', () => { ... });
  it('shows START badge for recommended starters', () => { ... });
  it('toggles START ↔ SIT on tap with animation', () => { ... });
  it('shows model disagreement warning when user overrides', () => { ... });
  it('renders empty state when no roster set', () => { ... });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement StartSitModule**

- Horizontal ScrollView of player cards
- Each card: headshot placeholder (Ionicon person), player name, opponent, projected points (large display font)
- Big toggle: START (faceoffDot green) / SIT (textMuted gray)
- Tap toggle: color wash animation via `useAnimatedStyle` + `withTiming`, haptic feedback via `expo-haptics`
- Model disagreement: amber border pulse + one-line reason text
- Left accent stripe using `rinkGlass.moduleAccents.startSit`
- Frosted glass card background

**Step 4: Run test — expect PASS**

**Step 5: Register module in DashboardContainer**

Add `startSit` to the module renderer map in DashboardContainer.

**Step 6: Commit**

```bash
git add components/dashboard/StartSitModule.tsx components/dashboard/__tests__/StartSitModule.test.tsx \
  components/dashboard/DashboardContainer.tsx
git commit -m "feat: add Start/Sit dashboard module with toggle interaction"
```

---

## Task 6: Trending Now Module

Horizontal scroll of hot player cards with flame intensity and sparklines.

**Files:**
- Create: `components/dashboard/TrendingModule.tsx`
- Create: `components/dashboard/__tests__/TrendingModule.test.tsx`
- Create: `components/Sparkline.tsx` (tiny inline chart component)
- Create: `components/__tests__/Sparkline.test.tsx`

**Step 1: Write Sparkline test**

```typescript
describe('Sparkline', () => {
  it('renders SVG path from data points', () => { ... });
  it('colors line green when trending up', () => { ... });
  it('colors line red when trending down', () => { ... });
});
```

**Step 2: Implement Sparkline**

Minimal inline SVG chart using `react-native-svg` (already installed). Takes `data: number[]`, `width`, `height`, `color` props. Renders a simple polyline.

**Step 3: Write TrendingModule test**

```typescript
describe('TrendingModule', () => {
  it('renders horizontal scroll of player cards', () => { ... });
  it('shows flame count based on streak intensity', () => { ... });
  it('shows sparkline on each card', () => { ... });
  it('flips card on tap to show why', () => { ... });
  it('has Watch button that triggers callback', () => { ... });
});
```

**Step 4: Implement TrendingModule**

- Horizontal FlatList of cards
- Each card: player name, team, flame meter (1-5 🔥), sparkline, points trend
- Tap → card flips (3D Y-rotation via reanimated `rotateY` + `backfaceVisibility`)
- Back of card: recent game log, matchup tonight, ownership %
- "Watch" button with pulse animation on press
- Left accent stripe: `rinkGlass.moduleAccents.trending` (goalLight pink)

**Step 5: Run tests — expect PASS**

**Step 6: Register in DashboardContainer + commit**

```bash
git commit -m "feat: add Trending Now module with sparklines and card flip"
```

---

## Task 7: Alerts Feed Module

Timeline of fantasy-relevant alerts, color-coded by type, swipeable.

**Files:**
- Create: `components/dashboard/AlertsModule.tsx`
- Create: `components/dashboard/__tests__/AlertsModule.test.tsx`
- Create: `services/fantasyAlerts.ts`
- Create: `services/__tests__/fantasyAlerts.test.ts`

**Step 1: Write alert service test**

```typescript
describe('fantasyAlerts', () => {
  it('fetches goalie confirmations from Supabase', async () => { ... });
  it('fetches injury updates', async () => { ... });
  it('prioritizes alerts for user roster players', async () => { ... });
  it('marks alerts as dismissed', async () => { ... });
});
```

**Step 2: Implement fantasyAlerts service**

- `fetchAlerts(rosterPlayerIds?)` — queries Supabase for today's goalie confirmations, injuries, lineup changes
- `dismissAlert(alertId)` — saves to AsyncStorage `puckiq_dismissed_alerts`
- `saveAlert(alertId)` — saves to AsyncStorage `puckiq_saved_alerts`
- Each alert has: `id`, `type` ('injury' | 'goalie' | 'lineup'), `playerName`, `team`, `message`, `timestamp`, `isRosterPlayer`

**Step 3: Write AlertsModule test**

```typescript
describe('AlertsModule', () => {
  it('renders timeline of alerts', () => { ... });
  it('color-codes by type (red=injury, green=goalie, amber=lineup)', () => { ... });
  it('highlights roster player alerts with glow border', () => { ... });
  it('swipe right dismisses alert', () => { ... });
  it('shows empty state when no alerts', () => { ... });
});
```

**Step 4: Implement AlertsModule**

- Vertical list of compact alert cards
- Color-coded left stripe: redLine (injury), faceoffDot (goalie confirmed), powerPlay (lineup change)
- Roster player alerts: subtle glow border in blueLight
- Swipe gestures via `react-native-gesture-handler` (PanGestureHandler or Swipeable)
- Entry animation: FadeInDown with stagger

**Step 5: Run all tests — expect PASS**

**Step 6: Register + commit**

```bash
git commit -m "feat: add Alerts feed module with color-coded timeline"
```

---

## Task 8: Waiver Wire Module

Top pickups with value scores and inline comparison.

**Files:**
- Create: `components/dashboard/WaiverWireModule.tsx`
- Create: `components/dashboard/__tests__/WaiverWireModule.test.tsx`

**Step 1: Write test**

```typescript
describe('WaiverWireModule', () => {
  it('renders top 3 waiver pickups with value scores', () => { ... });
  it('shows ownership percentage', () => { ... });
  it('expands inline comparison on Compare tap', () => { ... });
  it('shows checkmark animation on Add tap', () => { ... });
});
```

**Step 2: Implement WaiverWireModule**

- 3 compact cards, each with: player name, team, position, value score badge ("+4.2"), ownership %
- "Compare" button → inline expand showing side-by-side vs user's weakest starter at that position
- "Add" button → checkmark animation + add to watchlist
- Left accent stripe: `rinkGlass.moduleAccents.waiverWire` (blueLight)
- Value score badge uses large display font with green/amber coloring

**Step 3: Run test — expect PASS**

**Step 4: Register + commit**

```bash
git commit -m "feat: add Waiver Wire module with inline comparisons"
```

---

## Task 9: Matchup Edge Module

Tonight's best fantasy matchups based on opponent weakness.

**Files:**
- Create: `components/dashboard/MatchupEdgeModule.tsx`
- Create: `components/dashboard/__tests__/MatchupEdgeModule.test.tsx`

**Step 1: Write test**

```typescript
describe('MatchupEdgeModule', () => {
  it('renders matchup cards with edge rating', () => { ... });
  it('uses gradient intensity based on edge strength', () => { ... });
  it('expands inline bullets on tap', () => { ... });
});
```

**Step 2: Implement MatchupEdgeModule**

- Compact cards: player headshot placeholder + "vs" + opponent team logo + edge rating (1-10)
- Card background gradient: stronger matchup = more vivid green tint
- Tap → inline expand with 2-3 bullet reasons ("PIT allows 4th-most goals to centers", etc.)
- Left accent stripe: `rinkGlass.moduleAccents.matchupEdge` (purple)

**Step 3: Run test — expect PASS**

**Step 4: Register + commit**

```bash
git commit -m "feat: add Matchup Edge module with gradient intensity"
```

---

## Task 10: Daily Insight Module

One bold ML-powered insight with shareable design.

**Files:**
- Create: `components/dashboard/DailyInsightModule.tsx`
- Create: `components/dashboard/__tests__/DailyInsightModule.test.tsx`

**Step 1: Write test**

```typescript
describe('DailyInsightModule', () => {
  it('renders bold headline text', () => { ... });
  it('uses sentiment-colored background', () => { ... });
  it('expands to show context on tap', () => { ... });
  it('has share button', () => { ... });
});
```

**Step 2: Implement DailyInsightModule**

- Large display font headline (the insight)
- Background color: teal (bullish), warm red (bearish), amber (surprising)
- Tap → expand to show 2-sentence context + data backing
- Share button (prominent, right side) — uses `shareCards` service
- Left accent stripe: `rinkGlass.moduleAccents.dailyInsight` (orange)
- Designed to be screenshot-worthy

**Step 3: Run test — expect PASS**

**Step 4: Register + commit**

```bash
git commit -m "feat: add Daily Insight module with sentiment coloring"
```

---

## Task 11: Wire Dashboard into Today Tab

Replace the current Today tab content with the new DashboardContainer.

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Keep: HeroBanner (optional — could become a module or stay as hero)

**Step 1: Decide hero banner strategy**

The HeroBanner showing tonight's top pick is currently hardcoded at the top. Options:
- Keep it as a fixed hero above the module stack (recommended — gives the page a focal point)
- Convert it to a module (loses prominence)

**Step 2: Update index.tsx**

- Import DashboardContainer
- Replace the current game card list + insight feed with DashboardContainer
- Keep HeroBanner at top as the "above the fold" hero
- Keep pull-to-refresh
- Add "Customize" gear icon in header (or use existing settings icon)
- Add first-launch module picker modal (simple checklist of modules)

**Step 3: Write/update test for index.tsx**

Verify DashboardContainer renders, hero banner renders, pull-to-refresh works.

**Step 4: Run tests — expect PASS**

**Step 5: Verify in simulator**

Navigate to Today tab. Should see hero banner + module stack. Tap gear → edit mode.

**Step 6: Commit**

```bash
git commit -m "feat: wire customizable dashboard into Today tab"
```

---

## Task 12: Restyle Players Tab

Apply Rink Glass aesthetic to the Players tab — frosted glass cards, accent colors, sparklines.

**Files:**
- Modify: `app/(tabs)/players.tsx`

**Step 1: Update color references**

Replace all `theme.card`, `theme.background` etc. with `rinkGlass` tokens where appropriate. Add left-accent stripes to player cards. Use display font for large point numbers.

**Step 2: Add sparklines to player rows**

Import Sparkline component. Add a mini trend chart to each player row showing their last 10 games.

**Step 3: Enhance the league leader hero card**

Use display font for the big point number. Add a subtle ice-blue glow behind the #1 player card.

**Step 4: Run existing Players tests**

Run: `npx jest app/\\(tabs\\)/__tests__/players.test.tsx --no-coverage`

**Step 5: Verify in simulator**

**Step 6: Commit**

```bash
git commit -m "feat: restyle Players tab with Rink Glass aesthetic"
```

---

## Task 13: Restyle Explore Tab

Apply Rink Glass to the Explore tab — team comparison cards, edge stats, factor display.

**Files:**
- Modify: `app/(tabs)/stats.tsx`

**Step 1: Update colors and card treatments**

- Frosted glass cards for team comparison
- Accent-colored edge stat numbers
- Display font for key numbers
- Better visual separation between segment sections

**Step 2: Run existing tests**

**Step 3: Verify in simulator**

**Step 4: Commit**

```bash
git commit -m "feat: restyle Explore tab with Rink Glass aesthetic"
```

---

## Task 14: Restyle Hub + Premium Screens

Apply Rink Glass to Hub, PremiumGate, and PaywallModal.

**Files:**
- Modify: `components/HubScreen.tsx`
- Modify: `components/PremiumGate.tsx`
- Modify: `components/PaywallModal.tsx`

**Step 1: Update HubScreen**

- Replace DT tokens with rinkGlass tokens
- Use display font for stats numbers
- Enhance subscription card with more vivid gradient
- Better visual hierarchy for notification toggles

**Step 2: Update PremiumGate**

- Use rinkGlass.ice as base
- Pulsing glow in blueLight instead of current blue
- Benefits list with module accent colors per benefit
- CTA button gradient using blueLight → goalLight

**Step 3: Update PaywallModal**

- Match Rink Glass palette
- Annual plan highlight with faceoffDot green
- Display font for pricing

**Step 4: Run existing tests**

**Step 5: Verify in simulator**

**Step 6: Commit**

```bash
git commit -m "feat: restyle Hub and premium screens with Rink Glass"
```

---

## Task 15: Module Edit Mode UX

Polish the dashboard customization experience — drag to reorder, toggle on/off, first-launch picker.

**Files:**
- Modify: `components/dashboard/DashboardContainer.tsx`
- Create: `components/dashboard/ModulePicker.tsx` (first-launch modal)
- Create: `components/dashboard/__tests__/ModulePicker.test.tsx`

**Step 1: Implement ModulePicker**

A modal shown on first launch (when `puckiq_dashboard_modules` is not set):
- List of all 6 modules with icon, title, description
- Checkboxes to enable/disable
- "Let's Go" button to save and dismiss
- Frosted glass card per module

**Step 2: Polish edit mode in DashboardContainer**

- Drag handles on each module card (using react-native-gesture-handler)
- Toggle switches for enable/disable
- "Done" button to exit edit mode and save
- Subtle shake animation when entering edit mode

**Step 3: Run tests — expect PASS**

**Step 4: Commit**

```bash
git commit -m "feat: add module picker and polish edit mode UX"
```

---

## Task 16: Final Integration Test + Polish

Run the full test suite, fix any regressions, verify all screens in simulator.

**Step 1: Run full test suite**

Run: `npx jest --no-coverage`

Fix any new failures (expect existing 19 pre-existing failures to remain).

**Step 2: Full simulator audit**

Screenshot every tab:
- Today (dashboard with modules)
- My Team (premium gate or roster view)
- Players (restyled)
- Explore (restyled)
- Hub (restyled)

**Step 3: Fix visual issues**

Any spacing, color, or animation issues found during audit.

**Step 4: Final commit**

```bash
git commit -m "feat: complete Rink Glass redesign — all screens polished"
```

---

## Execution Notes

### Dependencies between tasks
- **Task 1 (tokens)** must be done first — everything depends on it
- **Task 2 (font)** should be done early — modules use display font
- **Task 3 (tab bar)** is independent
- **Task 4 (infrastructure)** must be done before Tasks 5-10
- **Tasks 5-10 (modules)** are independent of each other, can be parallelized
- **Task 11 (wire up)** depends on Task 4 + at least 2 modules built
- **Tasks 12-14 (restyle)** are independent of each other
- **Task 15 (edit mode)** depends on Task 4
- **Task 16 (final)** is last

### Parallel execution groups
- Group A: Tasks 1, 2 (foundation)
- Group B: Tasks 3, 4 (infrastructure) — after Group A
- Group C: Tasks 5, 6, 7, 8, 9, 10 (modules) — after Task 4, parallelizable
- Group D: Tasks 11, 12, 13, 14, 15 (integration + restyle) — after Group C
- Group E: Task 16 (final) — last

### Key files to never break
- `services/pickTracking.ts` — core pick algorithm
- `services/analytics/AnalyticsService.ts` — analytics singleton
- `constants/theme.ts` — must keep backwards compatibility
- `app/_layout.tsx` — root layout, font loading, providers
