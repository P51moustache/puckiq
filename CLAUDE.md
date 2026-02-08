# PuckIQ - Claude Code Context & Guidelines

## Project Overview
**PuckIQ** is a React Native/Expo NHL hockey analytics and smart predictions app (v2.2.0). Cross-platform (iOS, Android, Web) with Firebase analytics integration and Supabase-powered NHL data.

## Critical Commands

### Development
```bash
npm start                  # Start Expo dev server
npm run ios                # Run on iOS simulator
npm run android            # Run on Android emulator
npm run web                # Run on web (port 19006)
npm run lint               # Run ESLint
```

### Testing
```bash
npm test                   # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
npm run test:unit          # Run unit tests only
```

### Build & Deploy
```bash
eas build --platform ios   # Build for iOS (requires EAS)
eas build --platform android # Build for Android
```

## Custom Claude Code Commands

PuckIQ has custom slash commands that follow a consistent TDD methodology. All commands use the pattern: **Verify Tests -> Explore -> Plan -> Test -> Implement -> Verify -> Commit**.

**Important**: All commands that make changes run `npm test` first to ensure the codebase is in a known-good state before proceeding.

### Available Commands

**Development Workflow:**
- `/add-feature [feature description]` - Add new features using systematic TDD workflow
- `/fix-bug [bug description]` - Fix bugs with test-first approach
- `/improve-feature [feature/component name]` - Improve existing features AND suggest new capabilities
- `/refactor [code/file to refactor]` - Safely refactor using tests as safety net

**Testing:**
- `/setup-tests` - Set up comprehensive testing infrastructure
- `/test-service [service filename]` - Test a service file using TDD

**Quality Assurance:**
- `/audit-feature [feature/component name]` - Audit a feature for completeness and production-readiness (TDD)

**Documentation & Understanding:**
- `/explain-feature [feature/component name]` - Get detailed explanation of how something works

### Command Best Practices

**All Commands Follow TDD:**
- Tests are written BEFORE implementation changes
- Each change is verified with tests
- Commits are incremental and descriptive
- No changes to critical paths without tests

**CRITICAL: Always Verify UI Changes:**
- After making ANY changes that affect the UI, you MUST verify they work in the frontend
- Ask the user to test the change in the simulator/browser OR check logs for confirmation
- Don't assume code changes work - state updates, button behaviors, and visual changes need verification

## Core Architecture

### Key Files to Always Check First
- `app/(tabs)/index.tsx` - Main home screen (Upcoming tab, complex state)
- `app/(tabs)/stats.tsx` - Stats tab (lazy-loads teams, more, models sub-screens)
- `services/pickTracking.ts` - Pick calculation & storage
- `services/analytics/AnalyticsService.ts` - Analytics tracking singleton
- `constants/theme.ts` - Dark mode theme
- `lib/firebase.ts` - Firebase initialization

### Directory Structure
```
app/(tabs)/          - 5 tab screens + layout (index, stats, teams, more, models)
components/          - 44 reusable UI components + subdirectories
  model-builder/     - 6 model builder components
  design-system/     - Button, Card
  analytics/         - AnalyticsProvider
  auth/              - AuthProvider
  ui/                - EmptyState, IconSymbol, SkeletonLoader, TabBarBackground
services/            - 15 business logic services
hooks/               - 8 custom React hooks
constants/           - Theme, glossary, model factors, team colors
lib/                 - Firebase + Supabase integration
scripts/sync/        - NHL data sync pipeline (GitHub Actions)
```

## Code Style & Patterns

### TypeScript
- ALWAYS use TypeScript strict mode
- Use interfaces for all data structures
- NO `any` types in critical paths
- Use path aliases: `@/` for root imports

### React Patterns
- Functional components ONLY (no classes)
- Custom hooks for reusable logic
- Context API for global state (NO Redux/Zustand)
- AsyncStorage for all persistence
- useCallback/useMemo for optimization

### Import Style
```typescript
// GOOD: Destructured imports
import { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

// BAD: Default imports when not needed
import React from 'react';
```

### Service Layer Pattern
- Business logic in `services/` directory
- Always use try-catch for async operations
- Log errors with descriptive prefixes: `[PICK SAVING]`, `[NHL Data]`, etc.
- Return meaningful error messages

## Data Architecture (Supabase-Only)

The app reads ALL data from Supabase. The NHL API is NEVER called directly from the app at runtime. NHL data flows into Supabase via the sync pipeline (`scripts/sync/`) running in GitHub Actions on a schedule (daily + weekly).

### Data Flow
```
NHL API -> scripts/sync/ (GitHub Actions) -> Supabase -> App (read-only)
```

### Service Layer Pattern
```typescript
// All services query Supabase directly -- no NHL API fallback
const { data, error } = await supabase
  .from('games')
  .select('*')
  .eq('game_date', today);

if (error || !data) {
  console.warn('[Service] Supabase query failed:', error?.message);
  return []; // Return empty, do NOT fall back to NHL API
}
```

### Key Supabase Tables
- `games` -- Game schedule, scores, states
- `standings` -- Team standings snapshots
- `skater_season_stats` -- Player stats
- `goalie_season_stats` -- Goalie stats
- `team_stat_categories` -- Team advanced stats
- `edge_skater_landing` / `edge_team_landing` -- NHL Edge IQ data
- See `docs/DATABASE_REFERENCE.md` for full schema

## AsyncStorage Keys (CRITICAL)
```
puckiq_daily_picks       - Pick history by date
puckiq_last_check_date   - Yesterday's results check
selectedTeam             - User's favorite team
analytics_user_id        - Analytics user ID
analytics_events         - Local event queue (last 1000)
puckiq_models            - Saved prediction models
puckiq_notification_settings - Notification preferences
puckiq_favorite_teams    - Favorited team list
```

**NEVER modify AsyncStorage keys without checking all usages**

## Testing

### Testing Priority Order
1. **Unit Tests First**: Services (pickTracking, gameResults, derivedStats)
2. **Integration Tests**: Supabase query mocking, AsyncStorage persistence
3. **Component Tests**: Game cards, insight components
4. **E2E Tests**: Main user flows

### Coverage Targets
- Statements: 75%
- Branches: 65%
- Functions: 75%
- Critical paths: 100% (pickTracking)

### Testing Commands
- Run tests before commits
- Fix flaky tests immediately
- Use test factories for mock data
- Mock external APIs (Supabase, Firebase)

## High-Risk Areas (Needs Extra Attention)

### Pick Calculation Algorithm
File: `services/pickTracking.ts`
- Multi-factor confidence scoring
- Win probability calculation
- Historical accuracy tracking
- **MUST have tests before any changes**

### Analytics Event Batching
File: `services/analytics/AnalyticsService.ts`
- Event queueing (10 events per batch)
- 30-second flush interval
- Offline persistence
- **Test thoroughly before modifying**

### Home Screen State
File: `app/(tabs)/index.tsx`
- Complex state management
- Multiple useEffect hooks
- Parallel API calls
- **Break down before major changes**

## Known Issues & Warnings

### Security Issues
- Firebase credentials exposed in code (TODO: move to .env)
- No input validation (Zod installed but unused)
- No rate limiting on Supabase queries (relies on RLS + anon key)

### Technical Debt
- Test coverage still growing
- No CI/CD pipeline yet
- No offline-first strategy
- No error tracking (consider Sentry)

### Development Quirks
- Expo Router uses file-based routing (no manual route config)
- New Architecture enabled (newArchEnabled: true)
- Metro bundler for web output
- Custom fonts must be loaded before render

## Expo MCP Integration

### Session Startup
1. Run `npm start` - automatically enables MCP server + opens iOS simulator
2. Run `/mcp` in Claude Code to reconnect the MCP server

### Navigation in Simulator
**Use deep links instead of tap automation** - they're instant and reliable:
```bash
# Navigate to specific routes
xcrun simctl openurl booted "exp+learning-project://"           # Home/Today
xcrun simctl openurl booted "exp+learning-project://models"     # Models tab
xcrun simctl openurl booted "exp+learning-project://stats"      # Stats tab
xcrun simctl openurl booted "exp+learning-project://teams"      # Teams tab
```

### Simulator Automation (`./scripts/sim-control.sh`)

Full programmatic control of the iOS simulator -- no manual interaction needed.
Requires: `idb-companion` (brew), `fb-idb` (pip, Python 3.13), `ios-simulator-skill` (`~/.claude/skills/`).

```bash
# Full page audit -- 3 screenshots (top/mid/bottom)
./scripts/sim-control.sh scroll-screenshot /tmp/audit

# Individual operations
./scripts/sim-control.sh screenshot /tmp/screen.png       # Single screenshot
./scripts/sim-control.sh scroll-down                       # Scroll content down
./scripts/sim-control.sh scroll-up                         # Scroll back up
./scripts/sim-control.sh navigate models                   # Deep link to route
./scripts/sim-control.sh screen_mapper                     # List UI elements on screen
./scripts/sim-control.sh navigator --find-text "Login" --tap  # Tap element by text
./scripts/sim-control.sh tap 200 400                       # Tap at coordinates
```

**Post-implementation verification workflow:**
1. `./scripts/sim-control.sh navigate [route]` -- go to the screen
2. `sleep 2` -- wait for data to load
3. `./scripts/sim-control.sh scroll-screenshot /tmp/verify_[feature]` -- capture full page
4. Read all PNGs with Read tool -- compare against spec

### Available Routes
```
/                 - Home/Today (default)
/stats            - Stats tab
/teams            - Teams sub-screen
/more             - More sub-screen
/models           - Models tab
```

## Workflow Guidelines

### Before Making Changes
1. **ALWAYS read the relevant files first** - don't jump straight to coding
2. **Make a plan** and get user approval before implementation
3. **Check AsyncStorage keys** to ensure no conflicts
4. **Verify Supabase table schema** matches expected data shape

### When Adding Features
1. Explore existing patterns first (e.g., how other components handle similar logic)
2. Use existing design system components (`design-system/` folder)
3. Follow service layer pattern for business logic
4. Add analytics tracking for user interactions
5. **Write tests FIRST** (TDD approach preferred)

### When Fixing Bugs
1. Write a failing test that reproduces the bug
2. Fix the bug
3. Verify the test passes
4. Check for similar issues elsewhere

### Code Review Checklist
- [ ] TypeScript types are correct
- [ ] Tests are written and passing
- [ ] No console.log (use proper logging prefixes)
- [ ] Error handling is in place
- [ ] AsyncStorage operations are safe
- [ ] Analytics events are tracked
- [ ] UI follows theme constants

## Git Workflow

### Commit Messages
- Use descriptive messages
- Include context about "why" not just "what"
- Reference issue numbers if applicable
- Use conventional commits format when possible

### Branch Strategy
- Main branch: `main`
- Create feature branches for new work
- PR and review before merging

## Firebase Analytics

### Event Tracking
- Screen views: Auto-tracked via AnalyticsProvider
- User actions: Track button presses, selections
- Performance: Track slow operations
- Errors: Track all caught errors

### Custom Events
```typescript
import { useAnalytics } from '@/hooks/useAnalytics';

const analytics = useAnalytics();
analytics.trackFeatureUsed('feature_name', { param: 'value' });
```

## Performance Considerations

- Use `useCallback` for event handlers in lists
- Use `useMemo` for expensive calculations
- Optimize FlatList with `keyExtractor` and `getItemLayout`
- Avoid re-renders with React.memo where appropriate
- Monitor bundle size for web builds

## Important Context for Claude

### When Context Gets Lost
- **Use /clear between unrelated tasks** to reset context
- **Mention specific file paths** to ensure I check the right files
- **Break large tasks into smaller chunks** with explicit checkpoints

### Preferred Workflow (Explore -> Plan -> Code -> Test -> Commit)
1. **Explore**: Read relevant files, understand existing patterns
2. **Plan**: Make a detailed plan and get approval
3. **Code**: Implement with tests
4. **Test**: Run tests and verify behavior
5. **Commit**: Create descriptive commit message

## Resources

- Expo Docs: https://docs.expo.dev/
- React Native Docs: https://reactnative.dev/
- NHL API Docs (sync pipeline only): https://gitlab.com/dword4/nhlapi
- Supabase Docs: https://supabase.com/docs
- Firebase Docs: https://firebase.google.com/docs

---

**Last Updated**: 2026-02-07 (Major cleanup: removed dead code, deprecated annotations, unused packages)
**Version**: 2.3.0
**Maintained by**: Development Team
