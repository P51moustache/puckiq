# PuckIQ - Claude Code Context & Guidelines

## Project Overview
**PuckIQ** is a React Native/Expo NHL hockey analytics and smart predictions app (v2.1.0). Cross-platform (iOS, Android, Web) with Firebase analytics integration and live NHL data feeds.

## Critical Commands

### Development
```bash
npm start                  # Start Expo dev server
npm run ios                # Run on iOS simulator
npm run android            # Run on Android emulator
npm run web                # Run on web (port 19006)
npm run lint               # Run ESLint
```

### Testing (NEW - in progress)
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

PuckIQ has custom slash commands that follow a consistent TDD methodology. All commands use the pattern: **Explore → Plan → Test → Implement → Verify → Commit**.

### Available Commands

**Development Workflow:**
- `/add-feature [feature description]` - Add new features using systematic TDD workflow
  - Explores codebase → Creates plan → Writes tests → Implements → Verifies → Commits

**Code Quality & Maintenance:**
- `/fix-bug [bug description]` - Fix bugs with test-first approach
  - Reproduces with test → Fixes → Verifies → Commits incrementally

- `/improve-feature [feature/component name]` - Improve existing features AND suggest new capabilities
  - Analyzes → Suggests improvements & new features → Prioritizes → Tests → Implements one at a time → Verifies
  - Delegates substantial new features to `/add-feature` command

- `/refactor [code/file to refactor]` - Safely refactor using tests as safety net
  - Tests current behavior → Refactors → Ensures tests still pass

**Testing:**
- `/setup-tests` - Set up comprehensive testing infrastructure
  - Installs dependencies → Configures Jest → Creates test utilities → Writes initial tests

- `/test-service [service filename]` - Test a service file using TDD
  - Reads service → Writes comprehensive tests → Runs tests → Reports coverage

**Quality Assurance:**
- `/audit-feature [feature/component name]` - Audit a feature for completeness and production-readiness (TDD)
  - Explores all related code → Verifies functionality → Reviews test coverage → Identifies gaps
  - Creates prioritized improvement plan → Writes tests FIRST → Implements fixes → Verifies
  - Catches incomplete AI implementations (missing error handling, edge cases, loading states, tests)

**Documentation & Understanding:**
- `/explain-feature [feature/component name]` - Get detailed explanation of how something works
  - Analyzes structure → Maps data flow → Identifies issues → Suggests improvements
  - Creates visual diagrams and plain-language explanations

### Command Best Practices

**When to Use Which Command:**
- 🆕 Adding new functionality → `/add-feature`
- 🐛 Something is broken → `/fix-bug`
- 🔧 Code works but needs improvement OR want suggestions for new features → `/improve-feature`
- ♻️ Restructuring without changing behavior → `/refactor`
- 🧪 Need to test existing code → `/test-service`
- 🔍 Feature exists but may be incomplete or missing production-readiness → `/audit-feature`
- 📚 Don't understand how something works → `/explain-feature`
- 🏗️ Setting up testing for first time → `/setup-tests`

**All Commands Follow TDD:**
- Tests are written BEFORE implementation changes
- Each change is verified with tests
- Commits are incremental and descriptive
- No changes to critical paths without tests

**CRITICAL: Always Verify UI Changes:**
- After making ANY changes that affect the UI, you MUST verify they work in the frontend
- Ask the user to test the change in the simulator/browser OR check logs for confirmation
- Don't assume code changes work - state updates, button behaviors, and visual changes need verification
- If the user reports something isn't working, investigate thoroughly before claiming it's fixed
- Common issues to check: state not updating, props not passed, missing re-renders, async timing

### Example Usage

```bash
# Explain how a complex component works
/explain-feature MyPicks Screen

# Fix a bug with TDD approach
/fix-bug Predictions showing wrong teams in modal

# Add a new feature systematically
/add-feature User profile settings page

# Improve existing feature with tests and get new feature suggestions
/improve-feature Power Rankings Card
# → Claude will suggest improvements AND new features to add
# → If you approve a new feature, Claude runs /add-feature for it

# Safely refactor with test coverage
/refactor services/pickTracking.ts

# Test an existing service
/test-service analytics/AnalyticsService

# Audit a feature for production-readiness
/audit-feature Picks Screen
# → Claude explores all related code
# → Verifies functionality, identifies missing error handling, loading states
# → Creates prioritized plan and implements fixes incrementally
```

## Core Architecture

### Key Files to Always Check First
- `app/(tabs)/index.tsx` - Main home screen (1657 lines, complex state)
- `services/pickTracking.ts` - CRITICAL: Pick calculation & storage (364 lines)
- `services/streakTracking.ts` - CRITICAL: Streak logic (149 lines)
- `services/analytics/AnalyticsService.ts` - Analytics tracking singleton
- `constants/theme.ts` - Dark mode theme (364 lines)
- `lib/firebase.ts` - Firebase initialization

### Directory Structure
```
app/(tabs)/          - 5 tab screens (file-based routing)
components/          - 29 reusable UI components
services/            - Business logic layer (8 services)
hooks/               - 4 custom React hooks
constants/           - Theme, achievements, metrics
lib/                 - Firebase integration
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
// ✅ GOOD: Destructured imports
import { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

// ❌ BAD: Default imports when not needed
import React from 'react';
```

### Service Layer Pattern
- Business logic in `services/` directory
- Always use try-catch for async operations
- Log errors with descriptive prefixes: `[PICK SAVING]`, `[NHL Data]`, etc.
- Return meaningful error messages

## NHL API Integration

### Important Endpoints
```
Teams:      GET https://api.nhle.com/stats/rest/en/team
Games:      GET https://api-web.nhle.com/v1/score/{YYYY-MM-DD}
Standings:  GET https://api-web.nhle.com/v1/standings/now
Leaders:    GET https://api-web.nhle.com/v1/skater-stats-leaders/current
Schedule:   GET https://api-web.nhle.com/v1/club-schedule/{TEAM_CODE}/month/{YYYY-MM}
```

### API Best Practices
- Use `Promise.allSettled()` for parallel requests
- Provide fallbacks for failed endpoints
- NO aggressive caching - fresh data on each request
- Handle network errors gracefully

## AsyncStorage Keys (CRITICAL)
```
puckiq_daily_picks       - Pick history by date
puckiq_streak_data       - Streak tracking data
puckiq_last_visit        - Last visit date for streak
puckiq_last_check_date   - Yesterday's results check
selectedTeam             - User's favorite team
analytics_user_id        - Analytics user ID
analytics_events         - Local event queue (last 1000)
```

⚠️ **NEVER modify AsyncStorage keys without checking all usages**

## Testing Requirements (NEW)

### Testing Priority Order
1. **Unit Tests First**: Services (pickTracking, streakTracking, AnalyticsService)
2. **Integration Tests**: NHL API mocking, AsyncStorage persistence
3. **Component Tests**: LockOfTheDayCard, SmartPickCard, StreakBadge
4. **E2E Tests**: Main user flows

### Coverage Targets
- Statements: 75%
- Branches: 65%
- Functions: 75%
- Critical paths: 100% (pickTracking, streakTracking)

### Testing Commands
- Run tests before commits
- Fix flaky tests immediately
- Use test factories for mock data
- Mock external APIs (NHL, Firebase)

## High-Risk Areas (Needs Extra Attention)

### 🔴 Critical: Pick Calculation Algorithm
File: `services/pickTracking.ts`
- Multi-factor confidence scoring
- Win probability calculation
- Historical accuracy tracking
- **MUST have tests before any changes**

### 🔴 Critical: Streak Tracking Logic
File: `services/streakTracking.ts`
- Daily visit detection
- Streak reset logic (1+ day gap)
- Milestone calculations (7, 14, 30, 50, 100, 365 days)
- **MUST have tests before any changes**

### 🟡 Medium Risk: Analytics Event Batching
File: `services/analytics/AnalyticsService.ts`
- Event queueing (10 events per batch)
- 30-second flush interval
- Offline persistence
- **Test thoroughly before modifying**

### 🟡 Medium Risk: Home Screen State
File: `app/(tabs)/index.tsx`
- 1657 lines of complex state management
- Multiple useEffect hooks
- Parallel API calls
- **Break down before major changes**

## Known Issues & Warnings

### Security Issues
- ⚠️ Firebase credentials exposed in code (TODO: move to .env)
- ⚠️ No input validation (Zod installed but unused)
- ⚠️ No rate limiting on NHL API calls

### Technical Debt
- Zero test coverage (being addressed)
- No CI/CD pipeline yet
- No offline-first strategy
- No error tracking (consider Sentry)

### Development Quirks
- Expo Router uses file-based routing (no manual route config)
- New Architecture enabled (newArchEnabled: true)
- Metro bundler for web output
- Custom fonts must be loaded before render

## Workflow Guidelines

### Before Making Changes
1. **ALWAYS read the relevant files first** - don't jump straight to coding
2. **Make a plan** and get user approval before implementation
3. **Check AsyncStorage keys** to ensure no conflicts
4. **Verify NHL API endpoints** are still correct

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
- **Use # to add important commands to this CLAUDE.md** as you discover them
- **Break large tasks into smaller chunks** with explicit checkpoints

### To Prevent Going Off Track
- **Explicitly state: "Don't write code yet, just plan"** when exploring
- **Ask me to verify my plan** before implementation
- **Use the Explore subagent** for complex codebase questions
- **Set clear acceptance criteria** before starting

### To Ensure Complete Implementation
- **Create a todo list** at the start of complex tasks
- **Mark todos as complete** only when fully done
- **Test each piece** before moving to the next
- **Review the full diff** before committing

### Preferred Workflow (Explore → Plan → Code → Test → Commit)
1. **Explore**: Read relevant files, understand existing patterns
2. **Plan**: Make a detailed plan and get approval
3. **Code**: Implement with tests
4. **Test**: Run tests and verify behavior
5. **Commit**: Create descriptive commit message

## Resources

- Expo Docs: https://docs.expo.dev/
- React Native Docs: https://reactnative.dev/
- NHL API Docs: https://gitlab.com/dword4/nhlapi
- Firebase Docs: https://firebase.google.com/docs

## Questions to Ask Before Starting

1. Should I write tests first (TDD) or implement first?
2. Are there existing patterns I should follow?
3. What's the expected behavior for edge cases?
4. Should analytics tracking be added for this feature?
5. Does this need to work offline?

---

**Last Updated**: 2025-11-16 (Added custom command documentation)
**Version**: 2.1.0
**Maintained by**: Development Team
