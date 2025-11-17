# Claude Code Best Practices for PuckIQ Development

## Table of Contents
1. [Setup & Configuration](#setup--configuration)
2. [Solving Your Specific Issues](#solving-your-specific-issues)
3. [Recommended Workflows](#recommended-workflows)
4. [Context Management](#context-management)
5. [Testing Strategy](#testing-strategy)
6. [Advanced Techniques](#advanced-techniques)

---

## Setup & Configuration

### 1. Tool Allowlist Configuration

To prevent permission prompts and speed up workflow, configure your `.claude/settings.json`:

```json
{
  "allowedTools": [
    "Read",
    "Edit",
    "Glob",
    "Grep",
    "Bash(npm start)",
    "Bash(npm test:*)",
    "Bash(npm run *)",
    "Bash(git add:*)",
    "Bash(git commit:*)",
    "Bash(git log:*)",
    "Bash(git status)",
    "Bash(git diff:*)",
    "Bash(expo start:*)",
    "Bash(ls:*)"
  ]
}
```

**Why**: This eliminates repetitive permission requests for common operations while keeping risky operations (like file deletion) protected.

### 2. Custom Slash Commands

Create these commands in `.claude/commands/` to standardize workflows:

#### `.claude/commands/test-service.md`
```markdown
Test a service file following TDD approach.

1. Read the service file: $ARGUMENTS
2. Write comprehensive unit tests in `services/__tests__/` covering:
   - Happy path scenarios
   - Edge cases
   - Error handling
   - AsyncStorage interactions
3. Use test factories from `factories/` for mock data
4. Run tests and verify they pass
5. Show coverage report

Remember to mock AsyncStorage and external APIs.
```

#### `.claude/commands/add-feature.md`
```markdown
Add a new feature using the Explore → Plan → Code → Test → Commit workflow.

Feature to add: $ARGUMENTS

Steps:
1. **Explore Phase** (DO NOT CODE YET):
   - Read existing similar features to understand patterns
   - Identify files that need to be modified
   - Check for reusable components
   - Use subagents to verify details

2. **Plan Phase**:
   - Create a detailed implementation plan
   - List all files that will be created/modified
   - Identify potential edge cases
   - Present plan for approval (WAIT FOR APPROVAL)

3. **Code Phase**:
   - Write tests first (TDD)
   - Implement feature following existing patterns
   - Add analytics tracking
   - Follow TypeScript strict mode

4. **Test Phase**:
   - Run unit tests
   - Test manually in simulator/browser
   - Verify edge cases

5. **Commit Phase**:
   - Create descriptive commit message
   - Include changelog update if needed
```

#### `.claude/commands/fix-bug.md`
```markdown
Fix a bug using TDD approach.

Bug description: $ARGUMENTS

Steps:
1. Reproduce the bug and understand the issue
2. Write a failing test that demonstrates the bug
3. Fix the bug
4. Verify the test now passes
5. Check for similar bugs in related code
6. Run full test suite
7. Commit with descriptive message
```

### 3. MCP Server Setup (Optional but Recommended)

For enhanced browser testing and screenshot-based iteration:

```json
// .mcp.json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    }
  }
}
```

**Use case**: Take screenshots of your web app during development to verify UI changes visually.

---

## Solving Your Specific Issues

### Issue 1: Context Getting Compressed or Lost

**Root Cause**: Long conversations fill Claude's context window with irrelevant history.

**Solutions**:

1. **Use /clear Aggressively**
   ```
   # After completing a task
   /clear

   # Between unrelated features
   /clear

   # When switching context (e.g., from UI to backend)
   /clear
   ```

2. **Start Fresh for Complex Tasks**
   - Instead of continuing a 100-message thread, start a new session
   - Copy only the essential context from the previous session
   - Use the CLAUDE.md file to preserve important decisions

3. **Use Subagents for Research**
   - When you need me to explore the codebase, explicitly request a subagent
   - This prevents cluttering main context with search results

   ```
   "Use an Explore subagent to find all places where pick confidence
   is calculated. Don't search directly, use a subagent."
   ```

4. **Break Down Large Tasks**
   - Instead of: "Rebuild the entire analytics system"
   - Do: "Step 1: Add event batching. Step 2: Add offline persistence. Step 3: Add error tracking"
   - Use /clear between steps

5. **External Context Documents**
   - For complex features, create a markdown file with requirements
   - Reference it at the start of each session

   ```
   "Read /path/to/feature-spec.md and implement step 3"
   ```

### Issue 2: Claude Going Off on Its Own

**Root Cause**: Insufficient constraints or missing context about your preferences.

**Solutions**:

1. **Always Use "Explore → Plan → Code" Workflow**
   ```
   # ❌ Bad prompt:
   "Add a new team comparison feature"

   # ✅ Good prompt:
   "I want to add a team comparison feature. First, explore how existing
   team features work (don't code yet). Then make a plan for my approval."
   ```

2. **Set Explicit Checkpoints**
   ```
   "Stop after the plan and wait for my approval before coding."

   "After implementing each component, show me the code and wait for
   confirmation before moving to the next one."
   ```

3. **Use the # Command**
   - When I suggest something you don't like, press # and tell me
   - This adds it to CLAUDE.md so I remember for future sessions

   ```
   # Never use default exports for components
   # Always use named exports for better tree-shaking
   ```

4. **Provide Examples**
   ```
   "Look at how LockOfTheDayCard.tsx is structured. Follow the same
   pattern for the new TeamComparisonCard component."
   ```

5. **Use Course Correction Early**
   - Press ESC to interrupt if I'm going in the wrong direction
   - Don't wait until I've written 500 lines of wrong code
   - Double-tap ESC to go back in history and edit your prompt

6. **Specify "Think Hard" for Complex Decisions**
   ```
   "Think hard about the best way to structure this feature before
   planning. Consider performance, maintainability, and existing patterns."
   ```

### Issue 3: Incomplete Feature Implementation

**Root Cause**: No systematic tracking of subtasks or verification.

**Solutions**:

1. **Always Create a Todo List**
   - I will use TodoWrite for any task with 3+ steps
   - You can also explicitly request it:

   ```
   "Create a todo list for this feature with all the subtasks,
   including tests, analytics, and error handling."
   ```

2. **Mark Tasks Complete Only When Fully Done**
   - Tests written AND passing
   - Edge cases handled
   - Analytics added
   - No errors in console

   ```
   "Don't mark the todo as complete until the tests pass and
   you've verified it works in the simulator."
   ```

3. **Use Checklists for Large Features**
   - Create a `FEATURE_CHECKLIST.md` file
   - Have me work through it systematically

   ```
   "Create a checklist in FEATURE_CHECKLIST.md for the team
   comparison feature, then implement each item one by one."
   ```

4. **Verification Steps**
   ```
   "After implementing the feature:
   1. Run the tests
   2. Start the dev server and verify it works
   3. Check for TypeScript errors
   4. Verify analytics events are firing
   5. Test edge cases (no network, invalid data, etc.)
   ONLY THEN mark as complete."
   ```

5. **Definition of Done**
   - Add a "Definition of Done" section to CLAUDE.md
   - I'll check against it before marking tasks complete

---

## Recommended Workflows

### Workflow 1: TDD for New Service Functions

**When to use**: Adding new functions to `services/` directory

**Steps**:
```
1. You: "Add a function to calculate team momentum based on last 10 games.
         Use TDD approach."

2. Me:
   - Reads existing service file
   - Writes failing tests first
   - Shows you the tests for approval
   - Waits for confirmation

3. You: "Looks good, proceed"

4. Me:
   - Implements the function
   - Runs tests until they pass
   - Shows final implementation
   - Marks todo as complete

5. You: "Commit this"

6. Me:
   - Reviews changes
   - Creates descriptive commit
   - Pushes to branch
```

### Workflow 2: UI Component Development with Visual Verification

**When to use**: Building/modifying UI components

**Steps**:
```
1. You: "I want to add a new StatComparisonCard component.
         Here's a screenshot of what it should look like."
         [Drag and drop screenshot]

2. Me:
   - Explores existing card components
   - Plans the component structure
   - Shows plan for approval

3. You: "Approved, proceed"

4. Me:
   - Implements component with tests
   - Tells you to check the simulator

5. You: [Takes screenshot of result] "The spacing is off, make it tighter"

6. Me:
   - Adjusts spacing
   - Tells you to check again

7. You: "Perfect, commit it"

8. Me:
   - Commits with descriptive message
```

### Workflow 3: Bug Fix with Root Cause Analysis

**When to use**: Fixing bugs

**Steps**:
```
1. You: "Picks aren't being saved correctly. The lock of the day
         disappears after restarting the app."

2. Me:
   - Reads pickTracking.ts
   - Reads home screen code
   - Uses git log to see recent changes
   - Identifies the root cause
   - Explains what's wrong (DON'T FIX YET)

3. You: "That makes sense, fix it"

4. Me:
   - Writes failing test that reproduces bug
   - Fixes the bug
   - Runs tests to verify fix
   - Checks for similar issues elsewhere
   - Commits with detailed message
```

### Workflow 4: Feature Addition Using Subagents

**When to use**: Complex features touching multiple files

**Steps**:
```
1. You: "Add player comparison feature. Use subagents to explore first."

2. Me:
   - Launches Explore subagent to understand existing player features
   - Launches another subagent to analyze NHL API player endpoints
   - Synthesizes findings
   - Creates detailed plan

3. You: "Plan looks good but change X to Y"

4. Me:
   - Updates plan
   - Creates todo list with 8 subtasks
   - Marks first todo as in_progress

5. Me: [Works through todos one by one]
   - Writes tests
   - Implements feature
   - Adds analytics
   - Verifies in simulator
   - Marks each complete only when fully done

6. You: "Great, commit and create a PR"

7. Me:
   - Reviews all changes
   - Creates commit
   - Generates PR description with summary
   - Provides PR URL
```

---

## Context Management

### Best Practices for Long Sessions

1. **Session Structure**
   ```
   Session Start
   ├─ Load context from CLAUDE.md (automatic)
   ├─ State your goal clearly
   ├─ Work on Feature A
   ├─ /clear
   ├─ Work on Feature B
   ├─ /clear
   └─ Session End
   ```

2. **Context Preservation Between Sessions**
   - Important decisions → Add to CLAUDE.md with #
   - Work in progress → Create a `WIP.md` file with status
   - Long-term plans → Use GitHub Issues

3. **File Reference Best Practices**
   ```
   # ❌ Vague:
   "Fix the bug in the pick tracking code"

   # ✅ Specific:
   "Fix the bug in services/pickTracking.ts at line 234 where
   confidenceScore is being calculated"
   ```

4. **Use Tab Completion**
   - When mentioning files, use tab completion
   - This ensures I read the exact file you mean

   ```
   "Read app/(tabs)/index.tsx and..." [use TAB to complete path]
   ```

### Parallel Claude Instances (Advanced)

For very large features, consider:

```bash
# Terminal 1: Main feature implementation
cd ~/projects/puckiq
claude

# Terminal 2: Test writing
cd ~/projects/puckiq
claude
# Tell this Claude to only write tests

# Terminal 3: Bug fixes
cd ~/projects/puckiq
claude
# Tell this Claude to only fix bugs
```

**Coordination**: Use a shared `WORK_TRACKING.md` file to avoid conflicts.

---

## Testing Strategy

### Test-First Development (Recommended)

For PuckIQ, given the lack of tests, use this approach:

1. **Before Adding Features**
   ```
   "Before implementing [feature], write comprehensive tests for
   the existing [related functionality] so we have a safety net."
   ```

2. **When Adding Features**
   ```
   "Use TDD: write tests first, then implement the feature to
   make the tests pass."
   ```

3. **Test Coverage Gates**
   ```
   "Don't mark this feature as complete until test coverage
   for services/pickTracking.ts is at least 75%."
   ```

### Testing Workflow Integration

```
# Before each feature
"First, write tests for the related existing code"

# During implementation
"Write the tests first, verify they fail, then implement"

# After implementation
"Run the full test suite and show coverage report"

# Before commit
"Verify all tests pass and coverage hasn't decreased"
```

### Quick Test Commands

```bash
# Run specific test file
npm test services/__tests__/pickTracking.test.ts

# Run tests in watch mode while developing
npm run test:watch

# Check coverage
npm run test:coverage
```

---

## Advanced Techniques

### 1. Scratchpad Pattern for Complex Tasks

For migrations or fixing many similar issues:

```
"Create a MIGRATION_PROGRESS.md file with a checklist of all
32 team components that need updating. Work through them one
by one, checking off each as you complete it."
```

**Benefits**:
- Visual progress tracking
- Easy to resume if interrupted
- Prevents missing items

### 2. Git Worktrees for Parallel Development

```bash
# Create worktrees for independent features
git worktree add ../puckiq-testing feature/testing-setup
git worktree add ../puckiq-analytics feature/analytics-upgrade

# Terminal 1
cd ../puckiq-testing
claude
"Set up the testing infrastructure"

# Terminal 2
cd ../puckiq-analytics
claude
"Upgrade the analytics service"
```

### 3. Multi-Claude Verification

```
# Claude 1: Implementation
"Implement the team comparison feature"

# Claude 2: Code Review (new session)
"Review the code in services/teamComparison.ts and look for:
- Logic errors
- Performance issues
- Missing edge cases
- Security vulnerabilities
- TypeScript issues
Provide detailed feedback."

# Claude 3: Test Writing (new session)
"Read services/teamComparison.ts and write comprehensive tests
trying to break the implementation. Think of edge cases the
original developer might have missed."
```

### 4. Extended Thinking for Complex Decisions

```
# For architectural decisions
"Think harder about whether we should use Context API or
Zustand for this new feature. Consider bundle size,
complexity, and team familiarity."

# For performance optimization
"Ultrathink about the best data structure for storing
10,000+ game records efficiently while maintaining fast
lookups by date, team, and season."
```

### 5. Headless Mode for Automation

```bash
# Fix all lint errors automatically
claude -p "Fix all ESLint errors one by one. Run lint after each
fix to verify." --dangerously-skip-permissions

# Generate test boilerplate
claude -p "Generate test files with boilerplate for all service
files that don't have tests yet" --allowedTools Write,Read,Glob
```

---

## Troubleshooting

### When I Keep Making Mistakes

1. **Update CLAUDE.md**
   ```
   Press # and say:
   "IMPORTANT: When implementing pick calculations, ALWAYS verify
   the math with concrete examples before writing code."
   ```

2. **Use More Specific Instructions**
   ```
   # Instead of:
   "Fix the performance issue"

   # Say:
   "The performance issue is in the home screen render. Profile it
   first with console.time, identify the slow part, then optimize
   ONLY that part. Show me the profiling results before making changes."
   ```

3. **Request Think Time**
   ```
   "Think hard before answering: what could go wrong with this approach?"
   ```

### When Tests Keep Failing

```
"The tests are failing. Debug this by:
1. Reading the exact error message
2. Adding console.logs to understand what's happening
3. Checking if mocks are set up correctly
4. Verifying test data is valid
5. Only then make changes

Work through these steps explicitly, showing your reasoning."
```

### When You're Unsure About My Changes

```
"Before I approve this, explain:
1. What exactly did you change?
2. Why did you make each change?
3. What could break as a result?
4. How did you test it?
5. What edge cases did you consider?"
```

---

## Quick Reference Card

### Essential Commands

| Command | When to Use |
|---------|-------------|
| `/clear` | Between tasks, when context feels bloated |
| `ESC` | Interrupt me if I'm going wrong |
| `ESC ESC` | Go back in history, edit prompt |
| `#` | Add instruction to CLAUDE.md |
| `/permissions` | Manage tool allowlist |
| `Shift+Tab` | Toggle auto-accept mode |

### Essential Prompts

```
# Start a task
"First explore [area], make a plan, wait for my approval before coding."

# Prevent scope creep
"ONLY implement [specific thing]. Don't refactor other code."

# Request verification
"Show me the plan before implementing."
"Run tests before marking complete."
"Verify this works in the simulator before committing."

# Use subagents
"Use an Explore subagent to understand how [feature] works."

# Course correct
"Stop. That's not the right approach. Instead, [correct approach]."

# Request thinking
"Think hard about [decision] before proceeding."
```

### Workflow Templates

**Simple Fix**:
```
1. Identify issue
2. Write failing test
3. Fix
4. Verify test passes
5. Commit
```

**New Feature**:
```
1. Explore existing patterns (use subagent)
2. Make plan and get approval
3. Write tests (TDD)
4. Implement
5. Verify in simulator
6. Commit
```

**Refactor**:
```
1. Write tests for current behavior
2. Verify tests pass
3. Refactor
4. Verify tests still pass
5. Check performance
6. Commit
```

---

## Summary

### Key Takeaways

1. **Use CLAUDE.md aggressively** - It's your persistent memory between sessions
2. **Always use Explore → Plan → Code** workflow for anything non-trivial
3. **Use /clear frequently** to prevent context bloat
4. **Create todo lists** for complex tasks
5. **Write tests first** (TDD) to ensure completeness
6. **Use subagents** for exploration to save main context
7. **Course correct early** - interrupt with ESC if I'm going wrong
8. **Be specific** in prompts - mention exact files and lines
9. **Request verification** before moving forward
10. **Use extended thinking** for complex decisions

### Your Issues - Solved

| Issue | Solution |
|-------|----------|
| Context gets compressed | Use /clear frequently, subagents for exploration |
| Claude goes off track | Explore → Plan → Code workflow, explicit checkpoints |
| Incomplete implementations | Todo lists, verification steps, Definition of Done |
| Inconsistent behavior | Update CLAUDE.md with # command, specific prompts |
| Lost progress | WIP.md files, Git branches, scratchpads |

### Next Steps

1. ✅ Review this setup guide
2. ⬜ Configure `.claude/settings.json` with allowedTools
3. ⬜ Create custom slash commands in `.claude/commands/`
4. ⬜ Set up testing infrastructure (start with pickTracking.ts)
5. ⬜ Practice the "Explore → Plan → Code" workflow on a small feature
6. ⬜ Use # to add any project-specific preferences to CLAUDE.md

---

**Remember**: I'm a tool to augment your development, not replace your judgment. Use course correction liberally, and don't hesitate to stop me if I'm going in the wrong direction.
