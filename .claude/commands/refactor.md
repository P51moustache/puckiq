---
description: Refactor code safely using tests as a safety net
argument-hint: [code/file to refactor]
---

Refactor code safely using tests as a safety net.

Code to refactor: $ARGUMENTS

## IMPORTANT: Refactoring Rules

1. **NEVER refactor without tests**
2. **DON'T change behavior, only structure**
3. **Make small, incremental changes**
4. **Run tests after each change**
5. **Keep commits small and focused**

## Phase 1: PROTECT (Write Tests First)

1. **Check if tests exist** for the code to be refactored:
   ```bash
   ls -la [directory]/__tests__/
   ```

2. **If NO tests exist, write them FIRST**:
   - Write comprehensive tests for current behavior
   - Verify all tests pass
   - Achieve at least 80% coverage
   - STOP if tests don't pass - fix tests first!

3. **If tests exist, verify they pass**:
   ```bash
   npm test [test-file]
   ```

4. **Document current behavior**:
   - What does the code do?
   - What are the inputs/outputs?
   - What are the edge cases?

**CHECKPOINT: All tests must be GREEN before proceeding**

## Phase 2: PLAN

1. **Identify refactoring goals**:
   - [ ] Improve readability?
   - [ ] Reduce complexity?
   - [ ] Eliminate duplication?
   - [ ] Improve performance?
   - [ ] Better type safety?
   - [ ] Better error handling?

2. **Create refactoring plan**:
   - List specific changes to make
   - Break into small, safe steps
   - Identify potential risks

3. **Show plan and wait for approval**

**CHECKPOINT: Get approval before refactoring**

## Phase 3: REFACTOR (Small Steps)

For each refactoring step:

1. **Make ONE small change**:
   - Extract function
   - Rename variable
   - Remove duplication
   - Simplify logic
   - Add types

2. **Run tests immediately**:
   ```bash
   npm run test:watch
   ```

3. **If tests FAIL**:
   - STOP
   - Revert the change
   - Understand why it failed
   - Fix the approach
   - Try again

4. **If tests PASS**:
   - Review the change
   - Make sure it's an improvement
   - Commit if significant milestone

5. **Repeat** for next small change

## Phase 4: VERIFY

After all refactoring steps:

1. **Run full test suite**:
   ```bash
   npm test
   ```

2. **Check TypeScript**:
   ```bash
   npx tsc --noEmit
   ```

3. **Run linter**:
   ```bash
   npm run lint
   ```

4. **Test manually** in simulator:
   - Verify behavior unchanged
   - Check for any unexpected side effects
   - Test edge cases

5. **Check performance** (if performance refactoring):
   - Compare before/after metrics
   - Verify improvement

6. **Review all changes**:
   ```bash
   git diff
   ```
   - Code is cleaner?
   - No behavior changes?
   - No new bugs introduced?

## Phase 5: DOCUMENT & COMMIT

1. **Update documentation** if needed:
   - Function comments
   - README if public API changed
   - CLAUDE.md if patterns changed

2. **Create descriptive commit**:
   ```
   Refactor: [What was refactored]

   Changes:
   - [List of structural changes made]

   Benefits:
   - [Why these changes improve the code]

   Testing:
   - All existing tests pass
   - No behavior changes
   - [Any new tests added]
   ```

## Common Refactoring Patterns

### Extract Function
```typescript
// Before
function processData(data) {
  // 50 lines of complex logic
}

// After
function processData(data) {
  const validated = validateData(data);
  const transformed = transformData(validated);
  return formatOutput(transformed);
}
```

### Remove Duplication
```typescript
// Before
if (type === 'A') {
  // 20 lines
} else if (type === 'B') {
  // 20 similar lines
}

// After
const handler = getHandlerForType(type);
handler(data);
```

### Simplify Conditionals
```typescript
// Before
if (user && user.preferences && user.preferences.theme === 'dark') {
  // ...
}

// After
const isDarkMode = user?.preferences?.theme === 'dark';
if (isDarkMode) {
  // ...
}
```

## Red Flags - STOP Refactoring If:

- ❌ Tests start failing
- ❌ You're changing behavior (not just structure)
- ❌ You're doing too much at once
- ❌ You're not sure what the code does
- ❌ You're mixing bug fixes with refactoring
- ❌ You're rewriting instead of refactoring

## Checklist

- ✅ Tests exist and pass (100% green)
- ✅ Refactoring plan approved
- ✅ Small, incremental changes made
- ✅ Tests run after each change
- ✅ Full test suite passes
- ✅ TypeScript passes
- ✅ Linter passes
- ✅ Manual testing done
- ✅ No behavior changes
- ✅ Code is cleaner/simpler
- ✅ Documented and committed

## Remember

> "Refactoring is a disciplined technique for restructuring an existing body of code,
> altering its internal structure without changing its external behavior." - Martin Fowler

If you're changing behavior, it's not refactoring - it's a feature or bug fix.
Keep them separate!
