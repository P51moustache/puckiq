---
description: Add a new feature using Explore → Plan → Code → Test → Commit workflow
argument-hint: [feature description]
---

Add a new feature using the Explore → Plan → Code → Test → Commit workflow.

Feature to add: $ARGUMENTS

## Phase 1: EXPLORE (Do NOT code yet!)

1. **Read existing similar features** to understand patterns
   - If it's a UI component, check components/ for similar components
   - If it's a service function, check services/ for similar patterns
   - If it's a screen, check app/(tabs)/ for screen patterns

2. **Use a subagent to explore** (if complex):
   - "Use an Explore subagent to find all places where [related feature] is implemented"

3. **Identify files that need modification**:
   - Which services?
   - Which components?
   - Which screens?
   - Any new types needed?

4. **Check for reusable code**:
   - Design system components
   - Existing hooks
   - Utility functions

5. **Identify dependencies**:
   - NHL API endpoints needed
   - AsyncStorage keys required
   - Analytics events to track

## Phase 2: PLAN (Wait for approval!)

Create a detailed plan including:

1. **Architecture decisions**:
   - Where will business logic live?
   - What data structures are needed?
   - How will data flow?

2. **Files to create/modify**:
   - List each file with brief description of changes
   - Identify if new types/interfaces are needed

3. **Testing approach**:
   - Unit tests needed?
   - Component tests needed?
   - Integration tests needed?

4. **Edge cases to handle**:
   - No network connection
   - Invalid API responses
   - Empty states
   - Error states

5. **Analytics tracking**:
   - What events to track?
   - What parameters to include?

**STOP HERE AND WAIT FOR APPROVAL**

## Phase 3: CODE (After approval)

1. **Write tests FIRST** (TDD):
   - Write failing tests for new functionality
   - Verify tests fail for the right reason

2. **Implement the feature**:
   - Follow existing patterns from exploration phase
   - Use TypeScript strict mode
   - Add proper error handling
   - Follow code style from CLAUDE.md

3. **Add analytics tracking**:
   ```typescript
   analytics.trackFeatureUsed('feature_name', { param: 'value' });
   ```

4. **Run tests until they pass**:
   ```bash
   npm run test:watch
   ```

5. **Check TypeScript**:
   ```bash
   npx tsc --noEmit
   ```

## Phase 4: VERIFY

1. **Run in simulator/browser**:
   ```bash
   npm start
   ```
   Then test:
   - Happy path works
   - Edge cases handled
   - Error states display correctly
   - Analytics events fire

2. **Run full test suite**:
   ```bash
   npm test
   ```

3. **Check for console errors/warnings**

4. **Verify accessibility** (if UI component)

## Phase 5: COMMIT

1. **Review all changes**:
   ```bash
   git diff
   ```

2. **Create descriptive commit message** including:
   - What was added
   - Why it was added
   - Any breaking changes or important notes

3. **Push if needed**

## Definition of Done

- ✅ Tests written and passing
- ✅ Feature works in simulator/browser
- ✅ No TypeScript errors
- ✅ No console errors/warnings
- ✅ Edge cases handled
- ✅ Analytics tracking added
- ✅ Follows existing patterns
- ✅ Code reviewed (if applicable)
- ✅ Committed with descriptive message
