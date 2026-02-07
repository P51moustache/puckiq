// Test to verify we're using real NHL data sourced from the correct API fields
import { getTeamComparisonData } from '../teamComparison';
import { setupTeamComparisonMocks, mockTeamSummaryData, mockStandings } from './fixtures/teamComparisonMocks';

beforeEach(() => {
  setupTeamComparisonMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Real NHL API Data (not estimated)', () => {
  it('should use real Power Play % from team summary, not estimated', async () => {
    const stats = await getTeamComparisonData('TOR');

    // PP% comes from teamSummary.powerPlayPct (0.225) * 100 = 22.5
    const torSummary = mockTeamSummaryData.data.find(t => t.teamId === 10)!;
    const expectedPP = torSummary.powerPlayPct * 100;

    expect(Math.abs(stats.offense.powerPlayPct - expectedPP)).toBeLessThan(0.01);
  });

  it('should use real Penalty Kill % from team summary, not estimated', async () => {
    const stats = await getTeamComparisonData('BOS');

    // PK% comes from teamSummary.penaltyKillPct (0.820) * 100 = 82.0
    const bosSummary = mockTeamSummaryData.data.find(t => t.teamId === 6)!;
    const expectedPK = bosSummary.penaltyKillPct * 100;

    expect(Math.abs(stats.defense.penaltyKillPct - expectedPK)).toBeLessThan(0.01);
  });

  it('should use real Shots Per Game from team summary, not aggregated from player data', async () => {
    const stats = await getTeamComparisonData('TOR');

    const torSummary = mockTeamSummaryData.data.find(t => t.teamId === 10)!;
    const expectedShotsFor = torSummary.shotsForPerGame;
    const expectedShotsAgainst = torSummary.shotsAgainstPerGame;

    expect(Math.abs(stats.offense.shotsPerGame - expectedShotsFor)).toBeLessThan(0.01);
    expect(Math.abs(stats.defense.shotsAgainstPerGame - expectedShotsAgainst)).toBeLessThan(0.01);
  });
});
