/**
 * Tests for Model Prediction Service
 * Verifies that Classic model produces IDENTICAL results to original functions
 */

import {
  calculateConfidenceScoreWithModel,
  createClassicModel,
  calculateFactorBreakdown,
  getTopFactors,
  FactorBreakdownItem,
} from '../modelPrediction';
import {
  calculateConfidenceScore,
  CONFIDENCE_WEIGHTS,
  PLAYER_WEIGHTS,
} from '../../utils/predictionUtils';
import type {
  GameData,
  TeamStandings,
  RecentFormStats,
  SituationalFactors,
  TeamPredictionStats,
  PlayerPredictionFactors,
} from '../../types/predictions';

// Mock data for testing
const createMockGame = (id: number = 1): GameData => ({
  id,
  homeTeam: { abbrev: 'TOR' },
  awayTeam: { abbrev: 'MTL' },
  gameState: 'FUT',
  startTimeUTC: '2024-01-15T19:00:00Z',
});

const createMockTeamStandings = (overrides: Partial<TeamStandings> = {}): TeamStandings => ({
  teamAbbrev: 'TOR',
  pointPctg: 0.600,
  wins: 25,
  losses: 15,
  otLosses: 5,
  points: 55,
  goalFor: 150,
  goalAgainst: 120,
  gamesPlayed: 45,
  streakCode: 'W3',
  ...overrides,
});

const createMockRecentForm = (): { home: RecentFormStats; away: RecentFormStats } => ({
  home: {
    wins: 7,
    losses: 3,
    pointPctg: 0.700,
    goalDifferential: 8,
    gamesPlayed: 10,
  },
  away: {
    wins: 5,
    losses: 5,
    pointPctg: 0.500,
    goalDifferential: 0,
    gamesPlayed: 10,
  },
});

const createMockSituationalFactors = (): SituationalFactors => ({
  homeBackToBack: false,
  awayBackToBack: true,
  homeRestDays: 2,
  awayRestDays: 0,
  restAdvantage: 'home',
});

const createMockTeamStats = (): { home: TeamPredictionStats; away: TeamPredictionStats } => ({
  home: {
    powerPlayPct: 0.24,
    penaltyKillPct: 0.82,
    shotsForPerGame: 32,
    shotsAgainstPerGame: 28,
  },
  away: {
    powerPlayPct: 0.18,
    penaltyKillPct: 0.78,
    shotsForPerGame: 28,
    shotsAgainstPerGame: 32,
  },
});

const createMockPlayerFactors = (): PlayerPredictionFactors => ({
  goalieMatchup: {
    homeGoalie: null,
    awayGoalie: null,
    advantage: 'home',
    confidenceImpact: 5,
  },
  homeHotPlayers: {
    teamAbbrev: 'TOR',
    hotPlayers: [],
    coldPlayers: [],
    injuredStars: [],
    overallHeatIndex: 3,
  },
  awayHotPlayers: {
    teamAbbrev: 'MTL',
    hotPlayers: [],
    coldPlayers: [],
    injuredStars: [],
    overallHeatIndex: -2,
  },
  totalImpact: 10,
});

describe('modelPrediction', () => {
  describe('createClassicModel', () => {
    it('should create a model with Classic weights', () => {
      const classicModel = createClassicModel();

      expect(classicModel.id).toBe('classic');
      expect(classicModel.name).toBe('PuckIQ Classic');
      expect(classicModel.isDefault).toBe(true);
      expect(classicModel.isActive).toBe(true);
    });

    it('should have weights matching CONFIDENCE_WEIGHTS', () => {
      const classicModel = createClassicModel();

      expect(classicModel.weights.standingsDifferential).toBe(CONFIDENCE_WEIGHTS.standingsDifferential);
      expect(classicModel.weights.homeIceAdvantage).toBe(CONFIDENCE_WEIGHTS.homeIceAdvantage);
      expect(classicModel.weights.streakImpact).toBe(CONFIDENCE_WEIGHTS.streakImpact);
      expect(classicModel.weights.goalDifferentialImpact).toBe(CONFIDENCE_WEIGHTS.goalDifferentialImpact);
      expect(classicModel.weights.recentFormImpact).toBe(CONFIDENCE_WEIGHTS.recentFormImpact);
      expect(classicModel.weights.backToBackPenalty).toBe(CONFIDENCE_WEIGHTS.backToBackPenalty);
      expect(classicModel.weights.restAdvantage).toBe(CONFIDENCE_WEIGHTS.restAdvantage);
      expect(classicModel.weights.specialTeamsImpact).toBe(CONFIDENCE_WEIGHTS.specialTeamsImpact);
      expect(classicModel.weights.shotDifferentialImpact).toBe(CONFIDENCE_WEIGHTS.shotDifferentialImpact);
    });

    it('should have playerWeights matching PLAYER_WEIGHTS', () => {
      const classicModel = createClassicModel();

      expect(classicModel.playerWeights.goalieMatchupImpact).toBe(PLAYER_WEIGHTS.goalieMatchupImpact);
      expect(classicModel.playerWeights.hotPlayersImpact).toBe(PLAYER_WEIGHTS.hotPlayersImpact);
    });
  });

  describe('calculateConfidenceScoreWithModel - Classic model parity', () => {
    it('should produce IDENTICAL results to original calculateConfidenceScore with basic inputs', () => {
      const game = createMockGame();
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR', pointPctg: 0.600 });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL', pointPctg: 0.450, streakCode: 'L2' });

      const classicModel = createClassicModel();

      const originalScore = calculateConfidenceScore(game, homeTeam, awayTeam);
      const modelScore = calculateConfidenceScoreWithModel(
        game,
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights
      );

      expect(modelScore).toBe(originalScore);
    });

    it('should produce IDENTICAL results with recent form data', () => {
      const game = createMockGame();
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR' });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL', pointPctg: 0.500 });
      const recentForm = createMockRecentForm();

      const classicModel = createClassicModel();

      const originalScore = calculateConfidenceScore(
        game,
        homeTeam,
        awayTeam,
        CONFIDENCE_WEIGHTS,
        recentForm
      );
      const modelScore = calculateConfidenceScoreWithModel(
        game,
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights,
        recentForm
      );

      expect(modelScore).toBe(originalScore);
    });

    it('should produce IDENTICAL results with situational factors', () => {
      const game = createMockGame();
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR' });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL', pointPctg: 0.500 });
      const recentForm = createMockRecentForm();
      const situational = createMockSituationalFactors();

      const classicModel = createClassicModel();

      const originalScore = calculateConfidenceScore(
        game,
        homeTeam,
        awayTeam,
        CONFIDENCE_WEIGHTS,
        recentForm,
        situational
      );
      const modelScore = calculateConfidenceScoreWithModel(
        game,
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights,
        recentForm,
        situational
      );

      expect(modelScore).toBe(originalScore);
    });

    it('should produce IDENTICAL results with team stats', () => {
      const game = createMockGame();
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR' });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL', pointPctg: 0.500 });
      const recentForm = createMockRecentForm();
      const situational = createMockSituationalFactors();
      const teamStats = createMockTeamStats();

      const classicModel = createClassicModel();

      const originalScore = calculateConfidenceScore(
        game,
        homeTeam,
        awayTeam,
        CONFIDENCE_WEIGHTS,
        recentForm,
        situational,
        teamStats
      );
      const modelScore = calculateConfidenceScoreWithModel(
        game,
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights,
        recentForm,
        situational,
        teamStats
      );

      expect(modelScore).toBe(originalScore);
    });

    it('should produce IDENTICAL results with ALL factors including player factors', () => {
      const game = createMockGame();
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR' });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL', pointPctg: 0.500 });
      const recentForm = createMockRecentForm();
      const situational = createMockSituationalFactors();
      const teamStats = createMockTeamStats();
      const playerFactors = createMockPlayerFactors();

      const classicModel = createClassicModel();

      const originalScore = calculateConfidenceScore(
        game,
        homeTeam,
        awayTeam,
        CONFIDENCE_WEIGHTS,
        recentForm,
        situational,
        teamStats,
        playerFactors
      );
      const modelScore = calculateConfidenceScoreWithModel(
        game,
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights,
        recentForm,
        situational,
        teamStats,
        playerFactors
      );

      expect(modelScore).toBe(originalScore);
    });

    it('should return 50 when teams are null', () => {
      const game = createMockGame();
      const classicModel = createClassicModel();

      const originalScore = calculateConfidenceScore(game, null, null);
      const modelScore = calculateConfidenceScoreWithModel(
        game,
        null,
        null,
        classicModel.weights,
        classicModel.playerWeights
      );

      expect(modelScore).toBe(50);
      expect(modelScore).toBe(originalScore);
    });
  });

  describe('calculateConfidenceScoreWithModel - Custom weights', () => {
    it('should produce DIFFERENT results with modified weights', () => {
      const game = createMockGame();
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR', pointPctg: 0.700 });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL', pointPctg: 0.400 });

      const classicModel = createClassicModel();
      const customModel = {
        ...classicModel,
        weights: {
          ...classicModel.weights,
          standingsDifferential: 150, // Much higher than default 80
        },
      };

      const classicScore = calculateConfidenceScoreWithModel(
        game,
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights
      );
      const customScore = calculateConfidenceScoreWithModel(
        game,
        homeTeam,
        awayTeam,
        customModel.weights,
        customModel.playerWeights
      );

      // Custom model should give higher score due to higher standingsDifferential weight
      expect(customScore).toBeGreaterThan(classicScore);
    });

    it('should produce DIFFERENT results with modified player weights', () => {
      const game = createMockGame();
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR' });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL' });
      const playerFactors = createMockPlayerFactors();

      const classicModel = createClassicModel();
      const customModel = {
        ...classicModel,
        playerWeights: {
          ...classicModel.playerWeights,
          goalieMatchupImpact: 3.0, // Much higher than default 1.0
        },
      };

      const classicScore = calculateConfidenceScoreWithModel(
        game,
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights,
        undefined,
        undefined,
        undefined,
        playerFactors
      );
      const customScore = calculateConfidenceScoreWithModel(
        game,
        homeTeam,
        awayTeam,
        customModel.weights,
        customModel.playerWeights,
        undefined,
        undefined,
        undefined,
        playerFactors
      );

      // Custom model should give different score due to higher goalie impact
      expect(customScore).not.toBe(classicScore);
    });
  });

  describe('calculateFactorBreakdown', () => {
    it('should return breakdown with all basic factors', () => {
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR', pointPctg: 0.600 });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL', pointPctg: 0.450, streakCode: 'L2' });
      const classicModel = createClassicModel();

      const breakdown = calculateFactorBreakdown(
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights
      );

      // Should have at least 4 basic factors (standings, home ice, streaks, goal diff)
      expect(breakdown.length).toBeGreaterThanOrEqual(4);

      // Check that each breakdown item has required fields
      breakdown.forEach((item: FactorBreakdownItem) => {
        expect(item).toHaveProperty('factorKey');
        expect(item).toHaveProperty('factorName');
        expect(item).toHaveProperty('homeValue');
        expect(item).toHaveProperty('awayValue');
        expect(item).toHaveProperty('impact');
        expect(item).toHaveProperty('favoredTeam');
        expect(['home', 'away', 'neutral']).toContain(item.favoredTeam);
      });
    });

    it('should include standings differential factor', () => {
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR', pointPctg: 0.700 });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL', pointPctg: 0.400 });
      const classicModel = createClassicModel();

      const breakdown = calculateFactorBreakdown(
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights
      );

      const standingsFactor = breakdown.find(b => b.factorKey === 'standingsDifferential');
      expect(standingsFactor).toBeDefined();
      expect(standingsFactor?.factorName).toBe('Standings');
      expect(standingsFactor?.impact).toBeGreaterThan(0); // Home team is better
      expect(standingsFactor?.favoredTeam).toBe('home');
    });

    it('should include home ice advantage factor', () => {
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR' });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL' });
      const classicModel = createClassicModel();

      const breakdown = calculateFactorBreakdown(
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights
      );

      const homeIceFactor = breakdown.find(b => b.factorKey === 'homeIceAdvantage');
      expect(homeIceFactor).toBeDefined();
      expect(homeIceFactor?.factorName).toBe('Home Ice');
      expect(homeIceFactor?.impact).toBe(classicModel.weights.homeIceAdvantage);
      expect(homeIceFactor?.favoredTeam).toBe('home');
    });

    it('should include additional factors when provided', () => {
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR' });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL' });
      const recentForm = createMockRecentForm();
      const situational = createMockSituationalFactors();
      const teamStats = createMockTeamStats();
      const playerFactors = createMockPlayerFactors();
      const classicModel = createClassicModel();

      const breakdown = calculateFactorBreakdown(
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights,
        recentForm,
        situational,
        teamStats,
        playerFactors
      );

      // Should have all 11 factors when all data is provided
      expect(breakdown.length).toBe(11);

      // Check for specific factors
      const factorKeys = breakdown.map(b => b.factorKey);
      expect(factorKeys).toContain('standingsDifferential');
      expect(factorKeys).toContain('homeIceAdvantage');
      expect(factorKeys).toContain('streakImpact');
      expect(factorKeys).toContain('goalDifferentialImpact');
      expect(factorKeys).toContain('recentFormImpact');
      expect(factorKeys).toContain('backToBackPenalty');
      expect(factorKeys).toContain('restAdvantage');
      expect(factorKeys).toContain('specialTeamsImpact');
      expect(factorKeys).toContain('shotDifferentialImpact');
      expect(factorKeys).toContain('goalieMatchupImpact');
      expect(factorKeys).toContain('hotPlayersImpact');
    });

    it('should correctly identify back-to-back penalty', () => {
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR' });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL' });
      const situational = createMockSituationalFactors(); // Away team is back-to-back
      const classicModel = createClassicModel();

      const breakdown = calculateFactorBreakdown(
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights,
        undefined,
        situational
      );

      const b2bFactor = breakdown.find(b => b.factorKey === 'backToBackPenalty');
      expect(b2bFactor).toBeDefined();
      expect(b2bFactor?.homeValue).toBe('No');
      expect(b2bFactor?.awayValue).toBe('Yes');
      expect(b2bFactor?.impact).toBeGreaterThan(0); // Favors home team
      expect(b2bFactor?.favoredTeam).toBe('home');
    });
  });

  describe('getTopFactors', () => {
    it('should return top N factors by absolute impact', () => {
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR', pointPctg: 0.700 });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL', pointPctg: 0.400 });
      const classicModel = createClassicModel();

      const breakdown = calculateFactorBreakdown(
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights
      );

      const topFactors = getTopFactors(breakdown, 3);
      expect(topFactors.length).toBe(3);

      // Should be sorted by absolute impact (descending)
      for (let i = 0; i < topFactors.length - 1; i++) {
        expect(Math.abs(topFactors[i].impact)).toBeGreaterThanOrEqual(Math.abs(topFactors[i + 1].impact));
      }
    });

    it('should default to 5 factors when count not specified', () => {
      const homeTeam = createMockTeamStandings({ teamAbbrev: 'TOR' });
      const awayTeam = createMockTeamStandings({ teamAbbrev: 'MTL' });
      const recentForm = createMockRecentForm();
      const situational = createMockSituationalFactors();
      const teamStats = createMockTeamStats();
      const playerFactors = createMockPlayerFactors();
      const classicModel = createClassicModel();

      const breakdown = calculateFactorBreakdown(
        homeTeam,
        awayTeam,
        classicModel.weights,
        classicModel.playerWeights,
        recentForm,
        situational,
        teamStats,
        playerFactors
      );

      const topFactors = getTopFactors(breakdown);
      expect(topFactors.length).toBe(5);
    });
  });
});
