// Test file to reproduce stats display bugs in GameDeepDiveModal
import { getTeamComparisonData, formatStatValue } from '../teamComparison';
import { setupTeamComparisonMocks } from './fixtures/teamComparisonMocks';

// Expected TOR per-game values derived from the shared fixture
// (50 GP, 160 GF, 130 GA): 160/50 = 3.2, 130/50 = 2.6.
const EXPECTED_TOR_GPG = 3.2;
const EXPECTED_TOR_GAPG = 2.6;

beforeEach(() => {
  setupTeamComparisonMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('teamComparison bug fixes', () => {
  describe('formatStatValue', () => {
    it('should not double-format save percentage', () => {
      // Save % from API is decimal (e.g., 0.905 for 90.5%)
      const savePct = 0.905;

      // When we multiply by 100 and use 'percentage' format
      const formatted = formatStatValue(savePct * 100, 'percentage', 1);

      // Bug: This will show "90.5%%" instead of "90.5%"
      // Expected: Should show "90.5%" not "90.5%%"
      expect(formatted).toBe('90.5%');
      expect(formatted).not.toContain('%%');
    });

    it('should handle decimal save percentage correctly', () => {
      // If we don't multiply by 100 first
      const savePct = 0.905;
      const formatted = formatStatValue(savePct, 'decimal', 3);

      // Should show as decimal
      expect(formatted).toBe('0.905');
    });

    it('should format percentage without multiplication', () => {
      // PP% from API is already a percentage (e.g., 22.5)
      const powerPlayPct = 22.5;
      const formatted = formatStatValue(powerPlayPct, 'percentage', 1);

      // Should show "22.5%"
      expect(formatted).toBe('22.5%');
    });
  });

  describe('getTeamComparisonData (Supabase-sourced)', () => {
    it('should compute per-game stats from Supabase standings', async () => {
      // The optional standingsData param is legacy; the service is Supabase-only
      // and ignores it, sourcing standings from the (mocked) DB instead.
      const stats = await getTeamComparisonData('TOR');

      expect(stats.offense.goalsPerGame).toBeCloseTo(EXPECTED_TOR_GPG, 1);
      expect(stats.defense.goalsAgainstPerGame).toBeCloseTo(EXPECTED_TOR_GAPG, 1);
    });

    it('should not throw when a legacy standingsData arg is passed', async () => {
      const stats = await getTeamComparisonData('TOR', { standings: [] });

      expect(stats.offense.goalsPerGame).toBeCloseTo(EXPECTED_TOR_GPG, 1);
    });
  });

  describe('power play percentage display', () => {
    it('should have powerPlayPct in offense stats', async () => {
      const stats = await getTeamComparisonData('TOR');

      // Power Play % should exist in offense
      expect(stats.offense.powerPlayPct).toBeDefined();
      expect(stats.offense.powerPlayPct).toBeGreaterThanOrEqual(0);
    });

    it('should have same powerPlayPct in specialTeams as offense', async () => {
      const stats = await getTeamComparisonData('TOR');

      // PP% should be the same in both places
      expect(stats.specialTeams.powerPlayPct).toBe(stats.offense.powerPlayPct);
    });

    it('should have penaltyKillPct in both defense and specialTeams', async () => {
      const stats = await getTeamComparisonData('TOR');

      // PK% should be the same in both places
      expect(stats.defense.penaltyKillPct).toBe(stats.specialTeams.penaltyKillPct);
    });
  });
});
