---
description: Fix a bug using TDD approach
argument-hint: [bug description]
---

Fix a bug using TDD approach.

Bug description: $ARGUMENTS

## Step 1: REPRODUCE & UNDERSTAND

1. **Reproduce the bug**:
   - Try to trigger it manually
   - Note exact steps to reproduce
   - Capture error messages/logs

2. **Understand the issue**:
   - Read the relevant code files
   - Use git log to see recent changes:
     ```bash
     git log --oneline -20
     git log -p [filename]
     ```
   - Check if it's a regression from recent commit

3. **Identify root cause**:
   - Trace through the code path
   - Check for related issues in similar code
   - Explain what's wrong (DON'T FIX YET)

**STOP: Explain root cause and wait for confirmation**

## Step 2: WRITE FAILING TEST

1. **Create/update test file** that reproduces the bug:
   ```typescript
   it('should [expected behavior] when [condition]', () => {
     // Setup that triggers the bug
     // Assert expected behavior (test will fail)
   });
   ```

2. **Run test and verify it fails**:
   ```bash
   npm test [test-file]
   ```

3. **Confirm failure is due to the bug** (not test error)

## Step 3: FIX THE BUG

1. **Make minimal changes** to fix the issue:
   - Don't refactor unrelated code
   - Don't "improve" other things
   - Focus on the specific bug

2. **Handle edge cases** revealed by the bug

3. **Add error handling** if missing

## Step 4: VERIFY FIX

1. **Run the failing test**:
   ```bash
   npm test [test-file]
   ```
   Verify it now passes

2. **Run full test suite**:
   ```bash
   npm test
   ```
   Make sure nothing broke

3. **Test manually** in simulator/browser:
   - Reproduce original bug scenario
   - Verify it's fixed
   - Test related functionality

4. **Check for similar bugs** in related code

## Step 5: COMMIT

1. **Review changes**:
   ```bash
   git diff
   ```

2. **Create detailed commit message**:
   ```
   Fix: [Brief description of bug]

   Problem: [What was wrong]
   Root cause: [Why it was happening]
   Solution: [How it was fixed]
   Testing: [How it was verified]

   Fixes #[issue-number] (if applicable)
   ```

3. **Commit the fix**

## Checklist

- ✅ Bug reproduced and understood
- ✅ Root cause identified
- ✅ Failing test written
- ✅ Bug fixed with minimal changes
- ✅ Test now passes
- ✅ Full test suite passes
- ✅ Manually verified in simulator
- ✅ Similar issues checked
- ✅ Descriptive commit message
- ✅ No new console errors

## Important Notes

- DON'T refactor while fixing bugs (separate commits)
- DON'T fix multiple bugs in one commit
- DO check git history for context
- DO write tests even for "obvious" fixes
- DO verify fix doesn't break anything else
