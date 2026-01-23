import { FactorType, GameFactor, FactorAnalysisInput } from '../types/factors';

export { FactorType, GameFactor };

export function calculateTopFactors(
  homeTeam: FactorAnalysisInput,
  awayTeam: FactorAnalysisInput
): GameFactor[] {
  const factors: GameFactor[] = [];

  // Goalie Edge
  if (homeTeam.recentSavePct && awayTeam.recentSavePct) {
    const diff = homeTeam.recentSavePct - awayTeam.recentSavePct;
    if (Math.abs(diff) > 0.01) {
      factors.push({
        type: 'GOALIE_EDGE',
        advantage: diff > 0 ? homeTeam.abbrev : awayTeam.abbrev,
        description: 'GOALIE EDGE',
        detail: `${homeTeam.abbrev} ${(homeTeam.recentSavePct * 100).toFixed(1)}% vs ${awayTeam.abbrev} ${(awayTeam.recentSavePct * 100).toFixed(1)}%`,
        impact: Math.abs(diff) * 1000,
      });
    }
  }

  // Home Ice
  factors.push({
    type: 'HOME_ICE',
    advantage: homeTeam.abbrev,
    description: 'HOME ICE',
    detail: homeTeam.homeRecord ? `${homeTeam.homeRecord} at home` : 'Home team',
    impact: 30,
  });

  // Rest
  const homeDaysRest = homeTeam.daysRest ?? 1;
  const awayDaysRest = awayTeam.daysRest ?? 1;
  const restDiff = homeDaysRest - awayDaysRest;
  factors.push({
    type: 'REST',
    advantage: restDiff > 0 ? homeTeam.abbrev : restDiff < 0 ? awayTeam.abbrev : 'EVEN',
    description: 'REST',
    detail: restDiff === 0
      ? `Both teams ${homeDaysRest} days rest`
      : `${restDiff > 0 ? homeTeam.abbrev : awayTeam.abbrev} more rested`,
    impact: Math.abs(restDiff) * 10,
  });

  // Sort by impact and return top 3
  return factors
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);
}
