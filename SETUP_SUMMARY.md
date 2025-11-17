# Claude Code Setup Complete - PuckIQ Project

## What Was Set Up

I've analyzed your PuckIQ React Native/Expo NHL analytics app and created a comprehensive Claude Code setup based on best practices from Anthropic's official guide.

### 📁 Files Created

1. **`CLAUDE.md`** - Main context file (automatically loaded by Claude)
   - Project overview and architecture
   - Critical commands and files
   - Code style guidelines
   - AsyncStorage keys documentation
   - High-risk areas that need extra attention
   - Known issues and technical debt
   - Workflow guidelines
   - **This is your persistent memory between Claude sessions**

2. **`.claude/settings.json`** - Tool permissions
   - Pre-approved common tools (Read, Edit, Git, NPM commands)
   - Eliminates repetitive permission prompts
   - Safe defaults that protect against destructive operations

3. **`.claude/CLAUDE_CODE_SETUP.md`** - Complete best practices guide
   - Solutions to your specific issues (context loss, going off track, incomplete features)
   - Recommended workflows (TDD, bug fixing, feature development)
   - Context management strategies
   - Testing strategy
   - Advanced techniques (parallel Claudes, subagents, extended thinking)
   - Quick reference card

4. **Custom Slash Commands** (in `.claude/commands/`):
   - `/project:test-service` - Test a service file using TDD
   - `/project:add-feature` - Add feature with Explore → Plan → Code workflow
   - `/project:fix-bug` - Fix bugs with test-first approach
   - `/project:setup-tests` - Set up Jest testing infrastructure
   - `/project:refactor` - Safely refactor with test protection

5. **`.gitignore` updates**:
   - Added `CLAUDE.local.md` for personal preferences
   - Added `coverage/` for test reports

### 📊 Project Analysis Summary

**Project Type**: PuckIQ NHL Hockey Analytics App (v2.1.0)
- **Platform**: React Native/Expo (iOS, Android, Web)
- **Architecture**: Service layer pattern, file-based routing, AsyncStorage for persistence
- **Size**: 1,657 lines in main screen, 29 UI components, 8 services
- **Key Features**: Daily smart picks, streak tracking, power rankings, team/player analytics

**Critical Issues Identified**:
- ❌ **Zero test coverage** (most urgent)
- ⚠️ Firebase credentials exposed in code
- ⚠️ No input validation (Zod installed but unused)
- ⚠️ No CI/CD pipeline
- ⚠️ No rate limiting on NHL API calls

**High-Risk Areas** (need tests before changes):
- `services/pickTracking.ts` - Pick calculation algorithm
- `services/streakTracking.ts` - Streak tracking logic
- `services/analytics/AnalyticsService.ts` - Event batching
- `app/(tabs)/index.tsx` - Complex home screen state (1,657 lines)

---

## Solving Your Specific Problems

### Problem 1: Context Getting Compressed/Lost

**Root Cause**: Long conversations fill Claude's context window with irrelevant history.

**Solutions Implemented**:

1. **CLAUDE.md File**: Persistent memory that carries forward between sessions
   - Add important decisions with `#` command
   - No need to repeat project details each session

2. **Use `/clear` Command**:
   ```bash
   # After completing a task
   /clear

   # Between unrelated features
   /clear

   # When switching context (UI → backend)
   /clear
   ```

3. **Workflow Integration**:
   - Custom slash commands break tasks into phases
   - Each phase can be a separate session with /clear between
   - CLAUDE.md preserves essential context

4. **Subagent Usage**:
   ```
   "Use an Explore subagent to find all pick calculation logic"
   ```
   - Keeps search results out of main context
   - Preserves context window for actual work

### Problem 2: Claude Going Off on Its Own

**Root Cause**: Insufficient constraints or missing guidance on preferences.

**Solutions Implemented**:

1. **Enforced "Explore → Plan → Code" Workflow**:
   - All slash commands follow this pattern
   - Explicit checkpoints for approval
   - No coding until plan is approved

2. **CLAUDE.md Guidelines**:
   - Clear code style preferences
   - Existing patterns to follow
   - High-risk areas marked

3. **Checkpoint Prompts Built Into Commands**:
   ```markdown
   **STOP HERE AND WAIT FOR APPROVAL**
   ```

4. **Use `#` Command** to add preferences on the fly:
   ```
   # Always use named exports, never default exports
   ```
   This gets added to CLAUDE.md automatically

### Problem 3: Incomplete Feature Implementation

**Root Cause**: No systematic tracking or verification of subtasks.

**Solutions Implemented**:

1. **Todo List Integration**:
   - Custom commands create todo lists automatically
   - Tasks marked complete only when fully done
   - Definition of Done checklist

2. **Testing Requirements**:
   - TDD workflow enforced in commands
   - Tests must pass before marking complete
   - Coverage verification built in

3. **Verification Steps**:
   Each slash command includes:
   - ✅ Tests written and passing
   - ✅ Works in simulator
   - ✅ No TypeScript errors
   - ✅ No console errors
   - ✅ Edge cases handled
   - ✅ Analytics tracking added

4. **Scratchpad Pattern**:
   For large tasks, create a `PROGRESS.md` checklist:
   ```
   "Create MIGRATION_PROGRESS.md with all 32 teams to update.
   Work through them one by one, checking off each as complete."
   ```

---

## How to Use This Setup

### Starting a New Session

1. **Claude automatically loads CLAUDE.md** - no setup needed
2. **Be specific** in your first prompt:
   ```
   ❌ "Add a new feature"
   ✅ "Add player comparison feature using /project:add-feature workflow"
   ```

### For Adding Features

```bash
# Option 1: Use slash command
/project:add-feature Player comparison between two players

# Option 2: Manual with explicit phases
"First explore how player stats are currently displayed (don't code yet).
Then make a plan for my approval."
```

### For Fixing Bugs

```bash
/project:fix-bug Picks disappear after app restart
```

### For Writing Tests

```bash
/project:test-service services/pickTracking.ts
```

### For Refactoring

```bash
/project:refactor app/(tabs)/index.tsx (break into smaller components)
```

### For Complex Exploration

```
"Use an Explore subagent (very thorough) to understand how analytics
event batching works throughout the codebase."
```

### Course Correction

If I'm going in the wrong direction:
1. Press **ESC** to interrupt me
2. Give corrective guidance
3. Or press **ESC ESC** to go back and edit your prompt

### Adding to CLAUDE.md

When you discover something important:
```
Press # key, then:
"When implementing pick calculations, ALWAYS verify the math
with concrete examples before writing code."
```

---

## Next Steps (Recommended Priority)

### Immediate (This Week)

1. **Set Up Testing** (CRITICAL - you have zero tests):
   ```bash
   /project:setup-tests
   ```
   This will:
   - Install Jest and testing libraries
   - Configure test environment
   - Create test utilities and factories
   - Add test scripts to package.json
   - Create first test as example

2. **Test Critical Services**:
   ```bash
   /project:test-service services/pickTracking.ts
   /project:test-service services/streakTracking.ts
   ```
   These have complex logic and need protection before changes

3. **Fix Security Issues**:
   - Move Firebase credentials to .env (not exposed in repo)
   - Add input validation using Zod

### Week 2-3: Build Test Coverage

Target **70-80% coverage** for services:

```bash
# Test each service
/project:test-service services/analytics/AnalyticsService.ts
/project:test-service services/pickTracking.ts
/project:test-service services/streakTracking.ts
/project:test-service services/notifications.ts

# Check coverage
npm run test:coverage
```

### Week 3-4: Component Tests

Test critical UI components:
- LockOfTheDayCard
- SmartPickCard
- StreakBadge
- PowerRankingsWidget

### Week 4-6: CI/CD & E2E

1. Set up GitHub Actions
2. Add pre-commit hooks
3. Add E2E tests for main flows

---

## Quick Reference

### Essential Commands

| Command | Purpose |
|---------|---------|
| `/clear` | Reset context between tasks |
| `ESC` | Interrupt if going wrong |
| `ESC ESC` | Go back in history, edit prompt |
| `#` | Add to CLAUDE.md |
| `/permissions` | Manage tool allowlist |
| `Shift+Tab` | Toggle auto-accept mode |

### Essential Slash Commands

| Command | Purpose |
|---------|---------|
| `/project:add-feature` | Add feature with proper workflow |
| `/project:fix-bug` | Fix bug with TDD |
| `/project:test-service` | Test a service file |
| `/project:setup-tests` | Set up testing infrastructure |
| `/project:refactor` | Safely refactor with tests |

### Essential Prompts

```
# Prevent premature coding
"First explore [area], make a plan, wait for approval before coding."

# Use subagents
"Use an Explore subagent to understand how [feature] works."

# Enforce verification
"Don't mark complete until tests pass and it works in simulator."

# Request thinking
"Think hard about the best approach before planning."
```

---

## Testing Quick Start

After running `/project:setup-tests`:

```bash
# Run all tests
npm test

# Run in watch mode (best for development)
npm run test:watch

# Run specific test file
npm test services/__tests__/pickTracking.test.ts

# Check coverage
npm run test:coverage

# Run only unit tests
npm run test:unit
```

---

## Understanding Your Project

I've created detailed documentation in `/tmp/`:
- **`project_summary.md`** (650+ lines) - Complete architecture analysis
- **`testing_strategy.md`** (550+ lines) - Comprehensive testing plan

Key insights:
- **1,657 lines** in main home screen - consider breaking down
- **29 UI components** - well organized
- **8 services** - good separation of concerns
- **364 lines** in theme constants - comprehensive theming
- **AsyncStorage keys well documented** - prevents conflicts

Critical paths needing tests:
1. Pick calculation algorithm (multi-factor confidence scoring)
2. Streak tracking logic (daily visits, resets, milestones)
3. Analytics event batching (offline persistence, 30s flush)
4. API response parsing (NHL endpoints)

---

## Questions?

Read these files for detailed guidance:
- **`CLAUDE.md`** - Project context (auto-loaded)
- **`.claude/CLAUDE_CODE_SETUP.md`** - Complete best practices guide
- **Slash command files** - Workflow templates

**Most Important**:
1. Use `/clear` frequently to prevent context bloat
2. Use "Explore → Plan → Code" workflow for anything non-trivial
3. Write tests first (TDD) to ensure complete implementations
4. Press ESC to course correct early
5. Use `#` to add learnings to CLAUDE.md

---

## Examples of Good Prompts

### Starting a New Feature
```
I want to add a feature that compares two teams head-to-head.

Use /project:add-feature workflow:
1. First explore how existing team features work
2. Make a detailed plan
3. Wait for my approval before coding
4. Use TDD (tests first)
5. Verify in simulator before marking complete
```

### Fixing a Bug
```
/project:fix-bug The lock of the day isn't displaying the correct
confidence score. It shows 0 even though the calculation returns 75.
```

### Writing Tests
```
I need comprehensive tests for services/pickTracking.ts before making
any changes. Use /project:test-service to create a full test suite
covering all functions, edge cases, and AsyncStorage interactions.
```

### Exploring Code
```
Use an Explore subagent (very thorough) to find all places where:
1. Streak calculations happen
2. Streak milestones are defined
3. Streak data is displayed in UI

Return a comprehensive map of the streak tracking feature.
```

---

## Success Metrics

You'll know the setup is working when:

- ✅ Claude remembers project context between sessions (via CLAUDE.md)
- ✅ Features are completed fully (tests, edge cases, analytics)
- ✅ Context stays focused (using /clear between tasks)
- ✅ Test coverage increases steadily
- ✅ Fewer permission prompts (via settings.json)
- ✅ Consistent code patterns (following CLAUDE.md guidelines)
- ✅ Bugs have tests that prevent regression

---

**Your project is now set up for effective Claude Code development!**

Start with: `/project:setup-tests` to address the most critical gap (zero test coverage).

Then use the workflows to build features systematically with proper testing, context management, and verification.
