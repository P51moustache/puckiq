---
description: Set up testing infrastructure for PuckIQ
argument-hint: (no arguments needed)
---

Set up testing infrastructure for PuckIQ.

## Phase 1: Install Dependencies

```bash
npm install --save-dev \
  jest \
  @testing-library/react-native \
  @testing-library/jest-native \
  @testing-library/react-hooks \
  jest-mock-async-storage \
  @types/jest \
  ts-jest \
  jest-expo
```

## Phase 2: Configure Jest

Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'jest-expo',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testEnvironment: 'node',
  collectCoverageFrom: [
    'services/**/*.ts',
    'hooks/**/*.ts',
    'components/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.(test|spec).[jt]s?(x)',
    '**/?(*.)(test|spec).[jt]s?(x)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  coverageThresholds: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
};
```

## Phase 3: Create Setup File

Create `jest.setup.js`:
```javascript
import '@testing-library/jest-native/extend-expect';
import { getTestableAsyncStorage } from 'jest-mock-async-storage';

// Mock AsyncStorage
const AsyncStorage = getTestableAsyncStorage();
jest.mock('@react-native-async-storage/async-storage', () => AsyncStorage);

// Mock Firebase
jest.mock('./lib/firebase', () => ({
  analytics: {
    logEvent: jest.fn(),
  },
}));

// Mock React Native modules
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
}));

// Silence console.logs in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};
```

## Phase 4: Create Test Utilities

Create `__tests__/utils/testUtils.tsx`:
```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';

export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AnalyticsProvider>
      {ui}
    </AnalyticsProvider>
  );
}

export * from '@testing-library/react-native';
```

Create `__tests__/utils/factories.ts`:
```typescript
import { getTodayDateString } from '@/services/pickTracking';

export function createMockPick(overrides = {}) {
  return {
    gameId: '123',
    date: getTodayDateString(),
    type: 'smart-pick',
    predictedWinner: 'TOR',
    homeTeam: 'TOR',
    awayTeam: 'MTL',
    confidenceScore: 75,
    outcome: undefined,
    actualWinner: undefined,
    ...overrides,
  };
}

export function createMockGame(overrides = {}) {
  return {
    id: '123',
    homeTeam: {
      abbrev: 'TOR',
      name: { default: 'Toronto Maple Leafs' },
    },
    awayTeam: {
      abbrev: 'MTL',
      name: { default: 'Montreal Canadiens' },
    },
    startTimeUTC: new Date().toISOString(),
    gameState: 'FUT',
    ...overrides,
  };
}

export function createMockStreakData(overrides = {}) {
  return {
    currentStreak: 1,
    longestStreak: 1,
    lastVisitDate: getTodayDateString(),
    totalDays: 1,
    ...overrides,
  };
}
```

## Phase 5: Update package.json

Add test scripts to `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest services/ hooks/",
    "test:integration": "jest __tests__/integration/",
    "test:component": "jest components/__tests__/",
    "test:all": "npm run lint && npm run test:coverage"
  }
}
```

## Phase 6: Create First Test

Create `services/__tests__/pickTracking.test.ts`:
```typescript
import {
  calculatePickStats,
  getTodayDateString,
} from '../pickTracking';
import { createMockPick } from '@/__tests__/utils/factories';

describe('pickTracking', () => {
  describe('calculatePickStats', () => {
    it('should calculate accuracy correctly', () => {
      const picks = [
        createMockPick({ outcome: 'win' }),
        createMockPick({ outcome: 'loss' }),
      ];

      const stats = calculatePickStats(picks);

      expect(stats.total).toBe(2);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      expect(stats.accuracy).toBe(50);
    });
  });

  describe('getTodayDateString', () => {
    it('should return YYYY-MM-DD format', () => {
      const today = getTodayDateString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
```

## Phase 7: Run Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Phase 8: Set Up CI/CD (Optional)

Create `.github/workflows/test.yml`:
```yaml
name: Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Use Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20.x'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linter
      run: npm run lint

    - name: Run tests
      run: npm run test:coverage

    - name: Check coverage thresholds
      run: |
        if [ -f coverage/coverage-summary.json ]; then
          echo "Coverage report generated"
        fi
```

## Checklist

- ✅ Dependencies installed
- ✅ jest.config.js created
- ✅ jest.setup.js created
- ✅ Test utilities created
- ✅ Test factories created
- ✅ package.json scripts added
- ✅ First test written
- ✅ Tests run successfully
- ✅ Coverage report generated
- ✅ CI/CD configured (optional)

## Next Steps

After setup is complete:
1. Write tests for `services/pickTracking.ts`
2. Write tests for `services/streakTracking.ts`
3. Write tests for `services/analytics/AnalyticsService.ts`
4. Achieve 70% coverage for services/
5. Add component tests for critical UI
6. Add E2E tests for main flows
