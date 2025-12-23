---
description: Audit a feature for completeness and production-readiness (TDD approach)
argument-hint: [feature/component name]
---

Audit a feature for completeness and make it production-ready using TDD.

Feature to audit: $ARGUMENTS

## Phase 1: EXPLORE & MAP

1. **Find all related code**:
   - Use Explore agent to find all files related to this feature
   - Identify: components, services, hooks, types, tests, styles
   - Map the data flow (where data comes from, how it's processed, where it's displayed)

2. **Document the feature scope**:
   - What is this feature supposed to do?
   - What user actions does it support?
   - What data does it display/modify?

3. **Create a feature map**:
   ```
   Feature: [Name]
   ├── Components: [list files]
   ├── Services: [list files]
   ├── Hooks: [list files]
   ├── Types: [list files]
   └── Tests: [list files]
   ```

**STOP HERE: Present feature map and wait for confirmation before proceeding**

## Phase 2: VERIFY FUNCTIONALITY

1. **Test happy path**:
   - Does the main functionality work?
   - Can the user complete the primary action?

2. **Test edge cases**:
   - Empty states (no data)
   - Loading states (slow network)
   - Error states (API failures, invalid data)
   - Boundary conditions (max/min values, long text, etc.)

3. **Check data consistency**:
   - Is data displayed correctly across all screens?
   - Are calculations consistent with other parts of the app?
   - Is data persisted correctly?

4. **Document findings**:
   ```
   ✅ Working:
   - [Feature A works correctly]
   - [Feature B displays data properly]

   ❌ Issues Found:
   - [Issue 1]
   - [Issue 2]
   ```

## Phase 3: GAP ANALYSIS

Rate each category: ✅ Complete | ⚠️ Partial | ❌ Missing

### User Experience
- [ ] Loading states (spinners, skeletons)
- [ ] Empty states (helpful messages when no data)
- [ ] Error states (user-friendly error messages)
- [ ] Success feedback (confirmations, toasts)
- [ ] Offline handling (if applicable)

### Error Handling
- [ ] API errors caught and handled gracefully
- [ ] Invalid data handled (null checks, type guards)
- [ ] Network failures handled with retry options
- [ ] Console errors/warnings resolved

### Data Integrity
- [ ] Data validation before save/submit
- [ ] Consistent data format across screens
- [ ] Proper data refresh on navigation
- [ ] No stale data issues

### Performance
- [ ] No unnecessary re-renders
- [ ] Expensive operations memoized
- [ ] Lists virtualized if long
- [ ] Images optimized

### Accessibility
- [ ] Proper touch targets (44px minimum)
- [ ] Color contrast sufficient
- [ ] Screen reader labels where needed

### Code Quality
- [ ] TypeScript types complete (no `any` in critical paths)
- [ ] No dead code or unused imports
- [ ] Consistent patterns with rest of codebase
- [ ] Proper error logging with prefixes

### Testing (Critical for TDD)
- [ ] Unit tests exist for business logic
- [ ] Component tests exist for UI
- [ ] Edge cases covered in tests
- [ ] Tests actually run and pass
- [ ] Test coverage is adequate (check with `npm run test:coverage`)

**STOP HERE: Present gap analysis and get approval on priorities**

## Phase 4: PLAN IMPROVEMENTS

1. **Prioritize gaps by impact**:
   - P0 (Critical): Bugs, data loss risks, security issues
   - P1 (High): Missing error handling, poor UX on failures
   - P2 (Medium): Missing loading states, accessibility
   - P3 (Low): Performance optimizations, code cleanup

2. **Create actionable tasks**:
   ```
   Priority | Task                              | Complexity
   ---------|-----------------------------------|------------
   P0       | Add error handling for API calls  | Low
   P1       | Add loading states                | Low
   P1       | Handle empty state                | Low
   P2       | Add success feedback              | Low
   ```

3. **Get user approval** on which tasks to implement

**STOP HERE: Get approval on implementation plan**

## Phase 5: IMPLEMENT (TDD Approach)

For each approved task, follow TDD:

### Step 1: Write Failing Test FIRST

Before writing any fix, write a test that exposes the gap:

```typescript
// For missing error handling:
it('should show error message when API fails', async () => {
  // Mock API failure
  jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

  render(<MyComponent />);

  // Assert error state is shown
  expect(await screen.findByText(/error/i)).toBeTruthy();
});

// For missing loading state:
it('should show loading indicator while fetching', async () => {
  render(<MyComponent />);
  expect(screen.getByTestId('loading-spinner')).toBeTruthy();
});

// For missing empty state:
it('should show empty message when no data', async () => {
  jest.spyOn(api, 'getData').mockResolvedValueOnce([]);
  render(<MyComponent />);
  expect(await screen.findByText(/no data/i)).toBeTruthy();
});
```

### Step 2: Verify Test Fails

```bash
npm test -- --testPathPattern="[test-file]"
```

Confirm test fails for the RIGHT reason (missing feature, not test error)

### Step 3: Implement the Fix

- Make minimal changes to make test pass
- Follow existing patterns in codebase
- Don't over-engineer

### Step 4: Verify Test Passes

```bash
npm test -- --testPathPattern="[test-file]"
```

### Step 5: Verify in UI

- Ask user to test the change in simulator/browser
- Confirm it works as expected
- Check for regressions

### Step 6: Run Full Test Suite

```bash
npm test
```

Ensure no regressions

### Step 7: Commit

- One commit per logical improvement
- Include both test and implementation in same commit
- Clear commit message:
  ```
  Add error handling for [feature] API calls

  - Added test for error state
  - Implemented error UI with retry button
  - Verified in simulator
  ```

## Phase 6: FINAL VERIFICATION

1. **Full feature walkthrough**:
   - Test all user flows end-to-end
   - Verify all identified gaps are addressed

2. **Run full test suite**:
   ```bash
   npm test
   ```

3. **Check for regressions**:
   - Related features still work
   - No new console errors

4. **Create audit summary**:
   ```
   # Audit Complete: [Feature Name]

   Issues Found: [X]
   Issues Fixed: [Y]
   Remaining: [Z]

   Changes Made:
   - [Change 1]
   - [Change 2]
   ```

## Definition of Done

- ✅ All related code identified and mapped
- ✅ Current functionality verified
- ✅ Existing test coverage reviewed
- ✅ Gaps identified with production readiness checklist
- ✅ **Tests written BEFORE each fix (TDD)**
- ✅ Priority improvements implemented
- ✅ All tests passing (new and existing)
- ✅ User confirmed fixes work in UI
- ✅ No new console errors
- ✅ Committed with descriptive messages (test + implementation together)

## Common Issues to Look For

### Incomplete Implementations
- Features that only work for happy path
- Missing validation on user inputs
- Hardcoded values that should be dynamic
- TODO comments left in code

### Data Issues
- Different screens showing different values for same data
- Data not refreshing when expected
- Stale data after user actions

### UX Issues
- Actions with no feedback
- Confusing error messages (or none at all)
- Broken loading states

### Code Smells
- Duplicated logic across files
- Inconsistent naming or patterns
- Unused code/imports

## Important Notes

- **TDD is mandatory**: Write failing test → Implement fix → Verify test passes
- ALWAYS verify changes in the UI before marking complete
- DON'T try to fix everything at once - prioritize and iterate
- DON'T implement fixes without tests (even for "simple" changes)
- DO get user approval before major changes
- DO commit incrementally so changes can be reverted
- DO include test + implementation in same commit
- FOCUS on user-facing issues first, then code quality
