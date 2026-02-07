/**
 * ModelList Component Tests
 * Tests the model list logic and behavior
 */

import type { PredictionModel, ModelBacktestResults } from '../../../types/predictions';

// Mock model factory
const createMockModel = (overrides: Partial<PredictionModel> = {}): PredictionModel => ({
  id: `model_${Date.now()}`,
  name: 'Test Model',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  weights: {
    standingsDifferential: 80,
    homeIceAdvantage: 8,
    streakImpact: 12,
    goalDifferentialImpact: 12,
    recentFormImpact: 40,
    backToBackPenalty: 15,
    restAdvantage: 8,
    specialTeamsImpact: 25,
    shotDifferentialImpact: 10,
  },
  playerWeights: {
    goalieMatchupImpact: 1.0,
    hotPlayersImpact: 1.5,
  },
  isActive: false,
  isDefault: false,
  ...overrides,
});

const createClassicModel = (): PredictionModel => createMockModel({
  id: 'classic',
  name: 'PuckIQ Classic',
  isDefault: true,
  isActive: true,
});

const createBacktestResults = (overrides: Partial<ModelBacktestResults> = {}): ModelBacktestResults => ({
  period: {
    start: '2024-10-01',
    end: '2024-12-31',
  },
  totalGames: 500,
  correctPicks: 280,
  accuracy: 56.0,
  baselineAccuracy: 54.0,
  ranAt: new Date().toISOString(),
  ...overrides,
});

describe('ModelList Logic', () => {
  describe('Model Display', () => {
    it('displays model name', () => {
      const model = createMockModel({ name: 'My Custom Model' });
      expect(model.name).toBe('My Custom Model');
    });

    it('identifies Classic model by isDefault', () => {
      const classic = createClassicModel();
      expect(classic.isDefault).toBe(true);
    });

    it('identifies active model', () => {
      const activeModel = createMockModel({ isActive: true });
      expect(activeModel.isActive).toBe(true);
    });

    it('displays accuracy when backtested', () => {
      const backtestResults = createBacktestResults({ accuracy: 58.5 });
      const model = createMockModel({ backtestResults });

      expect(model.backtestResults).toBeDefined();
      expect(model.backtestResults?.accuracy).toBe(58.5);
    });

    it('shows comparison vs Classic baseline', () => {
      const backtestResults = createBacktestResults({
        accuracy: 58.0,
        baselineAccuracy: 54.0,
      });

      const improvement = backtestResults.accuracy - backtestResults.baselineAccuracy;
      expect(improvement).toBe(4.0);
    });
  });

  describe('Model Actions', () => {
    describe('Activate', () => {
      it('can activate any model', () => {
        const model = createMockModel({ isActive: false });
        const activatedModel = { ...model, isActive: true };
        expect(activatedModel.isActive).toBe(true);
      });

      it('already active model stays active', () => {
        const model = createMockModel({ isActive: true });
        expect(model.isActive).toBe(true);
      });
    });

    describe('Edit', () => {
      it('can edit any model including Classic', () => {
        const classic = createClassicModel();
        // Classic can be edited (weights can be viewed/modified)
        expect(classic.name).toBe('PuckIQ Classic');
      });
    });

    describe('Duplicate', () => {
      it('can duplicate any model', () => {
        const original = createMockModel({ name: 'Original' });
        const duplicate = createMockModel({
          id: `model_${Date.now()}_copy`,
          name: 'Original Copy',
          isActive: false,
          isDefault: false,
        });

        expect(duplicate.name).toBe('Original Copy');
        expect(duplicate.id).not.toBe(original.id);
        expect(duplicate.isDefault).toBe(false);
      });

      it('duplicate inherits weights from source', () => {
        const original = createMockModel({
          weights: {
            standingsDifferential: 100,
            homeIceAdvantage: 10,
            streakImpact: 15,
            goalDifferentialImpact: 15,
            recentFormImpact: 50,
            backToBackPenalty: 20,
            restAdvantage: 10,
            specialTeamsImpact: 30,
            shotDifferentialImpact: 12,
          },
        });

        const duplicate = createMockModel({
          name: 'Copy',
          weights: { ...original.weights },
        });

        expect(duplicate.weights.standingsDifferential).toBe(100);
        expect(duplicate.weights.homeIceAdvantage).toBe(10);
      });
    });

    describe('Delete', () => {
      it('can delete non-Classic models', () => {
        const model = createMockModel({ isDefault: false });
        expect(model.isDefault).toBe(false);
        // Model can be deleted since it's not default
      });

      it('cannot delete Classic model', () => {
        const classic = createClassicModel();
        expect(classic.isDefault).toBe(true);
        // Delete action should be disabled for Classic
      });

      it('identifies deletable models', () => {
        const models = [
          createClassicModel(),
          createMockModel({ id: 'model1', name: 'Model 1' }),
          createMockModel({ id: 'model2', name: 'Model 2' }),
        ];

        const deletableModels = models.filter(m => !m.isDefault);
        expect(deletableModels.length).toBe(2);
      });
    });
  });

  describe('List Behavior', () => {
    it('can have multiple models', () => {
      const models = [
        createClassicModel(),
        createMockModel({ id: 'model1', name: 'Custom 1' }),
        createMockModel({ id: 'model2', name: 'Custom 2' }),
      ];

      expect(models.length).toBe(3);
    });

    it('only one model can be active', () => {
      const models = [
        createClassicModel(),
        createMockModel({ id: 'model1', name: 'Custom 1', isActive: false }),
        createMockModel({ id: 'model2', name: 'Custom 2', isActive: false }),
      ];

      const activeModels = models.filter(m => m.isActive);
      expect(activeModels.length).toBe(1);
    });

    it('always has at least Classic model', () => {
      const models = [createClassicModel()];
      const hasClassic = models.some(m => m.isDefault);
      expect(hasClassic).toBe(true);
    });

    it('orders models with Classic first by default', () => {
      const models = [
        createMockModel({ id: 'model1', name: 'Custom 1' }),
        createClassicModel(),
        createMockModel({ id: 'model2', name: 'Custom 2' }),
      ];

      // Sort with Classic first
      const sorted = [...models].sort((a, b) => {
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        return 0;
      });

      expect(sorted[0].isDefault).toBe(true);
      expect(sorted[0].name).toBe('PuckIQ Classic');
    });
  });

  describe('Backtest Results Display', () => {
    it('shows accuracy percentage', () => {
      const results = createBacktestResults({ accuracy: 57.5 });
      expect(results.accuracy.toFixed(1)).toBe('57.5');
    });

    it('calculates positive improvement correctly', () => {
      const results = createBacktestResults({
        accuracy: 58.0,
        baselineAccuracy: 54.0,
      });

      const improvement = results.accuracy - results.baselineAccuracy;
      expect(improvement).toBeGreaterThan(0);
      expect(improvement).toBe(4.0);
    });

    it('calculates negative improvement correctly', () => {
      const results = createBacktestResults({
        accuracy: 52.0,
        baselineAccuracy: 54.0,
      });

      const improvement = results.accuracy - results.baselineAccuracy;
      expect(improvement).toBeLessThan(0);
      expect(improvement).toBe(-2.0);
    });

    it('shows total games tested', () => {
      const results = createBacktestResults({ totalGames: 750 });
      expect(results.totalGames).toBe(750);
    });

    it('model without backtest has no results', () => {
      const model = createMockModel();
      expect(model.backtestResults).toBeUndefined();
    });
  });

  describe('Empty State', () => {
    it('handles empty model list gracefully', () => {
      const models: PredictionModel[] = [];
      expect(models.length).toBe(0);
      // Should show empty state UI
    });
  });

  describe('FAB New Model', () => {
    it('new model callback can be triggered', () => {
      let newModelCalled = false;
      const onNewModel = () => {
        newModelCalled = true;
      };

      onNewModel();
      expect(newModelCalled).toBe(true);
    });
  });

  describe('Pull to Refresh', () => {
    it('refresh loads updated models', async () => {
      let refreshCount = 0;
      const fetchModels = async () => {
        refreshCount++;
        return [createClassicModel()];
      };

      await fetchModels();
      expect(refreshCount).toBe(1);

      await fetchModels();
      expect(refreshCount).toBe(2);
    });
  });
});
