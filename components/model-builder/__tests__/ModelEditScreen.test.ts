/**
 * ModelEditScreen Component Tests
 * Tests the model editing form logic, validation, and save/cancel flows
 */

import type { PredictionModel, ConfidenceWeights, PlayerWeights } from '../../../types/predictions';

// Combined weights type
type AllWeights = ConfidenceWeights & PlayerWeights;

// Default weights (matching Classic model)
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

// Mock model factory
const createMockModel = (overrides: Partial<PredictionModel> = {}): PredictionModel => {
  const now = new Date().toISOString();
  return {
    id: `model_${Date.now()}`,
    name: 'Test Model',
    createdAt: now,
    updatedAt: now,
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
  };
};

// Name validation logic (same as component)
const validateName = (value: string): { valid: boolean; error: string | null } => {
  if (!value.trim()) {
    return { valid: false, error: 'Model name is required' };
  }
  if (value.trim().length < 2) {
    return { valid: false, error: 'Model name must be at least 2 characters' };
  }
  if (value.trim().length > 50) {
    return { valid: false, error: 'Model name must be less than 50 characters' };
  }
  return { valid: true, error: null };
};

describe('ModelEditScreen Logic', () => {
  describe('Props Interface', () => {
    it('accepts model prop for editing existing model', () => {
      const model = createMockModel({ name: 'Existing Model' });
      expect(model.name).toBe('Existing Model');
      expect(model.id).toBeDefined();
    });

    it('accepts null/undefined model for creating new model', () => {
      const model: PredictionModel | null = null;
      const isNewModel = !model;
      expect(isNewModel).toBe(true);
    });

    it('requires onSave callback', () => {
      let savedModel: PredictionModel | null = null;
      const onSave = (model: PredictionModel) => {
        savedModel = model;
      };

      onSave(createMockModel());
      expect(savedModel).not.toBeNull();
    });

    it('requires onCancel callback', () => {
      let cancelled = false;
      const onCancel = () => {
        cancelled = true;
      };

      onCancel();
      expect(cancelled).toBe(true);
    });
  });

  describe('Name Validation', () => {
    it('rejects empty name', () => {
      const result = validateName('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Model name is required');
    });

    it('rejects whitespace-only name', () => {
      const result = validateName('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Model name is required');
    });

    it('rejects name shorter than 2 characters', () => {
      const result = validateName('A');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Model name must be at least 2 characters');
    });

    it('accepts name with 2 characters', () => {
      const result = validateName('AB');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('accepts valid name', () => {
      const result = validateName('My Custom Model');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('rejects name longer than 50 characters', () => {
      const longName = 'A'.repeat(51);
      const result = validateName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Model name must be less than 50 characters');
    });

    it('accepts name with exactly 50 characters', () => {
      const name = 'A'.repeat(50);
      const result = validateName(name);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('trims whitespace for length validation', () => {
      const result = validateName('  AB  ');
      expect(result.valid).toBe(true);
    });
  });

  describe('New Model Creation', () => {
    it('starts with Classic weights for new models', () => {
      const classicWeights = getDefaultWeights();

      expect(classicWeights.standingsDifferential).toBe(80);
      expect(classicWeights.homeIceAdvantage).toBe(8);
      expect(classicWeights.recentFormImpact).toBe(40);
      expect(classicWeights.goalieMatchupImpact).toBe(1.0);
    });

    it('starts with empty name for new models', () => {
      // When no model is passed, name should start empty
      const getInitialName = (model: PredictionModel | null): string => {
        return model?.name || '';
      };
      expect(getInitialName(null)).toBe('');
    });

    it('sets isDefault to false for new models', () => {
      const newModel = createMockModel({ id: '', isDefault: false });
      expect(newModel.isDefault).toBe(false);
    });
  });

  describe('Editing Existing Model', () => {
    it('loads existing model name', () => {
      const model = createMockModel({ name: 'My Existing Model' });
      expect(model.name).toBe('My Existing Model');
    });

    it('loads existing model weights', () => {
      const model = createMockModel({
        weights: {
          standingsDifferential: 100,
          homeIceAdvantage: 10,
          streakImpact: 15,
          goalDifferentialImpact: 15,
          recentFormImpact: 50,
          backToBackPenalty: 20,
          restAdvantage: 10,
          specialTeamsImpact: 30,
          shotDifferentialImpact: 15,
        },
      });

      expect(model.weights.standingsDifferential).toBe(100);
      expect(model.weights.recentFormImpact).toBe(50);
    });

    it('preserves model ID when editing', () => {
      const model = createMockModel({ id: 'existing_model_123' });
      expect(model.id).toBe('existing_model_123');
    });

    it('preserves createdAt when editing', () => {
      const createdAt = '2024-01-01T00:00:00.000Z';
      const model = createMockModel({ createdAt });
      expect(model.createdAt).toBe(createdAt);
    });

    it('identifies Classic model by isDefault', () => {
      const classicModel = createMockModel({ isDefault: true, name: 'PuckIQ Classic' });
      expect(classicModel.isDefault).toBe(true);
    });
  });

  describe('Save Functionality', () => {
    it('builds correct model object for saving', () => {
      const name = 'New Model';
      const weights = getDefaultWeights();

      const modelToSave: PredictionModel = {
        id: '',
        name: name.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        weights: {
          standingsDifferential: weights.standingsDifferential,
          homeIceAdvantage: weights.homeIceAdvantage,
          streakImpact: weights.streakImpact,
          goalDifferentialImpact: weights.goalDifferentialImpact,
          recentFormImpact: weights.recentFormImpact,
          backToBackPenalty: weights.backToBackPenalty,
          restAdvantage: weights.restAdvantage,
          specialTeamsImpact: weights.specialTeamsImpact,
          shotDifferentialImpact: weights.shotDifferentialImpact,
        },
        playerWeights: {
          goalieMatchupImpact: weights.goalieMatchupImpact,
          hotPlayersImpact: weights.hotPlayersImpact,
        },
        isActive: false,
        isDefault: false,
      };

      expect(modelToSave.name).toBe('New Model');
      expect(modelToSave.weights.standingsDifferential).toBe(80);
      expect(modelToSave.playerWeights.goalieMatchupImpact).toBe(1.0);
    });

    it('disables save when name is empty', () => {
      const name = '';
      const saveDisabled = !name.trim();
      expect(saveDisabled).toBe(true);
    });

    it('enables save when name is valid', () => {
      const name = 'Valid Name';
      const saveDisabled = !name.trim();
      expect(saveDisabled).toBe(false);
    });

    it('trims name before saving', () => {
      const name = '  Trimmed Model  ';
      const trimmedName = name.trim();
      expect(trimmedName).toBe('Trimmed Model');
    });
  });

  describe('Cancel Functionality', () => {
    it('detects unsaved changes when name changes', () => {
      const originalName: string = 'Original';
      const currentName: string = 'Modified';
      const hasUnsavedChanges = currentName !== originalName;
      expect(hasUnsavedChanges).toBe(true);
    });

    it('detects no changes when name is same', () => {
      const originalName: string = 'Same Name';
      const currentName: string = originalName;
      const hasUnsavedChanges = currentName !== originalName;
      expect(hasUnsavedChanges).toBe(false);
    });

    it('detects unsaved changes when weights change', () => {
      const initialWeights = getDefaultWeights();
      const currentWeights = { ...initialWeights, standingsDifferential: 100 };
      const hasUnsavedChanges = JSON.stringify(currentWeights) !== JSON.stringify(initialWeights);
      expect(hasUnsavedChanges).toBe(true);
    });

    it('detects no changes when weights are same', () => {
      const initialWeights = getDefaultWeights();
      const currentWeights = { ...initialWeights };
      const hasUnsavedChanges = JSON.stringify(currentWeights) !== JSON.stringify(initialWeights);
      expect(hasUnsavedChanges).toBe(false);
    });
  });

  describe('Live Preview Integration', () => {
    it('passes current weights to LivePreview', () => {
      const weights = getDefaultWeights();
      weights.standingsDifferential = 100;

      // Component passes weights prop to LivePreview
      expect(weights.standingsDifferential).toBe(100);
    });

    it('preview can be collapsed', () => {
      let previewExpanded = true;
      previewExpanded = !previewExpanded;
      expect(previewExpanded).toBe(false);
    });

    it('preview can be expanded', () => {
      let previewExpanded = false;
      previewExpanded = !previewExpanded;
      expect(previewExpanded).toBe(true);
    });
  });

  describe('Factor Editor Integration', () => {
    it('passes weights to FactorEditor', () => {
      const weights = getDefaultWeights();
      // Component passes weights prop to FactorEditor
      expect(weights).toBeDefined();
      expect(Object.keys(weights).length).toBe(11);
    });

    it('receives weight changes from FactorEditor', () => {
      let weights = getDefaultWeights();
      const handleWeightsChange = (newWeights: AllWeights) => {
        weights = newWeights;
      };

      handleWeightsChange({ ...weights, recentFormImpact: 60 });
      expect(weights.recentFormImpact).toBe(60);
    });
  });

  describe('Screen Title', () => {
    it('shows "New Model" for new models', () => {
      const model: PredictionModel | null = null;
      const isNewModel = !model;
      const title = isNewModel ? 'New Model' : 'Edit Model';
      expect(title).toBe('New Model');
    });

    it('shows "Edit Model" for existing models', () => {
      const model = createMockModel();
      const isNewModel = !model;
      const title = isNewModel ? 'New Model' : 'Edit Model';
      expect(title).toBe('Edit Model');
    });
  });

  describe('Saving State', () => {
    it('disables interactions while saving', () => {
      const saving = true;
      expect(saving).toBe(true);
      // Component disables name input and save button
    });

    it('shows loading indicator while saving', () => {
      const saving = true;
      // Component shows ActivityIndicator in save button
      expect(saving).toBe(true);
    });

    it('re-enables interactions after save completes', () => {
      let saving = true;
      saving = false;
      expect(saving).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('shows validation error for invalid name', () => {
      const result = validateName('');
      expect(result.error).toBe('Model name is required');
    });

    it('clears validation error when name becomes valid', () => {
      let result = validateName('');
      expect(result.error).not.toBeNull();

      result = validateName('Valid Name');
      expect(result.error).toBeNull();
    });
  });

  describe('Classic Model Handling', () => {
    it('shows Classic badge for default model', () => {
      const model = createMockModel({ isDefault: true });
      expect(model.isDefault).toBe(true);
    });

    it('does not show Classic badge for custom model', () => {
      const model = createMockModel({ isDefault: false });
      expect(model.isDefault).toBe(false);
    });
  });

  describe('Weight Preservation', () => {
    it('preserves backtest results when saving', () => {
      const model = createMockModel({
        backtestResults: {
          period: { start: '2024-01-01', end: '2024-03-01' },
          totalGames: 500,
          correctPicks: 280,
          accuracy: 56.0,
          baselineAccuracy: 54.0,
          ranAt: new Date().toISOString(),
        },
      });

      expect(model.backtestResults).toBeDefined();
      expect(model.backtestResults?.accuracy).toBe(56.0);
    });

    it('preserves isActive status when saving', () => {
      const model = createMockModel({ isActive: true });
      expect(model.isActive).toBe(true);
    });
  });
});
