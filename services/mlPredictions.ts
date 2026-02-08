/**
 * ML Predictions Service
 * Reads machine learning predictions from Supabase ml_predictions and ml_model_metadata tables.
 * The ML pipeline writes predictions server-side; this service is read-only.
 */

import { supabase } from '../lib/supabase';

// ============================================
// Types for ML prediction data from Supabase
// ============================================

export interface MLPrediction {
  game_id: number;
  game_date: string;
  model_type: string;
  model_version: string;
  home_win_prob: number | null;
  away_win_prob: number | null;
  predicted_winner: string | null;
  confidence: string | null;  // 'high' | 'medium' | 'low'
  predicted_spread: number | null;
  predicted_total: number | null;
  player_predictions: PlayerPrediction[] | null;
  top_factors: TopFactor[] | null;
  data_quality: string;  // 'fresh' | 'stale'
  predicted_at: string;
}

export interface PlayerPrediction {
  player_id: number;
  name: string;
  pred_goals: number;
  pred_assists: number;
  pred_points: number;
}

export interface TopFactor {
  feature: string;
  value: number;
  impact: number;
}

export interface MLModelMetadata {
  model_type: string;
  model_version: string;
  is_active: boolean;
  val_brier_score: number | null;
  val_accuracy: number | null;
  prod_accuracy_7d: number | null;
  prod_accuracy_30d: number | null;
  prod_accuracy_season: number | null;
  promoted_at: string | null;
  created_at: string;
}

// ============================================
// Service Functions
// ============================================

/**
 * Fetch ML predictions for a specific date.
 * Returns predictions keyed by game_id for easy lookup.
 */
export async function getMLPredictions(gameDate: string): Promise<Record<number, MLPrediction>> {
  try {
    const { data, error } = await supabase
      .from('ml_predictions')
      .select('*')
      .eq('game_date', gameDate)
      .eq('model_type', 'game_winner');  // Primary model type for game cards

    if (error || !data) {
      console.warn('[ML Predictions] Supabase query failed:', error?.message);
      return {};
    }

    // Key by game_id for O(1) lookup when rendering game cards
    const byGameId: Record<number, MLPrediction> = {};
    for (const pred of data) {
      byGameId[pred.game_id] = pred;
    }
    return byGameId;
  } catch (err) {
    console.warn('[ML Predictions] Error fetching predictions:', err);
    return {};
  }
}

/**
 * Fetch all prediction types for a specific game (winner, spread, totals, player props).
 * Used in game detail view.
 */
export async function getMLPredictionsForGame(gameId: number): Promise<MLPrediction[]> {
  try {
    const { data, error } = await supabase
      .from('ml_predictions')
      .select('*')
      .eq('game_id', gameId)
      .order('model_type');

    if (error || !data) {
      console.warn('[ML Predictions] Game query failed:', error?.message);
      return [];
    }
    return data;
  } catch (err) {
    console.warn('[ML Predictions] Error fetching game predictions:', err);
    return [];
  }
}

/**
 * Get the active ML model metadata.
 * Returns null if no ML model is active.
 */
export async function getActiveMLModel(): Promise<MLModelMetadata | null> {
  try {
    const { data, error } = await supabase
      .from('ml_model_metadata')
      .select('*')
      .eq('model_type', 'game_winner')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[ML Predictions] Error fetching active model:', err);
    return null;
  }
}
