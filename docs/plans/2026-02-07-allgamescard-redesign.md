# AllGamesCard Redesign — Declutter with Split Layout

**Date:** 2026-02-07
**Status:** Approved
**Component:** `components/AllGamesCard.tsx`
**Goal:** Reduce visual clutter while preserving key information by giving each element clear spatial ownership.

## Problem

The AllGamesCard crams too many elements into a single horizontal flow: logos, sparklines, team abbreviations, probability bar, percentage, confidence badge, H2H chip, insight text, factor dots, and share icon. Users can't scan the cards quickly.

## Design

### Layout: Three Rows, Clear Zones

```
┌─────────────────────────────────────────────────┐
│ ▎                                                │
│ ▎  [AWY] AWY  @  HOM [HOM]       [STRONG]       │  <- Row 1: Matchup + Badge
│ ▎  Thu, Feb 26 · 4:00 PM                        │
│ ▎                                                │
│ ▎  ████████████░░░░░░░░░░░░░░░░░░░░░░░░   78%   │  <- Row 2: Probability bar
│ ▎                                                │
│ ▎  Series tied 1-1    NJD in a cold streak   ↗   │  <- Row 3: H2H + Insight
│ └─────────────────────────────────────────────────┘
```

### Row 1 — Matchup + Confidence (top)
- Team logos (28px) + abbreviations in team colors, horizontal layout
- `@` separator between teams
- Game time + date on a second line, left-aligned, subtext color
- Confidence badge (STRONG/LEAN/LOCK/TOSS-UP) pinned to the top-right corner
- Live games: green pulsing border (unchanged)

### Row 2 — Probability Bar (center, visual anchor)
- Bar height increases: 8px -> 12px
- Bar gets rounded ends (borderRadius: 6)
- Full width of the card (minus left accent border)
- Win percentage right-aligned after the bar
- Team colors on the bar (unchanged logic)

### Row 3 — Context (bottom)
- H2H chip on the left (blue pill, unchanged style)
- Insight text on the right, single line + ellipsis, favored team color at 80% opacity
- Share icon at far right

### Removed from Card
- **FormSparklines** — too small (36x14px) to provide value at this size
- **Factor dots** (MTM, REST, H2H) — cryptic without explanation, live in modal instead

### Visual Changes
- Card padding: 14px -> 16px
- Background gradient opacity reduced: `22`/`18` hex -> `15`/`10` hex (subtler team tint)
- Left accent border stays at 4px
- Entry animation stays (FadeInUp with spring)
- Press animation stays (scale spring)

### What Stays Unchanged
- ConfidenceBadge component (no changes)
- Team color logic (getBarColors, pickVisibleColor, etc.)
- Live game pulsing border
- Haptic feedback on press
- Deep dive modal integration

## Files Changed

- `components/AllGamesCard.tsx` — Layout restructure + style updates
- `app/(tabs)/index.tsx` — Remove `awayForm`/`homeForm` props from AllGamesCard calls (sparklines removed)

## Files NOT Changed

- `components/CompactGameRow.tsx` — Out of scope
- `components/HeroBanner.tsx` — Out of scope
- `components/ConfidenceBadge.tsx` — No changes needed
- `components/FormSparkline.tsx` — Still used by HeroBanner, just removed from AllGamesCard

## Testing

- Visual verification in iOS simulator after implementation
- Existing tests for AllGamesCard should still pass (layout-only change)
- Verify live game state, final state, and upcoming state all render correctly
