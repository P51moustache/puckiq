# PuckIQ "Rink Glass" Redesign — Design Document

**Date**: 2026-04-05
**Status**: Approved
**Goal**: Transform PuckIQ from a passive data viewer into a fun, customizable fantasy hockey tool with a distinctive visual identity.

---

## Problem Statement

The app presents information passively. Users have no motivation to interact — 22 of 26 interactive elements just open modals or share text. The visual design is flat navy-on-navy with no texture, hierarchy, or personality. Every card looks the same. There is no daily retention loop.

## Core Principle

**Question → Insight → Decision → Confidence**

The user opens the app with a fantasy question ("Who should I start?"), gets a fast visual answer, makes a decision with one tap, and leaves feeling smart. Every module delivers this loop.

---

## 1. Customizable Dashboard (Today Tab)

The Today tab becomes a **card-based dashboard** with reorderable, toggleable modules.

### Available Modules

| Module | Primary Interaction | Data Source |
|--------|-------------------|-------------|
| **Start/Sit Quick Picks** | Tap toggle START ↔ SIT | fantasyProjections service + roster |
| **Trending Now** | Horizontal scroll, tap to flip card | Player trending data |
| **Alerts Feed** | Swipe to dismiss/save | Goalie confirmations, injuries, lineup changes |
| **Waiver Wire Gems** | Tap "Compare" for inline expand | fantasyProjections + ownership data |
| **Matchup Edge** | Tap to expand inline bullets | Game matchup data + ML edge scores |
| **Daily Insight** | Tap to expand, share button | ML model insights |

### Customization UX

- First launch: "What matters to you?" module picker (checkboxes)
- Long-press any module → edit mode (drag to reorder, toggle on/off)
- Gear icon in header for settings
- Stored in AsyncStorage key: `puckiq_dashboard_modules`

### Module Interaction Patterns

**Start/Sit Quick Picks:**
- Horizontal player cards: headshot, opponent, projected points
- Big START (green) / SIT (gray) toggle — tap to flip with haptic + color wash animation
- Model disagreement: amber pulse border + one-line reason
- Swipe left = dismiss, swipe right = pin

**Trending Now:**
- Horizontal scroll of cards with flame intensity meter (1-5)
- Inline sparkline (10-game trend, no tap needed)
- Tap → card flips to show "why" (stats, matchup, ownership %)
- "Watch" button with pulse animation

**Alerts Feed:**
- Timeline cards, color-coded: red (injury), green (confirmed starter), amber (lineup change)
- YOUR players get glow border
- Swipe right = dismiss, swipe left = save

**Waiver Wire Gems:**
- Value score badge: "+4.2" (projected improvement over worst starter)
- Tap "Compare" → inline side-by-side vs your current player
- Tap "Add" → checkmark animation

**Matchup Edge:**
- Compact: headshot + "vs" + opponent logo + edge rating
- Green-to-neutral gradient based on edge strength
- Tap → inline expand with 2-3 bullet explanations

**Daily Insight:**
- Large bold headline typography
- Background color matches sentiment (teal=bullish, warm red=bearish, amber=surprising)
- Tap → expand 2-sentence context
- Prominent share button (designed to be screenshot-worthy)

---

## 2. Visual Identity: "Rink Glass"

Inspired by looking through arena glass during a night game. Cold, sharp, atmospheric.

### Color Tokens

```typescript
const rinkGlass = {
  // Backgrounds
  ice: '#0a0e1a',           // True black base
  glass: 'rgba(255,255,255,0.06)',  // Frosted card bg
  boards: '#1a1f2e',        // Secondary surfaces
  zamboni: '#2a3142',       // Elevated elements

  // Accent Colors
  blueLight: '#4cc9f0',     // Primary accent — icy electric
  goalLight: '#f72585',     // Celebrations, hot badges, streaks
  powerPlay: '#ffd60a',     // Warnings, model disagreements
  faceoffDot: '#06d6a0',    // Positive: START, confirmed, green
  redLine: '#e63946',       // Urgent: SIT, injuries, negative

  // Text
  textPrimary: '#f0f4f8',
  textSecondary: '#7a8ba0',
  textMuted: '#4a5568',

  // Borders & Glass
  glassBorder: 'rgba(255,255,255,0.08)',
  glassHighlight: 'rgba(255,255,255,0.12)',
  cardGlow: 'rgba(76,201,240,0.15)',
};
```

### Typography

- **Headlines/Screen titles**: Bold condensed weight — tight, urgent, sporty (scoreboard feel)
- **Body text**: Clean sans-serif, high readability at small sizes
- **Numbers/Stats**: Monospace or tabular figures — stats align perfectly
- **Large numbers** (points, projections, rankings): Display weight, oversized

### Card Treatment

- Frosted glass: subtle white overlay on dark base + 1px `glassBorder`
- Left-edge accent color stripe per card category
- Micro-shadows that deepen on press (3D effect)
- Each card type visually distinct — no more uniform navy boxes

### Animations

- **Page entry**: Cards stagger in from bottom, spring physics (fast, snappy)
- **Card press**: scale(0.98) + shadow deepen → spring release
- **START/SIT toggle**: Color wash sweeps across card + haptic
- **Streak fire**: Animated flame particles (keyframe-based)
- **Alert arrival**: Slide from top
- **Card flip** (Trending): 3D Y-axis rotation to reveal back

### Tab Bar

- Active icon: `blueLight` color + glow dot underneath
- Badge count on Today tab for pending alerts
- Background: near-black with frost blur of content behind

---

## 3. Screen-by-Screen Changes

### Today Tab (→ "My Dashboard")
- Remove hero banner as fixed element
- Replace with customizable module stack
- Add "Customize" gear icon in header
- Module edit mode with drag handles
- Each module has distinct visual identity via left-accent color

### Players Tab
- Keep league leaders + goalie spotlight structure
- Add flame intensity to trending players
- Add inline sparklines to player rows
- Player detail stays as modal but with updated Rink Glass styling
- Add "Watch" / "Compare" quick actions to player rows

### Explore Tab
- Keep Teams / Edge / Factors / Models segment control
- Update card styling to Rink Glass treatment
- Team comparison gets side-by-side frosted glass cards
- Edge stats get larger typography and accent colors

### My Team Tab (Premium)
- Already has Start/Sit cards — update to new toggle pattern
- Weekly Outlook gets sparkline treatment
- Waiver Wire section gets value score badges
- All cards get Rink Glass treatment

### Hub Tab
- Update to Rink Glass color tokens
- Stats row gets more visual weight (larger numbers, accent colors)
- Subscription card gets a more compelling visual treatment
- Notification toggles get category-colored icons

---

## 4. Data Architecture

### New AsyncStorage Keys
```
puckiq_dashboard_modules    — Array of { id, enabled, order }
puckiq_watchlist            — Array of player IDs
puckiq_dismissed_alerts     — Array of alert IDs
puckiq_saved_alerts         — Array of alert IDs
```

### Module Data Sources (existing services)
- Start/Sit: `fantasyProjections.ts` + `fantasyRoster.ts`
- Trending: `services/playerTrending.ts` (existing)
- Alerts: Supabase `games` table + goalie data
- Waiver Wire: `fantasyProjections.ts`
- Matchup Edge: `services/pickTracking.ts` edge scores
- Daily Insight: `services/insights.ts` (existing)

---

## 5. What We're NOT Doing

- No XP/leveling system
- No achievements/badges
- No daily challenges
- No tournament brackets
- No social feed
- No chat
- We ARE keeping: accuracy tracking, leaderboard, referrals, picks (existing)
- We ARE adding: customizable modules, better interactions, visual overhaul
