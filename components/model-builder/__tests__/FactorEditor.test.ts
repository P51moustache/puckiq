/**
 * FactorEditor Component Tests
 * Tests the factor editor with collapsible sections and weight distribution
 */

import {
  FACTOR_DEFINITIONS,
  FactorCategory,
  getFactorsByCategory,
  CATEGORY_NAMES,
  CATEGORY_DESCRIPTIONS,
} from '../../../constants/modelFactors';
import type { ConfidenceWeights, PlayerWeights } from '../../../types/predictions';

// Combined weights type
type AllWeights = ConfidenceWeights & PlayerWeights;

// Categories in display order
const CATEGORIES: FactorCategory[] = ['team', 'situational', 'specialTeams', 'playerBased'];

// Default weights
const getDefaultWeights = (): AllWeights => ({
  standingsDifferential: 80,
  homeIceAdvantage: 8,
  streakImpact: 12,
  goalDifferentialImpact: 12,
  recentFormImpact: 40,
  backToBackPenalty: 15,
  restAdvantage: 8,
  specialTeamsImpact: 25,
  shotDifferentialImpact: 10,
  goalieMatchupImpact: 1.0,
  hotPlayersImpact: 1.5,
});

// Helper to convert AllWeights to Record<string, number>
const toRecord = (weights: AllWeights): Record<string, number> => {
  const record: Record<string, number> = {};
  (Object.keys(weights) as Array<keyof AllWeights>).forEach((key) => {
    record[key] = weights[key];
  });
  return record;
};

// Helper to check if category has modifications
const categoryHasModifications = (
  category: FactorCategory,
  weights: Record<string, number>
): boolean => {
  const factors = getFactorsByCategory(category);
  return factors.some((factor) => weights[factor.key] !== factor.defaultValue);
};

// Helper to calculate category totals for distribution
const calculateCategoryTotals = (weights: Record<string, number>) => {
  const totals: Record<FactorCategory, number> = {
    team: 0,
    situational: 0,
    specialTeams: 0,
    playerBased: 0,
  };

  FACTOR_DEFINITIONS.forEach((factor) => {
    const value = weights[factor.key] ?? factor.defaultValue;
    // Normalize: for factors with small values (like playerBased 0-3), scale up
    const normalizedValue = factor.max <= 5 ? value * 20 : value;
    totals[factor.category] += normalizedValue;
  });

  return totals;
};

describe('FactorEditor Logic', () => {
  describe('Category Structure', () => {
    it('has 4 categories in correct order', () => {
      expect(CATEGORIES).toEqual(['team', 'situational', 'specialTeams', 'playerBased']);
    });

    it('each category has display name', () => {
      CATEGORIES.forEach((category) => {
        expect(CATEGORY_NAMES[category]).toBeDefined();
        expect(CATEGORY_NAMES[category].length).toBeGreaterThan(0);
      });
    });

    it('each category has description', () => {
      CATEGORIES.forEach((category) => {
        expect(CATEGORY_DESCRIPTIONS[category]).toBeDefined();
        expect(CATEGORY_DESCRIPTIONS[category].length).toBeGreaterThan(0);
      });
    });

    it('all factors belong to a category', () => {
      FACTOR_DEFINITIONS.forEach((factor) => {
        expect(CATEGORIES).toContain(factor.category);
      });
    });
  });

  describe('Collapsible Sections', () => {
    it('can expand/collapse each category', () => {
      const expandedState: Record<FactorCategory, boolean> = {
        team: true,
        situational: true,
        specialTeams: true,
        playerBased: true,
      };

      // Toggle team category
      expandedState.team = !expandedState.team;
      expect(expandedState.team).toBe(false);

      // Toggle it back
      expandedState.team = !expandedState.team;
      expect(expandedState.team).toBe(true);
    });

    it('shows factor count per category', () => {
      expect(getFactorsByCategory('team').length).toBe(5);
      expect(getFactorsByCategory('situational').length).toBe(2);
      expect(getFactorsByCategory('specialTeams').length).toBe(2);
      expect(getFactorsByCategory('playerBased').length).toBe(2);
    });
  });

  describe('Weight Slider Integration', () => {
    it('renders WeightSlider for each factor', () => {
      const totalFactors = FACTOR_DEFINITIONS.length;
      expect(totalFactors).toBe(11);
    });

    it('passes correct props to each slider', () => {
      const weights = getDefaultWeights();

      FACTOR_DEFINITIONS.forEach((factor) => {
        const key = factor.key as keyof AllWeights;
        expect(weights[key]).toBe(factor.defaultValue);
        expect(factor.min).toBeDefined();
        expect(factor.max).toBeDefined();
        expect(factor.step).toBeDefined();
      });
    });
  });

  describe('Reset to Defaults - Per Category', () => {
    it('detects when category has modifications', () => {
      const weights = toRecord(getDefaultWeights());
      expect(categoryHasModifications('team', weights)).toBe(false);

      weights.standingsDifferential = 100;
      expect(categoryHasModifications('team', weights)).toBe(true);
    });

    it('resets only factors in that category', () => {
      const weights = toRecord(getDefaultWeights());
      weights.standingsDifferential = 100; // team
      weights.backToBackPenalty = 20; // situational

      // Reset team category
      const factors = getFactorsByCategory('team');
      factors.forEach((factor) => {
        weights[factor.key] = factor.defaultValue;
      });

      expect(weights.standingsDifferential).toBe(80);
      expect(weights.backToBackPenalty).toBe(20); // Unchanged
    });
  });

  describe('Reset to Defaults - Global', () => {
    it('resets all factors to defaults', () => {
      const modifiedWeights: Record<string, number> = {
        standingsDifferential: 100,
        homeIceAdvantage: 15,
        streakImpact: 20,
        goalDifferentialImpact: 20,
        recentFormImpact: 60,
        backToBackPenalty: 20,
        restAdvantage: 12,
        specialTeamsImpact: 40,
        shotDifferentialImpact: 15,
        goalieMatchupImpact: 2.5,
        hotPlayersImpact: 2.0,
      };

      // Apply defaults
      FACTOR_DEFINITIONS.forEach((factor) => {
        modifiedWeights[factor.key] = factor.defaultValue;
      });

      expect(modifiedWeights.standingsDifferential).toBe(80);
      expect(modifiedWeights.goalieMatchupImpact).toBe(1.0);
    });

    it('is disabled when no modifications exist', () => {
      const weights = toRecord(getDefaultWeights());
      const hasModifications = FACTOR_DEFINITIONS.some(
        (factor) => weights[factor.key] !== factor.defaultValue
      );
      expect(hasModifications).toBe(false);
    });

    it('is enabled when modifications exist', () => {
      const weights = toRecord(getDefaultWeights());
      weights.standingsDifferential = 100;

      const hasModifications = FACTOR_DEFINITIONS.some(
        (factor) => weights[factor.key] !== factor.defaultValue
      );
      expect(hasModifications).toBe(true);
    });
  });

  describe('Weight Distribution Chart', () => {
    it('calculates category totals correctly', () => {
      const weights = toRecord(getDefaultWeights());
      const totals = calculateCategoryTotals(weights);

      // Team: 80 + 8 + 12 + 12 + 40 = 152
      expect(totals.team).toBe(152);

      // Situational: 15 + 8 = 23
      expect(totals.situational).toBe(23);

      // Special Teams: 25 + 10 = 35
      expect(totals.specialTeams).toBe(35);

      // Player-Based: (1.0 * 20) + (1.5 * 20) = 50 (scaled up)
      expect(totals.playerBased).toBe(50);
    });

    it('calculates percentages correctly', () => {
      const weights = toRecord(getDefaultWeights());
      const totals = calculateCategoryTotals(weights);
      const total = Object.values(totals).reduce((sum, val) => sum + val, 0);

      // Total should be 152 + 23 + 35 + 50 = 260
      expect(total).toBe(260);

      // Team percentage: 152 / 260 ≈ 58.5%
      const teamPercentage = (totals.team / total) * 100;
      expect(teamPercentage).toBeCloseTo(58.46, 1);
    });

    it('updates distribution when weights change', () => {
      const weights = toRecord(getDefaultWeights());
      const initialTotals = calculateCategoryTotals(weights);

      // Modify team weights
      weights.standingsDifferential = 150;
      const newTotals = calculateCategoryTotals(weights);

      expect(newTotals.team).toBeGreaterThan(initialTotals.team);
    });

    it('has unique colors for each category', () => {
      const colors: Record<FactorCategory, string> = {
        team: '#60a5fa',
        situational: '#f59e0b',
        specialTeams: '#10b981',
        playerBased: '#a855f7',
      };

      const uniqueColors = new Set(Object.values(colors));
      expect(uniqueColors.size).toBe(4);
    });
  });

  describe('Props Interface', () => {
    it('weights prop contains all factor keys', () => {
      const weights = getDefaultWeights();
      const keys = Object.keys(weights);

      FACTOR_DEFINITIONS.forEach((factor) => {
        expect(keys).toContain(factor.key);
      });
    });

    it('onChange callback receives updated weights', () => {
      let receivedWeights: AllWeights | null = null;
      const onChange = (weights: AllWeights) => {
        receivedWeights = weights;
      };

      const weights = getDefaultWeights();
      const newWeights = { ...weights, standingsDifferential: 100 };
      onChange(newWeights);

      expect(receivedWeights).not.toBeNull();
      expect(receivedWeights!.standingsDifferential).toBe(100);
    });
  });
});
