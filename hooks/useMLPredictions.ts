/**
 * useMLPredictions Hook
 * React hook for fetching ML predictions from Supabase.
 * Wraps the mlPredictions service with loading/error state management.
 *
 * Usage:
 *   const { predictions, activeModel, isLoading } = useMLPredictions('2026-02-08');
 *   const gamePrediction = predictions[gameId]; // Get prediction for a specific game
 */

import { useState, useEffect, useCallback } from 'react';
import {
  MLPrediction,
  MLModelMetadata,
  getMLPredictions,
  getActiveMLModel,
} from '../services/mlPredictions';

interface UseMLPredictionsResult {
  predictions: Record<number, MLPrediction>;
  activeModel: MLModelMetadata | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMLPredictions(gameDate: string | null): UseMLPredictionsResult {
  const [predictions, setPredictions] = useState<Record<number, MLPrediction>>({});
  const [activeModel, setActiveModel] = useState<MLModelMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!gameDate) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch predictions and model metadata in parallel
      const [preds, model] = await Promise.all([
        getMLPredictions(gameDate),
        getActiveMLModel(),
      ]);

      setPredictions(preds);
      setActiveModel(model);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load ML predictions';
      setError(message);
      console.warn('[useMLPredictions]', message);
    } finally {
      setIsLoading(false);
    }
  }, [gameDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { predictions, activeModel, isLoading, error, refresh: fetchData };
}
