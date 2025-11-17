---
description: Test a service file using TDD approach
argument-hint: [service filename]
---

Test a service file using TDD approach.

Target service: $ARGUMENTS

## Steps:

1. **Read the service file** to understand its current implementation
2. **Identify functions that need tests**, prioritizing:
   - Public API functions
   - Complex logic functions
   - Functions with edge cases
   - Functions that interact with AsyncStorage

3. **Create test file** at `services/__tests__/[filename].test.ts`

4. **Write comprehensive unit tests** covering:
   - Happy path scenarios
   - Edge cases (empty arrays, null values, etc.)
   - Error handling (network failures, storage errors)
   - AsyncStorage interactions (properly mocked)
   - Date/time edge cases
   - Boundary conditions

5. **Use test factories** for consistent mock data

6. **Run tests** and verify they pass:
   ```bash
   npm test services/__tests__/[filename].test.ts
   ```

7. **Check coverage** for this file:
   ```bash
   npm run test:coverage -- services/[filename].ts
   ```

8. **Show summary** with:
   - Number of tests written
   - Coverage percentage
   - Any uncovered edge cases identified

## Important Notes:
- Mock AsyncStorage using `jest-mock-async-storage`
- Mock Firebase analytics calls
- DON'T mock the code under test
- Use descriptive test names: "should X when Y"
- Group related tests with describe blocks
- Clear AsyncStorage between tests with beforeEach
