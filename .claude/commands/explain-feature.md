---
description: Explain how a feature or component works, including data flow, potential issues, and improvement opportunities
argument-hint: [feature/component name]
---

Explain how a feature or component works, including data flow, potential issues, and improvement opportunities.

Target: $ARGUMENTS

## Step 1: LOCATE & READ

1. **Find the component/feature files**:
   - Use Glob/Grep to locate relevant files
   - Identify main component file
   - Find related hooks, services, utilities
   - Locate any tests that exist

2. **Read all related code**:
   - Main component implementation
   - Custom hooks used
   - Services/utilities called
   - Type definitions
   - Existing tests (if any)

## Step 2: ANALYZE STRUCTURE

Create a clear breakdown:

### Component Overview
- **Purpose**: What does this component do?
- **Location**: File path(s)
- **Type**: Screen, UI component, service, hook, utility
- **Lines of Code**: How large is it?
- **Complexity**: Simple, moderate, or complex

### Architecture Pattern
- Component structure (functional, class, custom hook, etc.)
- State management approach (useState, useContext, external service)
- Side effects (useEffect, async operations)
- Memoization (useMemo, useCallback, React.memo)

## Step 3: MAP DATA FLOW

Document where data comes from and where it goes:

### Data Sources
```
Input Data:
├─ Props: [list props and their types]
├─ Context: [any context consumed]
├─ AsyncStorage: [keys read/written]
├─ API Calls: [endpoints called]
├─ Services: [service methods used]
└─ Hooks: [custom hooks used]
```

### Data Transformations
- How is raw data processed?
- What calculations/derivations happen?
- What formatting is applied?
- What validations occur?

### Data Outputs
```
Output Data:
├─ UI Rendered: [what gets displayed]
├─ State Updates: [what state changes]
├─ Storage: [what gets persisted]
├─ API Calls: [what gets sent to backend]
├─ Analytics: [what events are tracked]
└─ Child Components: [what props are passed down]
```

## Step 4: IDENTIFY DEPENDENCIES

List all dependencies:

### Internal Dependencies
- Custom hooks from `/hooks`
- Services from `/services`
- Components from `/components`
- Utils from `/utils`
- Constants from `/constants`

### External Dependencies
- React Native components
- Third-party libraries
- Expo modules
- Firebase services

### Dependency Graph
Show the dependency chain:
```
ComponentA
├─ useCustomHook
│  └─ SomeService
│     └─ AsyncStorage
├─ API Service
│  └─ fetch()
└─ ChildComponentB
   └─ GrandchildComponentC
```

## Step 5: ANALYZE CODE QUALITY

### ✅ What's Done Well
Look for:
- Clear, descriptive naming
- Proper TypeScript types
- Good error handling
- Proper memoization
- Clean separation of concerns
- Reusable logic extracted to hooks
- Accessibility features
- Loading and error states
- Analytics tracking

### ⚠️ Potential Issues

**Performance Concerns:**
- [ ] Unnecessary re-renders
- [ ] Missing memoization (useMemo/useCallback)
- [ ] Expensive calculations in render
- [ ] Large components not code-split
- [ ] Unoptimized lists/FlatLists

**Code Quality Issues:**
- [ ] TypeScript `any` types
- [ ] Magic numbers/strings (should be constants)
- [ ] Duplicated logic
- [ ] Large functions (>50 lines)
- [ ] Deep nesting (>3 levels)
- [ ] Missing error handling
- [ ] Console.log statements left in

**State Management Issues:**
- [ ] Stale closures in useEffect
- [ ] Missing dependency arrays
- [ ] Unnecessary state
- [ ] Props drilling (should use context)
- [ ] Race conditions in async operations

**Data Issues:**
- [ ] No data validation
- [ ] Missing null/undefined checks
- [ ] Inconsistent data fetching
- [ ] No loading states
- [ ] No error states
- [ ] Stale data not refreshed

**Testing Issues:**
- [ ] No tests exist
- [ ] Critical paths untested
- [ ] Missing edge case tests
- [ ] No error scenario tests

**Security/Privacy Issues:**
- [ ] Sensitive data in logs
- [ ] API keys exposed
- [ ] User data not sanitized
- [ ] No input validation

**Accessibility Issues:**
- [ ] Missing accessibility labels
- [ ] Poor color contrast
- [ ] No keyboard navigation
- [ ] Touch targets too small

## Step 6: CREATE VISUAL EXPLANATION

Generate a simple diagram showing:

### Component Lifecycle
```
Mount
  ↓
Initialize State
  ↓
Fetch Data (useEffect)
  ↓
Process/Transform
  ↓
Render UI
  ↓
User Interaction
  ↓
Update State
  ↓
Re-render
  ↓
Unmount (cleanup)
```

### User Interaction Flow
```
User Action → Event Handler → State Update → Side Effect → UI Update
```

## Step 7: GENERATE EXPLANATION

Write a clear, simple explanation in this format:

---

# [Component/Feature Name] Explanation

## What It Does
[2-3 sentence summary of the component's purpose from user perspective]

## How It Works

### 1. Initialization
[What happens when component first loads]

### 2. Data Fetching
[Where data comes from and how it's fetched]

### 3. Data Processing
[How raw data is transformed for display]

### 4. User Interactions
[What users can do and what happens when they do it]

### 5. State Management
[How state is managed and updated]

## Data Flow Summary

**Input Sources:**
- [Source 1]: [Description]
- [Source 2]: [Description]

**Processing:**
- [Step 1]
- [Step 2]

**Output/Display:**
- [What user sees]
- [What gets persisted]

## Code Organization

**Main Files:**
- `path/to/file.tsx` ([XXX] lines) - [Purpose]
- `path/to/hook.ts` ([XXX] lines) - [Purpose]
- `path/to/service.ts` ([XXX] lines) - [Purpose]

**Key Functions/Hooks:**
- `functionName()` - [What it does]
- `useCustomHook()` - [What it does]

## Dependencies

**Critical Dependencies:**
1. [Dependency 1] - [Why needed]
2. [Dependency 2] - [Why needed]

**External APIs:**
- [API endpoint] - [What data it provides]

## Current State Assessment

### ✅ Strengths
- [Positive aspect 1]
- [Positive aspect 2]
- [Positive aspect 3]

### ⚠️ Issues Found
**High Priority:**
- [Critical issue 1]
- [Critical issue 2]

**Medium Priority:**
- [Code quality issue 1]
- [Performance issue 1]

**Low Priority:**
- [Nice to have improvement 1]

### 🔧 Recommended Improvements
1. **[Issue Category]**: [Specific recommendation]
   - Impact: [High/Medium/Low]
   - Effort: [High/Medium/Low]
   - Why: [Explanation]

2. **[Issue Category]**: [Specific recommendation]
   - Impact: [High/Medium/Low]
   - Effort: [High/Medium/Low]
   - Why: [Explanation]

## Testing Status

**Current Coverage:**
- Unit tests: [Yes/No] ([X]% coverage if known)
- Integration tests: [Yes/No]
- E2E tests: [Yes/No]

**Missing Test Coverage:**
- [ ] [Critical path 1]
- [ ] [Edge case 1]
- [ ] [Error scenario 1]

## Next Steps

If you want to improve this component:

**Quick Wins** (Low effort, high impact):
1. [Improvement 1]
2. [Improvement 2]

**Medium Term** (Moderate effort):
1. [Improvement 1]
2. [Improvement 2]

**Long Term** (High effort, high impact):
1. [Improvement 1]
2. [Improvement 2]

---

## Step 8: OFFER ACTION ITEMS

After providing the explanation, ask the user:

```
Would you like me to:
1. Fix any of the identified issues?
2. Write tests for this component?
3. Improve specific aspects?
4. Create documentation?
5. Refactor for better performance/readability?
```

## Output Guidelines

### Tone
- Use simple, clear language (avoid jargon)
- Explain technical concepts in plain terms
- Use analogies when helpful
- Be honest about issues but constructive

### Structure
- Use headings and bullet points
- Include code snippets for key concepts
- Use diagrams/ASCII art for flows
- Keep paragraphs short (2-4 sentences)

### Focus
- Prioritize "why" over "what"
- Explain the reasoning behind design decisions
- Highlight the user impact of issues
- Provide actionable recommendations

## Examples

### Example 1: Simple Component
```
# SmartPickCard Explanation

## What It Does
Displays an AI-powered game prediction with team logos, scores, and confidence level.

## How It Works
1. Receives game data and prediction via props
2. Calculates confidence level from standings data
3. Renders team info with conditional styling
4. Shows prediction only for upcoming games

[... rest of explanation ...]
```

### Example 2: Complex Service
```
# PickTracking Service Explanation

## What It Does
Manages user predictions, calculates accuracy, tracks history, and persists picks to AsyncStorage.

## How It Works
1. Stores picks in memory and AsyncStorage
2. Fetches live game results from NHL API
3. Compares user picks to actual results
4. Updates streak and accuracy stats
5. Triggers notifications for results

[... rest of explanation ...]
```

## Checklist

- [ ] Located all relevant files
- [ ] Read and understood the code
- [ ] Mapped complete data flow
- [ ] Identified all dependencies
- [ ] Analyzed code quality
- [ ] Found potential issues
- [ ] Assessed current test coverage
- [ ] Created visual diagrams
- [ ] Written clear explanation
- [ ] Prioritized improvements
- [ ] Offered actionable next steps

## Tips

**For Large Components (>500 lines):**
- Break explanation into logical sections
- Focus on high-level architecture first
- Drill into complex parts separately
- Suggest refactoring as improvement

**For Services/Utilities:**
- Show example usage
- Explain algorithm/logic clearly
- Document side effects
- Show error handling paths

**For Hooks:**
- Explain what problem it solves
- Show data flow in/out
- Document dependencies
- Show example usage

**For Screens:**
- Map user journey
- Show all interaction points
- Document API calls
- Explain navigation flow

## Anti-Patterns to Avoid

❌ **Don't**:
- Assume the user knows technical terms
- Write long paragraphs without structure
- List issues without context
- Skip the "why" behind recommendations
- Make assumptions without reading code
- Provide vague suggestions
- Ignore test coverage

✅ **Do**:
- Explain concepts clearly
- Use visual aids
- Prioritize issues by impact
- Provide specific, actionable advice
- Read all relevant code first
- Consider the user's perspective
- Mention what's done well

---

**Remember**: The goal is to make complex code understandable to someone who didn't write it, while identifying real improvement opportunities.
