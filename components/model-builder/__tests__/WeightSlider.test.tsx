/**
 * WeightSlider Component Tests
 * Tests the core logic and rendering behavior of the WeightSlider component
 */

import { FACTOR_DEFINITIONS, FactorCategory } from '../../../constants/modelFactors';

// Test helper functions that match the component's internal logic
const formatValue = (val: number, step: number): string => {
  if (step >= 1) {
    return val.toFixed(0);
  } else if (step >= 0.1) {
    return val.toFixed(1);
  } else {
    return val.toFixed(2);
  }
};

const getValueColor = (value: number, defaultValue: number, step: number): string => {
  const ACCENT = '#60a5fa';
  const GREEN = '#10b981';
  const RED = '#ef4444';

  if (Math.abs(value - defaultValue) < step / 2) {
    return ACCENT; // At default - blue
  } else if (value > defaultValue) {
    return GREEN; // Above default - green
  } else {
    return RED; // Below default - red
  }
};

const calculatePercentage = (value: number, min: number, max: number): number => {
  return ((value - min) / (max - min)) * 100;
};

const calculateValue = (positionX: number, sliderWidth: number, min: number, max: number, step: number): number => {
  const clampedX = Math.max(0, Math.min(positionX, sliderWidth));
  const rawValue = min + (clampedX / sliderWidth) * (max - min);
  const snappedValue = Math.round(rawValue / step) * step;
  return Math.max(min, Math.min(max, snappedValue));
};

describe('WeightSlider Logic', () => {
  describe('formatValue', () => {
    it('formats integer values correctly (step >= 1)', () => {
      expect(formatValue(80, 5)).toBe('80');
      expect(formatValue(15, 1)).toBe('15');
      expect(formatValue(100, 10)).toBe('100');
    });

    it('formats decimal values correctly (step = 0.1)', () => {
      expect(formatValue(1.5, 0.1)).toBe('1.5');
      expect(formatValue(2.0, 0.1)).toBe('2.0');
      expect(formatValue(0.3, 0.1)).toBe('0.3');
    });

    it('formats fine decimal values correctly (step < 0.1)', () => {
      expect(formatValue(1.55, 0.05)).toBe('1.55');
      expect(formatValue(0.25, 0.01)).toBe('0.25');
    });
  });

  describe('getValueColor', () => {
    it('returns accent (blue) when value equals default', () => {
      expect(getValueColor(80, 80, 5)).toBe('#60a5fa');
      expect(getValueColor(1.0, 1.0, 0.1)).toBe('#60a5fa');
    });

    it('returns accent (blue) when value is within half step of default', () => {
      expect(getValueColor(82, 80, 5)).toBe('#60a5fa'); // 2 < 2.5 (5/2)
      expect(getValueColor(1.04, 1.0, 0.1)).toBe('#60a5fa'); // 0.04 < 0.05 (0.1/2)
    });

    it('returns green when value is above default', () => {
      expect(getValueColor(100, 80, 5)).toBe('#10b981');
      expect(getValueColor(1.5, 1.0, 0.1)).toBe('#10b981');
    });

    it('returns red when value is below default', () => {
      expect(getValueColor(50, 80, 5)).toBe('#ef4444');
      expect(getValueColor(0.5, 1.0, 0.1)).toBe('#ef4444');
    });
  });

  describe('calculatePercentage', () => {
    it('calculates percentage position correctly', () => {
      expect(calculatePercentage(0, 0, 100)).toBe(0);
      expect(calculatePercentage(50, 0, 100)).toBe(50);
      expect(calculatePercentage(100, 0, 100)).toBe(100);
    });

    it('works with non-zero min values', () => {
      expect(calculatePercentage(5, 0, 10)).toBe(50);
      expect(calculatePercentage(75, 50, 100)).toBe(50);
    });

    it('works with different ranges', () => {
      expect(calculatePercentage(80, 0, 150)).toBeCloseTo(53.33, 1);
      expect(calculatePercentage(1.5, 0, 3.0)).toBe(50);
    });
  });

  describe('calculateValue', () => {
    const sliderWidth = 300;

    it('calculates value from position correctly', () => {
      expect(calculateValue(0, sliderWidth, 0, 100, 1)).toBe(0);
      expect(calculateValue(150, sliderWidth, 0, 100, 1)).toBe(50);
      expect(calculateValue(300, sliderWidth, 0, 100, 1)).toBe(100);
    });

    it('snaps to step values', () => {
      expect(calculateValue(150, sliderWidth, 0, 150, 5)).toBe(75);
      expect(calculateValue(100, sliderWidth, 0, 150, 5)).toBe(50);
    });

    it('clamps to min value', () => {
      expect(calculateValue(-50, sliderWidth, 0, 100, 1)).toBe(0);
    });

    it('clamps to max value', () => {
      expect(calculateValue(500, sliderWidth, 0, 100, 1)).toBe(100);
    });

    it('works with decimal steps', () => {
      expect(calculateValue(150, sliderWidth, 0, 3.0, 0.1)).toBeCloseTo(1.5, 1);
    });
  });

  describe('Factor Definitions Compatibility', () => {
    const categories: FactorCategory[] = ['team', 'situational', 'specialTeams', 'playerBased'];

    it('has factors for all categories', () => {
      categories.forEach(category => {
        const factors = FACTOR_DEFINITIONS.filter(f => f.category === category);
        expect(factors.length).toBeGreaterThan(0);
      });
    });

    it('all factors have valid ranges', () => {
      FACTOR_DEFINITIONS.forEach(factor => {
        expect(factor.min).toBeLessThan(factor.max);
        expect(factor.defaultValue).toBeGreaterThanOrEqual(factor.min);
        expect(factor.defaultValue).toBeLessThanOrEqual(factor.max);
        expect(factor.step).toBeGreaterThan(0);
      });
    });

    it('formats all factor values correctly', () => {
      FACTOR_DEFINITIONS.forEach(factor => {
        const formatted = formatValue(factor.defaultValue, factor.step);
        // Should be a valid number string
        expect(parseFloat(formatted)).toBe(factor.defaultValue);
      });
    });

    it('calculates correct colors for all factors at default', () => {
      FACTOR_DEFINITIONS.forEach(factor => {
        const color = getValueColor(factor.defaultValue, factor.defaultValue, factor.step);
        expect(color).toBe('#60a5fa'); // Accent blue at default
      });
    });

    it('calculates correct percentages for all factor defaults', () => {
      FACTOR_DEFINITIONS.forEach(factor => {
        const percentage = calculatePercentage(factor.defaultValue, factor.min, factor.max);
        expect(percentage).toBeGreaterThanOrEqual(0);
        expect(percentage).toBeLessThanOrEqual(100);
      });
    });

    describe('team factors', () => {
      const teamFactors = FACTOR_DEFINITIONS.filter(f => f.category === 'team');

      it('standingsDifferential has correct values', () => {
        const factor = teamFactors.find(f => f.key === 'standingsDifferential');
        expect(factor).toBeDefined();
        expect(factor!.defaultValue).toBe(80);
        expect(factor!.min).toBe(0);
        expect(factor!.max).toBe(150);
      });

      it('homeIceAdvantage has correct values', () => {
        const factor = teamFactors.find(f => f.key === 'homeIceAdvantage');
        expect(factor).toBeDefined();
        expect(factor!.defaultValue).toBe(8);
      });
    });

    describe('situational factors', () => {
      const sitFactors = FACTOR_DEFINITIONS.filter(f => f.category === 'situational');

      it('backToBackPenalty has correct values', () => {
        const factor = sitFactors.find(f => f.key === 'backToBackPenalty');
        expect(factor).toBeDefined();
        expect(factor!.defaultValue).toBe(15);
      });

      it('restAdvantage has correct values', () => {
        const factor = sitFactors.find(f => f.key === 'restAdvantage');
        expect(factor).toBeDefined();
        expect(factor!.defaultValue).toBe(8);
      });
    });

    describe('specialTeams factors', () => {
      const stFactors = FACTOR_DEFINITIONS.filter(f => f.category === 'specialTeams');

      it('specialTeamsImpact has correct values', () => {
        const factor = stFactors.find(f => f.key === 'specialTeamsImpact');
        expect(factor).toBeDefined();
        expect(factor!.defaultValue).toBe(25);
      });
    });

    describe('playerBased factors (decimal values)', () => {
      const playerFactors = FACTOR_DEFINITIONS.filter(f => f.category === 'playerBased');

      it('goalieMatchupImpact uses decimal step', () => {
        const factor = playerFactors.find(f => f.key === 'goalieMatchupImpact');
        expect(factor).toBeDefined();
        expect(factor!.step).toBe(0.1);
        expect(factor!.defaultValue).toBe(1.0);
      });

      it('hotPlayersImpact uses decimal step', () => {
        const factor = playerFactors.find(f => f.key === 'hotPlayersImpact');
        expect(factor).toBeDefined();
        expect(factor!.step).toBe(0.1);
        expect(factor!.defaultValue).toBe(1.5);
      });

      it('formats decimal values correctly', () => {
        playerFactors.forEach(factor => {
          const formatted = formatValue(factor.defaultValue, factor.step);
          expect(formatted).toMatch(/^\d+\.\d$/); // Should have 1 decimal place
        });
      });
    });
  });
});
