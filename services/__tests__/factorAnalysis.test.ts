import {
  FactorType,
  GameFactor,
  calculateTopFactors,
} from '../factorAnalysis';

describe('factorAnalysis', () => {
  describe('calculateTopFactors', () => {
    it('should return top 3 factors for a game sorted by impact', () => {
      const homeTeam = {
        abbrev: 'CAR',
        homeRecord: '15-3-1',
        recentSavePct: 0.932,
        daysRest: 2,
      };
      const awayTeam = {
        abbrev: 'CHI',
        homeRecord: '10-10-2',
        recentSavePct: 0.891,
        daysRest: 2,
      };

      const factors = calculateTopFactors(homeTeam, awayTeam);

      expect(factors).toHaveLength(3);
      expect(factors[0].type).toBeDefined();
      expect(factors[0].advantage).toBeDefined();
      expect(factors[0].description).toBeDefined();
    });

    it('should identify goalie edge when save percentages differ significantly', () => {
      const homeTeam = { abbrev: 'CAR', recentSavePct: 0.932, daysRest: 2, homeRecord: '15-3-1' };
      const awayTeam = { abbrev: 'CHI', recentSavePct: 0.891, daysRest: 2, homeRecord: '10-10-2' };

      const factors = calculateTopFactors(homeTeam, awayTeam);
      const goalieFactor = factors.find(f => f.type === 'GOALIE_EDGE');

      expect(goalieFactor).toBeDefined();
      expect(goalieFactor?.advantage).toBe('CAR');
    });

    it('should identify home ice advantage', () => {
      const homeTeam = { abbrev: 'CAR', recentSavePct: 0.910, daysRest: 2, homeRecord: '15-3-1' };
      const awayTeam = { abbrev: 'CHI', recentSavePct: 0.910, daysRest: 2, homeRecord: '10-10-2' };

      const factors = calculateTopFactors(homeTeam, awayTeam);
      const homeIceFactor = factors.find(f => f.type === 'HOME_ICE');

      expect(homeIceFactor).toBeDefined();
      expect(homeIceFactor?.advantage).toBe('CAR');
    });
  });
});
