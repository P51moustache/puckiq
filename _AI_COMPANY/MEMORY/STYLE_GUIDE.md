# PuckIQ Style Guide

## Source of Truth
All colors, spacing, and typography are defined in `constants/theme.ts` (364 lines).
This file documents patterns and rules for the UI_Designer and Builder.

## Color Tokens
- Use `theme.colors.*` — never hardcode hex values
- Primary surface: `theme.colors.surface` (dark cards)
- Text hierarchy: `theme.colors.text` (primary) → `theme.colors.textSecondary` (labels)
- Accent/CTA: `theme.colors.primary`

## Spacing Scale
- Use multiples of 4: 4, 8, 12, 16, 20, 24, 32
- Card padding: 16
- Section gap: 24
- Screen horizontal padding: 16

## Typography
- Headlines: 20-24px, bold, `theme.colors.text`
- Body: 14-16px, regular, `theme.colors.text`
- Labels/captions: 12px, `theme.colors.textSecondary`

## Component Patterns
- Cards: `borderRadius: 12`, `backgroundColor: theme.colors.surface`, `padding: 16`
- Buttons: `borderRadius: 8`, min height 44 (Apple HIG touch target)
- Lists: FlatList with `keyExtractor`, separator via `ItemSeparatorComponent`

## Animation Rules (Homer's "Juice")
- Use `Animated` API or `react-native-reanimated`
- Subtle scale on press: 0.97 → 1.0
- Fade in new content (opacity 0→1, 200ms)
- No jarring transitions — ease-in-out only
