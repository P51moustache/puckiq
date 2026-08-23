module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        skipLibCheck: true,
      },
    }],
  },
  globals: {
    '__DEV__': true,
  },
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
  // Pre-existing briefing / live-Supabase suites. They fail without the old
  // dashboard product or a live database. Not the roster-first cut — do not
  // rewrite them in this PR. Run with: npm run test:legacy
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/services/__tests__/gameResults.test.ts',
    '<rootDir>/services/__tests__/backtesting.test.ts',
    '<rootDir>/services/__tests__/supabaseDataIntegrity.test.ts',
    '<rootDir>/services/__tests__/teamComparison.test.ts',
    '<rootDir>/services/__tests__/teamComparisonBugFix.test.ts',
    '<rootDir>/services/__tests__/comparisonCalculations.test.ts',
    '<rootDir>/services/__tests__/categoryWinnerVerification.test.ts',
    '<rootDir>/services/__tests__/verifyAllStatsPopulated.test.ts',
    '<rootDir>/services/__tests__/statsDisplayBugs.test.ts',
    '<rootDir>/services/__tests__/categoryWinnerBug.test.ts',
    '<rootDir>/services/__tests__/dashboardModules.test.ts',
    '<rootDir>/services/__tests__/realDataBug.test.ts',
    '<rootDir>/components/__tests__/AllGamesCard.test.tsx',
    '<rootDir>/components/__tests__/HeroLeaderCard.test.tsx',
    '<rootDir>/components/__tests__/HeroBanner.test.tsx',
    '<rootDir>/components/__tests__/GoalieSpotlightCard.test.tsx',
    '<rootDir>/components/__tests__/HeroMatchup.test.tsx',
    '<rootDir>/components/__tests__/CompactPlayerRow.test.tsx',
    '<rootDir>/components/__tests__/EmptyNightCard.test.tsx',
    '<rootDir>/components/__tests__/Leaderboard.test.tsx',
    '<rootDir>/components/dashboard/__tests__/StartSitModule.test.tsx',
    '<rootDir>/components/dashboard/__tests__/TrendingModule.test.tsx',
    '<rootDir>/components/dashboard/__tests__/ModulePicker.test.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^expo/src/winter/(.*)$': '<rootDir>/__mocks__/expo-winter.js',
    '^@expo/metro-runtime$': '<rootDir>/__mocks__/expo-winter.js',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
};
