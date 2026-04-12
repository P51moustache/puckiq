# Hero Matchup Card — Design Doc

**Date:** 2026-04-06
**Feature:** Compact hero banner on the Today tab showing the day's top fantasy matchup

## Overview

Add a 120-140px frosted-glass hero card between the PuckIQ header and the Command Center. It spotlights the day's best fantasy matchup — the game with the highest projected fantasy value — to hook users immediately on open.

## Layout

```
┌─────────────────────────────────────────┐
│  MATCHUP OF THE DAY            8:00 PM  │
│                                         │
│   (away logo)    VS    (home logo)      │
│     CGY                    EDM          │
│   32-36-8              39-29-9          │
│                                         │
│  ████████████░░░░  85% EDM   6.2 avg pts│
└─────────────────────────────────────────┘
```

## Visual Spec

- **Container:** `rinkGlass.glass` background, `glassBorder`, borderRadius 16, marginHorizontal 16
- **Team tint:** Subtle left-to-right gradient using both teams' primary colors at ~8% opacity
- **Team logos:** 40x40px via `getTeamLogoUrl()`, centered with "VS" between them
- **Typography:** Team abbrevs in `Display-Bold` 16px, records in `textSecondary` 11px
- **Badge:** "MATCHUP OF THE DAY" pill — `rinkGlass.faceoffDot` background, white text, upper-left
- **Game time:** Upper-right, `textSecondary` 12px
- **Confidence bar:** 4px horizontal bar, filled in `faceoffDot`, percentage + team abbrev to the right
- **Fantasy stat:** "6.2 avg pts" — average projected fantasy points across players in this game, right-aligned on the bar row
- **Entry animation:** `FadeInDown` from reanimated, springy

## Off-Day State (Next Game Preview)

Same layout with these changes:
- Badge: "NEXT UP" in `rinkGlass.blueLight` instead of "MATCHUP OF THE DAY"
- Date: "Tomorrow · 8:00 PM" instead of just time
- No confidence bar (predictions not generated yet)
- Fantasy teaser: "3 of your roster playing" or player-level projection if available

## Data Source

- **Game day:** `useTonightData()` provides `todaysGames`. Select the game with the highest model confidence from `ml_predictions` or the first game. Team records from `standings` table.
- **Off-day:** Query Supabase `games` table: `game_date > today`, `game_state = 'FUT'`, order by `game_date asc`, limit 1.
- **Fantasy stat:** Average projected fantasy points from `ml_player_projections` for players in the selected game, or fallback to a static value for off-days.

## Position in Screen

Between the PuckIQ header (line 57 of index.tsx) and the Command Center (line 85). Replaces the current gap.

## Component

New file: `components/HeroMatchupCard.tsx`
- Props: `game`, `confidence`, `avgFantasyPoints`, `isNextUp`
- Uses `expo-image` for team logos (already a dependency)
- Uses `react-native-reanimated` for entry animation
- Uses `getTeamColors()` from `constants/teamColors.ts` for the tint gradient

## Fallback

If no games exist at all (deep off-season), the hero card simply doesn't render — the Command Center takes over the full screen as it does now.
