/**
 * Briefing / live-Supabase suites excluded from default `npm test`.
 * They are not the roster-first cut. Expected to fail without that product or DB.
 */
const base = require('./jest.config');

module.exports = {
  ...base,
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: [
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
};
