# PuckIQ Design System & Style Guide

> Reference for all agents doing UI work. Source of truth: `constants/theme.ts`.
> Research basis: Apple Sports, Bloomberg Terminal, FanDuel, DraftKings.

---

## 1. Semantic Accent Colors

PuckIQ uses 5 semantic accent colors. Every color in the UI must map to one of these meanings. Never use raw hex values -- always reference theme tokens.

| Token | Hex | Meaning | When to Use |
|---|---|---|---|
| `theme.semantic.positive` | `#10b981` | Good / Win / Up | Win indicators, positive trends, confidence gains, "best bet" badges, successful results |
| `theme.semantic.negative` | `#ef4444` | Bad / Loss / Down | Loss indicators, negative trends, confidence drops, toss-up warnings, error states |
| `theme.semantic.neutral` | `#fbbf24` | Neutral / Caution | Informational badges, streak fire, gold rewards, moderate confidence, pending states |
| `theme.semantic.info` | `#60a5fa` | Action / Accent | CTAs, links, interactive elements, primary accent, selected states, XP/pucks |
| `theme.colors.textSecondary` | `#98a6bf` | Muted / Label | Labels, captions, secondary text, disabled states, timestamps |

### Rules
- Win/loss indicators MUST use positive/negative -- never arbitrary colors
- Data change flashes use positive (green flash) or negative (red flash) per FanDuel pattern
- Gold (`neutral`) is reserved for rewards, streaks, and celebrations -- do not use for errors
- The accent blue (`info`) is the only CTA color -- buttons, links, tappable elements

### Confidence Color Mapping
These map to `pickTheme.confidence` and align with semantic colors:
- Best Bet = `semantic.positive` (#10b981)
- Solid = `info` blue (#3b82f6)
- Good = `semantic.neutral` amber (#f59e0b)
- Toss-Up = `semantic.negative` (#ef4444)

---

## 2. Elevation Levels

Four distinct shadow profiles create visual depth hierarchy. Inspired by Bloomberg's layered panels.

| Level | Token | Shadow | Use For |
|---|---|---|---|
| **Low** | `theme.elevation.low` | 2px offset, 0.1 opacity, 4px radius | Inline elements, chips, badges, pills, subtle separation |
| **Medium** | `theme.elevation.medium` | 4px offset, 0.15 opacity, 8px radius | Standard cards, list items, factboxes |
| **High** | `theme.elevation.high` | 6px offset, 0.2 opacity, 12px radius | Modals, popovers, floating action buttons, expanded cards |
| **Glow** | `theme.elevation.glow` | 4px offset, 0.25 opacity, 16px radius | Hero cards, premium/featured content, LIVE game cards, celebration states |

### Component-to-Elevation Map
```
elevation.low     -> ConfidenceBadge, SeasonSeriesBadge, ClutchBadge, pills, chips
elevation.medium  -> AllGamesCard rows, factboxes, player cards, stats rows
elevation.high    -> GameDeepDiveModal, DataSeedingModal, expanded detail panels
elevation.glow    -> HeroMatchup card, LIVE game ticker items, TopPick/LockOfDay card
```

### Rules
- `shadowColor` is always `'#000'` on the dark background
- Glow elevation can combine with a team-color `shadowColor` for branded hero cards
- On Android, only the `elevation` number matters (shadows are system-rendered)
- Never stack multiple shadow levels on the same element

---

## 3. Glassmorphism Treatment

Glass effects create premium depth. Uses `expo-blur` BlurView on iOS, fallback rgba backgrounds on Android/Web.

### Tokens
| Token | Value | Purpose |
|---|---|---|
| `theme.glass.bg` | `rgba(255,255,255,0.08)` | Default glass surface background |
| `theme.glass.bgHover` | `rgba(255,255,255,0.12)` | Pressed/hover state for glass surfaces |
| `theme.glass.border` | `rgba(255,255,255,0.15)` | Standard glass border (subtle) |
| `theme.glass.borderBright` | `rgba(255,255,255,0.25)` | Emphasized glass border (hero cards, selected states) |
| `theme.glass.blur` | `60` | BlurView intensity (expo-blur scale 1-100) |

### When to Use BlurView vs Glass Border Only

**Full BlurView treatment** (expo-blur with `intensity={theme.glass.blur}`):
- Hero matchup card (the main featured game)
- LIVE game overlay/ticker
- Modal backdrops
- Premium/featured content cards
- Requires a background image or gradient underneath to blur

**Glass border only** (no BlurView, just `glass.border` + `glass.bg`):
- Standard game cards
- Stat factboxes
- Badges and pills
- Any card without a gradient/image behind it
- Use when BlurView would blur a plain solid color (no visual benefit)

### Implementation Pattern
```tsx
// Full glass (hero cards, modals)
<BlurView intensity={theme.glass.blur} tint="dark">
  <View style={{
    backgroundColor: theme.glass.bg,
    borderWidth: 1,
    borderColor: theme.glass.borderBright,
    borderRadius: 16,
  }}>
    {children}
  </View>
</BlurView>

// Glass border only (standard cards)
<View style={{
  backgroundColor: theme.glass.bg,
  borderWidth: 1,
  borderColor: theme.glass.border,
  borderRadius: 12,
}}>
  {children}
</View>
```

### Rules
- BlurView intensity range: 40-60 (never above 80 -- it washes out)
- Glass borders should be 1px only -- never 2px+
- Team-color tinting: overlay the team's primary color at 10-15% opacity on glass.bg
- Always provide a non-blur fallback for Android/Web using `glass.bg`

---

## 4. Typography Hierarchy

Two font families serve distinct purposes. Inspired by Bloomberg (monospace data) and Apple Sports (bold condensed numerals).

### Font Selection Rules

| Font | Token | When to Use |
|---|---|---|
| **Monospace** | `theme.fonts.mono` | All numerical data: scores, percentages, win probabilities, countdown timers, stat values, odds, record numbers (W-L-OTL) |
| **System** | `theme.fonts.system` | Everything else: headlines, body text, labels, buttons, descriptions, team names |

### Why Monospace for Numbers
- Numbers align vertically in columns (Bloomberg pattern)
- Score tickers look clean when digits are equal-width
- Percentage changes don't shift layout as values update
- Countdown timers don't jitter

### Typography Scale (from `theme.typography`)
| Token | Size | Weight | Use For |
|---|---|---|---|
| `sizes['3xl']` | 32px | bold (700) | Screen titles, hero scores |
| `sizes['2xl']` | 24px | bold (700) | Section headings, large stat values |
| `sizes.xl` | 20px | semibold (600) | Card titles, team names |
| `sizes.lg` | 18px | semibold (600) | Subheadings, prominent labels |
| `sizes.base` | 16px | normal (400) | Body text, descriptions |
| `sizes.sm` | 14px | normal (400) | Secondary body, card content |
| `sizes.xs` | 12px | normal (400) | Captions, timestamps, labels |

### Pre-built Text Styles
Use `textStyles` export for common patterns: `h1`, `h2`, `h3`, `body`, `bodySmall`, `caption`, `label`, `button`.

### Rules
- `label` style uses uppercase + letter-spacing for section headers (e.g., "GAME TIME", "SEASON SERIES")
- Monospace numbers should be bold (700) or extrabold (800) for scores, medium (500) for secondary stats
- Never mix system and mono fonts within the same text element
- Team names are always system font, even next to monospace scores

---

## 5. Card Styling Rules

### Card Types and Their Treatments

**Standard Card** (game listings, stat rows):
```
backgroundColor: theme.card (#192e5eff)
borderRadius: 12-14
padding: 15-16
elevation: medium
border: none (or 1px theme.glass.border for glass variant)
```

**Factbox Card** (inline stat highlights):
```
backgroundColor: theme.factbox (#334e8dff)
borderRadius: 14
padding: 8-12
elevation: medium
minHeight: 80
```

**Hero Card** (featured game, lock of the day):
```
backgroundColor: theme.glass.bg over LinearGradient
borderRadius: 16
padding: 20
elevation: glow
border: 1px theme.glass.borderBright
BlurView: intensity 60
```

**Pick/Prediction Card** (smart picks, confidence cards):
```
backgroundColor: pickTheme.card.background (#1a0a2e)
borderRadius: 14
padding: 16
elevation: high
border: 1px pickTheme.card.border (#7c3aed)
```

### Border Treatment Rules
- Standard cards: no visible border (background contrast is enough)
- Glass cards: 1px `glass.border` or `glass.borderBright`
- Pick cards: 1px purple border (`pickTheme.card.border`)
- Selected/active state: border brightens from `glass.border` to `glass.borderBright`
- Never use borders thicker than 1px on cards

### Gradient Usage
Gradients come from `pickTheme.gradients`:

| Gradient | Colors | Use For |
|---|---|---|
| `topPick` | purple -> blue -> pink | Top/lock pick hero card backgrounds |
| `card` | deep indigo -> indigo | Standard pick card backgrounds |
| `celebration` | gold -> amber | Achievement unlocks, milestone celebrations |

### Rules
- Gradients are background-only -- never gradient text (poor accessibility)
- LinearGradient direction: top-to-bottom for cards, left-to-right for progress bars
- Team-color gradients (Apple Sports pattern): use team primary + team secondary at 60-80% opacity as card background, glass overlay on top
- Limit gradients to 1 per visible card -- too many gradients compete for attention

---

## 6. Animation Guidelines

Animations add "juice" (per Homer persona) without being distracting. Spring physics from DraftKings, data flashes from FanDuel.

### Timing Tokens (from `theme.animation`)

| Token | Value | Purpose |
|---|---|---|
| `animation.spring` | `{ damping: 15, stiffness: 150 }` | Default spring config for all spring animations |
| `animation.entryDuration` | `400ms` | Fade/slide-in duration for content appearing on screen |
| `animation.staggerDelay` | `80ms` | Delay between sequential items animating in (lists, cards) |
| `animation.flashDuration` | `600ms` | Duration of color flash effects (win/loss, data change) |

### Animation Types

**Entry animations** (content appearing):
- Fade in: opacity 0 -> 1 over `entryDuration` (400ms)
- Slide up: translateY 20 -> 0 combined with fade, using spring config
- Stagger: each item in a list delays by `staggerDelay` (80ms) -- e.g., 5 game cards = 0ms, 80ms, 160ms, 240ms, 320ms

**Press feedback** (DraftKings pattern):
- Scale: 1.0 -> 0.97 -> 1.0 using spring config
- Duration: handled by spring physics (damping 15, stiffness 150 = snappy ~200ms settle)
- Apply to all tappable cards and buttons

**Data change flash** (FanDuel pattern):
- When a numeric value changes, flash the background:
  - Increase: flash `semantic.positive` at 30% opacity for `flashDuration` (600ms)
  - Decrease: flash `semantic.negative` at 30% opacity for `flashDuration` (600ms)
- Fade the flash color out with ease-out curve
- Apply to: scores, probabilities, odds, confidence percentages

**Number counting** (Bloomberg pattern):
- Large stats animate from 0 to final value over `entryDuration`
- Use `Animated.timing` with ease-out
- Only on first appearance -- not on every re-render

**Progressive disclosure** (DraftKings pattern):
- Expandable cards use spring for height animation
- Chevron rotates 180deg on expand/collapse
- Content inside fades in after expansion completes (stagger 80ms)

### Rules
- Never animate more than 3 properties simultaneously on one element
- Disable animations if `useReducedMotion()` returns true (accessibility)
- Spring physics for interactive feedback, timing curves for automated transitions
- No animation should exceed 600ms total duration
- LIVE content pulses: subtle opacity oscillation 0.7 -> 1.0, 2s loop, ease-in-out

---

## 7. Spacing & Layout

### 8-Point Grid (from `theme.spacing`)
All spacing values are multiples of 4, with the primary scale at 8pt intervals.

| Token | Value | Use For |
|---|---|---|
| `spacing.xs` | 4px | Tight gaps: icon-to-text, badge padding |
| `spacing.sm` | 8px | Small gaps: between badges, inner card padding |
| `spacing.md` | 16px | Standard: card padding, section gaps, screen horizontal margin |
| `spacing.lg` | 24px | Large: between sections, card groups |
| `spacing.xl` | 32px | Extra large: screen top padding, major section breaks |

### Layout Constants
- Screen horizontal padding: 16px
- Card internal padding: 15-16px
- Card border radius: 12-16px (12 standard, 16 hero)
- Touch target minimum: 44x44px (Apple HIG)
- Bottom tab bar clearance: 40px paddingBottom on scroll containers

---

## 8. Quick Reference for Agents

### Do
- Use `theme.semantic.*` for all data-driven colors
- Use `theme.fonts.mono` for every number on screen
- Use `theme.elevation.*` -- match component importance to elevation level
- Use spring physics for user-initiated animations
- Stagger list entries at 80ms intervals
- Flash data changes green/red for 600ms
- Use BlurView only when there's something interesting to blur

### Do Not
- Hardcode hex color values -- always use theme tokens
- Use the same shadow on every card -- elevation should vary
- Put BlurView over a solid color background (no visual benefit)
- Animate more than 3 properties at once
- Use gradients for text
- Make borders thicker than 1px on cards
- Skip reduced-motion accessibility checks
- Use timing animations for press feedback (use spring instead)
