/**
 * Model Storage Service
 * Handles persistence of prediction models using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PredictionModel } from '../types/predictions';
import { CONFIDENCE_WEIGHTS, PLAYER_WEIGHTS } from '../utils/predictionUtils';

const STORAGE_KEY = 'puckiq_prediction_models';

// Classic model ID - used for identification
const CLASSIC_MODEL_ID = 'classic';

/**
 * Generate a unique ID for new models
 */
function generateModelId(): string {
  return `model_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create the default "PuckIQ Classic" model
 * Uses the existing CONFIDENCE_WEIGHTS and PLAYER_WEIGHTS values
 */
export function createDefaultModel(): PredictionModel {
  const now = new Date().toISOString();

  return {
    id: CLASSIC_MODEL_ID,
    name: 'PuckIQ Classic',
    createdAt: now,
    updatedAt: now,
    weights: { ...CONFIDENCE_WEIGHTS },
    playerWeights: {
      goalieMatchupImpact: PLAYER_WEIGHTS.goalieMatchupImpact,
      hotPlayersImpact: PLAYER_WEIGHTS.hotPlayersImpact,
    },
    isActive: true,
    isDefault: true,
  };
}

/**
 * Load all models from storage
 * If no models exist, creates and saves the Classic model
 */
export async function loadModels(): Promise<PredictionModel[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);

    if (!json) {
      // No models exist, create the Classic model
      const classicModel = createDefaultModel();
      await saveModelsToStorage([classicModel]);
      return [classicModel];
    }

    const models: PredictionModel[] = JSON.parse(json);

    // Ensure Classic model exists
    const hasClassic = models.some(m => m.isDefault);
    if (!hasClassic) {
      const classicModel = createDefaultModel();
      models.unshift(classicModel);
      await saveModelsToStorage(models);
    }

    // Ensure exactly one model is active
    const activeModels = models.filter(m => m.isActive);
    if (activeModels.length === 0) {
      // No active model, activate Classic
      const classicIndex = models.findIndex(m => m.isDefault);
      if (classicIndex >= 0) {
        models[classicIndex].isActive = true;
        await saveModelsToStorage(models);
      }
    } else if (activeModels.length > 1) {
      // Multiple active, keep only the first one
      let foundFirst = false;
      for (const model of models) {
        if (model.isActive) {
          if (foundFirst) {
            model.isActive = false;
          } else {
            foundFirst = true;
          }
        }
      }
      await saveModelsToStorage(models);
    }

    return models;
  } catch (error) {
    console.error('[MODEL_STORAGE] Error loading models:', error);
    // Return Classic model as fallback
    const classicModel = createDefaultModel();
    return [classicModel];
  }
}

/**
 * Internal function to save models array to storage
 */
async function saveModelsToStorage(models: PredictionModel[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(models));
}

/**
 * Save a model (create new or update existing)
 */
export async function saveModel(model: PredictionModel): Promise<PredictionModel> {
  try {
    const models = await loadModels();
    const now = new Date().toISOString();

    const existingIndex = models.findIndex(m => m.id === model.id);

    if (existingIndex >= 0) {
      // Update existing model
      models[existingIndex] = {
        ...model,
        updatedAt: now,
      };
    } else {
      // Create new model
      const newModel: PredictionModel = {
        ...model,
        id: model.id || generateModelId(),
        createdAt: now,
        updatedAt: now,
        isDefault: false, // Only Classic can be default
      };
      models.push(newModel);
      model = newModel;
    }

    await saveModelsToStorage(models);
    return models.find(m => m.id === model.id) || model;
  } catch (error) {
    console.error('[MODEL_STORAGE] Error saving model:', error);
    throw error;
  }
}

/**
 * Delete a model by ID
 * The Classic model cannot be deleted
 */
export async function deleteModel(id: string): Promise<boolean> {
  try {
    const models = await loadModels();
    const modelToDelete = models.find(m => m.id === id);

    // Cannot delete Classic model
    if (!modelToDelete) {
      console.warn('[MODEL_STORAGE] Model not found:', id);
      return false;
    }

    if (modelToDelete.isDefault) {
      console.warn('[MODEL_STORAGE] Cannot delete the Classic model');
      return false;
    }

    const filteredModels = models.filter(m => m.id !== id);

    // If we deleted the active model, activate Classic
    if (modelToDelete.isActive) {
      const classicIndex = filteredModels.findIndex(m => m.isDefault);
      if (classicIndex >= 0) {
        filteredModels[classicIndex].isActive = true;
      }
    }

    await saveModelsToStorage(filteredModels);
    return true;
  } catch (error) {
    console.error('[MODEL_STORAGE] Error deleting model:', error);
    throw error;
  }
}

/**
 * Get the currently active model
 * Returns Classic model if no active model is found
 */
export async function getActiveModel(): Promise<PredictionModel> {
  try {
    const models = await loadModels();
    const activeModel = models.find(m => m.isActive);

    if (activeModel) {
      return activeModel;
    }

    // Fallback to Classic
    const classicModel = models.find(m => m.isDefault);
    if (classicModel) {
      return classicModel;
    }

    // Ultimate fallback - create new Classic
    return createDefaultModel();
  } catch (error) {
    console.error('[MODEL_STORAGE] Error getting active model:', error);
    return createDefaultModel();
  }
}

/**
 * Set a model as the active model
 * Deactivates all other models
 */
export async function setActiveModel(id: string): Promise<boolean> {
  try {
    const models = await loadModels();
    const modelToActivate = models.find(m => m.id === id);

    if (!modelToActivate) {
      console.warn('[MODEL_STORAGE] Model not found:', id);
      return false;
    }

    // Deactivate all models, then activate the selected one
    for (const model of models) {
      model.isActive = model.id === id;
    }

    await saveModelsToStorage(models);
    return true;
  } catch (error) {
    console.error('[MODEL_STORAGE] Error setting active model:', error);
    throw error;
  }
}

/**
 * Create a duplicate of an existing model with a new name
 */
export async function duplicateModel(id: string, newName: string): Promise<PredictionModel | null> {
  try {
    const models = await loadModels();
    const sourcModel = models.find(m => m.id === id);

    if (!sourcModel) {
      console.warn('[MODEL_STORAGE] Model not found:', id);
      return null;
    }

    const now = new Date().toISOString();
    const newModel: PredictionModel = {
      id: generateModelId(),
      name: newName,
      createdAt: now,
      updatedAt: now,
      weights: { ...sourcModel.weights },
      playerWeights: { ...sourcModel.playerWeights },
      isActive: false,
      isDefault: false,
    };

    return await saveModel(newModel);
  } catch (error) {
    console.error('[MODEL_STORAGE] Error duplicating model:', error);
    throw error;
  }
}

/**
 * Check if a model is the Classic (default) model
 */
export function isClassicModel(model: PredictionModel): boolean {
  return model.isDefault || model.id === CLASSIC_MODEL_ID;
}
