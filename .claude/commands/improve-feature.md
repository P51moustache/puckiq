---
description: Improve a feature or component using systematic analysis and testing, with suggestions for new capabilities to add
argument-hint: [feature/component name]
---

Improve a feature or component using systematic analysis and testing. Includes both improvements to existing functionality AND suggestions for valuable new features to add.

**Note**: If you choose to implement a suggested new feature, Claude will run the `/add-feature` command to implement it using the full TDD workflow.

Target: $ARGUMENTS

## Step 1: ANALYZE & UNDERSTAND

1. **Read the current implementation**:
   - Locate all relevant files (component, hooks, services, styles)
   - Understand the current architecture and patterns
   - Map dependencies and data flow

2. **Identify improvement opportunities**:
   - Performance bottlenecks (unnecessary re-renders, expensive calculations)
   - Code quality issues (duplication, complexity, readability)
   - Missing features or edge cases
   - Accessibility improvements
   - User experience enhancements
   - Testing coverage gaps
   - TypeScript type safety
   - Error handling gaps

3. **Identify potential new features to add**:
   - **Enhanced Data Display**:
     - Additional statistics or metrics that would be valuable
     - Historical trends or comparisons
     - Visual representations (charts, graphs, sparklines)
     - Data filtering and sorting options
     - Search functionality

   - **User Interaction Features**:
     - Favoriting/bookmarking capabilities
     - Sharing functionality (social media, copy link)
     - Customization options (themes, layouts, preferences)
     - Interactive elements (expand/collapse, tooltips, modals)
     - Gesture controls (swipe, pinch, long-press)

   - **Smart Features**:
     - Notifications or alerts for important changes
     - Predictive suggestions or recommendations
     - Auto-refresh or live updates
     - Offline mode support
     - Export/download capabilities

   - **Contextual Enhancements**:
     - Related information or cross-references
     - Deep linking to related screens
     - Contextual help or tutorials
     - Empty state improvements with actions
     - Quick actions or shortcuts

   - **Platform-Specific Features**:
     - Haptic feedback (mobile)
     - Keyboard shortcuts (web)
     - Native features (camera, notifications, calendar)
     - Responsive adaptations for different screen sizes

4. **Review existing tests**:
   - Check test coverage for this feature
   - Identify untested code paths
   - Review test quality and comprehensiveness

5. **Gather metrics (if applicable)**:
   - Current bundle size impact
   - Render performance (use React DevTools Profiler concepts)
   - API call efficiency
   - User feedback or known issues

### STOP: Present analysis with specific improvement recommendations AND new feature suggestions, then wait for approval

## Step 2: PRIORITIZE & PLAN

1. **Categorize improvements and new features**:
   - **High Priority**: Critical bugs, performance issues, security concerns
   - **Medium Priority**: UX improvements, code quality, missing features, high-value new features
   - **Low Priority**: Nice-to-have new features, minor refactoring, documentation

2. **Create improvement plan**:
   - Break down into small, incremental changes
   - Identify which can be done in parallel
   - Estimate impact vs effort for each
   - Consider backwards compatibility

3. **Set success criteria**:
   - Define what "improved" means (e.g., "50% faster", "test coverage >80%")
   - Establish how to measure improvement
   - Define acceptable trade-offs

4. **Delegate new features**:
   - For approved new features, run `/add-feature [feature description]`
   - This ensures new features follow the full TDD workflow
   - Continue with improvements to existing functionality here

### STOP: Get approval on prioritized plan before proceeding

## Step 3: WRITE TESTS FIRST

1. **For new functionality**:
   - Write failing tests for new features
   - Cover happy paths and edge cases
   - Test error conditions

2. **For existing functionality**:
   - Add missing test coverage FIRST
   - Ensure current behavior is locked in
   - Tests serve as regression safety net

3. **For performance improvements**:
   - Create performance benchmarks
   - Document current baseline
   - Define performance test cases

4. **Run tests**:
   ```bash
   npm test [test-file]
   ```
   Ensure baseline tests pass before making changes

## Step 4: IMPLEMENT IMPROVEMENTS

Implement improvements **ONE AT A TIME** in this order:

### A. Critical Fixes First
- Security issues
- Data loss bugs
- Performance blockers

### B. Then Code Quality
- Extract reusable logic
- Reduce complexity (split large functions/components)
- Improve naming and readability
- Add TypeScript types
- Remove dead code

### C. Then UX Enhancements
- Improve error messages
- Add loading states
- Enhance accessibility
- Smooth animations
- Better mobile experience

### D. New Feature Additions

**Note**: For substantial new features, use `/add-feature [feature description]` instead of implementing here. Only implement minor feature additions as part of improvements.

Minor additions you can do here:
- Add new data displays or visualizations
- Implement simple user interactions
- Add sharing/export capabilities
- Implement filtering, sorting, or search
- Add customization options
- Platform-specific enhancements

Major features to delegate to `/add-feature`:
- Complex new screens or flows
- New services or data models
- Multi-component features
- Features requiring API changes

### E. Finally Documentation
- Add code comments for complex logic
- Update component docs
- Add usage examples

**Important**:
- Make ONE improvement at a time
- Run tests after EACH change
- Commit working improvements incrementally
- Don't bundle unrelated changes

## Step 5: VERIFY IMPROVEMENTS

After each improvement:

1. **Run tests**:
   ```bash
   npm test
   ```
   All tests must pass

2. **Verify the improvement**:
   - Measure performance gain (if applicable)
   - Check bundle size impact
   - Verify UX improvement manually
   - Check accessibility (screen readers, keyboard nav)

3. **Check for regressions**:
   - Test related features
   - Verify no breaking changes
   - Check error scenarios still handled

4. **Code review checklist**:
   - [ ] Tests pass
   - [ ] No console errors/warnings
   - [ ] TypeScript compiles without errors
   - [ ] Follows existing code patterns
   - [ ] No performance degradation
   - [ ] Backwards compatible (or migration path provided)
   - [ ] Documented if complex

## Step 6: COMMIT IMPROVEMENTS

For each improvement:

1. **Review changes**:
   ```bash
   git diff
   ```

2. **Create descriptive commit**:
   ```
   Improve: [Brief description]

   Before: [What it was like before]
   After: [What it's like now]
   Impact: [Measurable improvement]

   Changes:
   - [Specific change 1]
   - [Specific change 2]

   Testing: [How verified]
   ```

3. **Commit incrementally**:
   - Each commit should be a complete, working improvement
   - Don't bundle unrelated changes
   - Easier to review and rollback if needed

## Improvement Patterns

### Performance Optimization
- Use `useMemo` for expensive calculations
- Use `useCallback` for function props
- Implement virtualization for long lists
- Lazy load components with `React.lazy()`
- Debounce/throttle frequent operations
- Optimize images and assets
- Reduce bundle size

### Code Quality
- Extract magic numbers to constants
- Split large files into smaller modules
- Use custom hooks for reusable logic
- Improve TypeScript types (no `any`)
- Add error boundaries
- Consistent error handling pattern

### UX Enhancement
- Add loading skeletons
- Improve empty states
- Better error messages
- Smooth transitions/animations
- Optimistic UI updates
- Keyboard shortcuts
- Mobile-first responsive design

### Accessibility
- Semantic HTML elements
- ARIA labels and roles
- Keyboard navigation
- Focus management
- Screen reader support
- Color contrast ratios
- Touch target sizes (44x44 minimum)

### New Feature Additions
**Data Enhancements**:
- Add comparative metrics (vs last week, vs league average)
- Include trend indicators (up/down arrows, sparklines)
- Add filtering by date range, category, or status
- Implement search with autocomplete
- Show related or recommended items

**Interaction Enhancements**:
- Add pull-to-refresh for data updates
- Implement swipe gestures (swipe to delete, favorite)
- Add long-press for context menus
- Include quick actions (floating action button)
- Add drag-and-drop reordering

**Sharing & Export**:
- Share as image/screenshot
- Copy to clipboard with formatting
- Export to CSV, JSON, or PDF
- Share via social media
- Generate shareable links

**Smart Features**:
- Add comparison mode (side-by-side)
- Implement favorites/bookmarks
- Add user preferences/settings
- Include undo/redo functionality
- Add keyboard shortcuts (web)

**Visual Enhancements**:
- Add charts or graphs for data visualization
- Include progress bars or gauges
- Add badges for notable items
- Use color coding for categories
- Add animations for state changes

## Anti-Patterns to Avoid

❌ **Don't**:
- Make multiple unrelated improvements at once
- Skip writing tests
- Change working code without tests
- Optimize prematurely (measure first!)
- Break existing functionality
- Ignore TypeScript errors
- Remove features without replacement
- Change API contracts without migration
- Implement major new features here (use `/add-feature` instead)

✅ **Do**:
- Improve incrementally
- Test before and after
- Measure performance impact
- Maintain backwards compatibility
- Document breaking changes
- Consider mobile users
- Think about accessibility
- Keep bundle size in check
- Use `/add-feature` for substantial new features

## Checklist

- [ ] Current implementation analyzed
- [ ] Improvement opportunities identified
- [ ] Plan approved by user
- [ ] Existing tests pass (baseline)
- [ ] New/updated tests written
- [ ] Improvements implemented incrementally
- [ ] Each improvement tested and verified
- [ ] Performance measured (if applicable)
- [ ] No regressions introduced
- [ ] Accessibility maintained/improved
- [ ] TypeScript types correct
- [ ] Documentation updated
- [ ] Incremental commits with clear messages
- [ ] Full test suite passes
- [ ] Manually tested in simulator/browser

## Example Workflow

```text
1. Analyze current implementation ✓
2. Identify improvements: slow rendering, no loading state, poor error handling
3. Identify new features: add search, add advanced filtering, add share button
4. Present findings and recommendations to user
5. User approves: loading skeleton, optimize renders, share button
6. User wants search added: Run /add-feature "Search functionality for UserList"
7. Plan remaining improvements: Loading skeleton → Optimize renders → Share
8. Write tests for loading states ✓
9. Implement loading skeleton ✓
10. Test & verify ✓
11. Commit "Improve: Add loading skeleton to UserList"
12. Write tests for memoization ✓
13. Add useMemo/useCallback ✓
14. Measure: 40% fewer renders ✓
15. Commit "Improve: Optimize UserList rendering (40% faster)"
16. Write tests for share functionality ✓
17. Implement share button with copy/export ✓
18. Test & verify ✓
19. Commit "Improve: Add share and export to UserList"
20. All improvements complete!
21. Search feature added via /add-feature command separately ✓
```

## Measuring Success

Track these metrics before/after:

**Performance**:

- Bundle size change
- Render count reduction
- Time to interactive
- API call efficiency

**Quality**:

- Test coverage increase
- TypeScript coverage
- Complexity score (cyclomatic complexity)
- Lines of code (less is often better)

**UX**:

- Lighthouse score
- Accessibility score
- User feedback
- Error rate reduction

---

**Remember**: Improvement is incremental. Small, tested changes are better than large risky refactors. When suggesting new features, focus on those that add real value to users while maintaining code quality and performance.
