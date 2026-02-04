# PUCK-IQ File Map

## App Screens (`app/(tabs)/`)
- `index.tsx` - Home/Today screen (main hub)
- `explore.tsx` - Explore tab
- `models.tsx` - Models tab
- `profile.tsx` - Profile/My IQ tab

## Components (`components/`)
- 29 reusable UI components
- `model-builder/` - Model builder subsystem

## Services (`services/`)
- `pickTracking.ts` - Pick calculation & storage (CRITICAL)
- `streakTracking.ts` - Streak logic (CRITICAL)
- `modelPrediction.ts` - Model prediction engine
- `modelStorage.ts` - Model persistence
- `backtesting.ts` - Backtesting engine
- `historicalGames.ts` - Historical game data
- `analytics/AnalyticsService.ts` - Analytics singleton

## Hooks (`hooks/`)
- 4 custom React hooks

## Constants (`constants/`)
- `theme.ts` - Dark mode theme (364 lines)
- `modelFactors.ts` - Model factor definitions

## Config
- `lib/firebase.ts` - Firebase init
- `lib/supabase.ts` - Supabase client

<!-- Archivist and Builder update this as files change -->
