-- ============================================================
-- ML Prediction Pipeline Tables
-- Migration: 20260209000000
--
-- Adds 4 tables for the ML prediction system:
--   1. ml_predictions        — Daily game predictions
--   2. ml_prediction_scores  — Prediction accuracy log
--   3. ml_model_metadata     — Model version tracking
--   4. ml_model_evaluations  — Monthly comprehensive evaluations
--
-- RLS: Public SELECT only. No INSERT/UPDATE/DELETE policies.
-- The service_role key (used by the ML pipeline in GitHub Actions)
-- bypasses RLS entirely, so writes still work for authorized
-- server-side operations.
-- ============================================================

-- ============================================
-- 1. ML_PREDICTIONS — Daily game predictions
-- ============================================
CREATE TABLE IF NOT EXISTS ml_predictions (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL,
  game_date DATE NOT NULL,
  model_type TEXT NOT NULL,                     -- 'game_winner', 'spread', 'totals', 'player_props'
  model_version TEXT NOT NULL,                  -- date trained, e.g. '2026-02-10'
  home_win_prob REAL,
  away_win_prob REAL,
  predicted_winner TEXT,
  confidence TEXT,                              -- 'high', 'medium', 'low'
  predicted_spread REAL,
  predicted_total REAL,
  player_predictions JSONB,                    -- [{player_id, name, pred_goals, pred_assists, pred_points}]
  top_factors JSONB,                           -- [{feature, value, impact}]
  data_quality TEXT DEFAULT 'fresh',           -- 'fresh' or 'stale'
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, model_type, model_version)
);

CREATE INDEX IF NOT EXISTS idx_mlp_game_date ON ml_predictions (game_date);
CREATE INDEX IF NOT EXISTS idx_mlp_game ON ml_predictions (game_id);
CREATE INDEX IF NOT EXISTS idx_mlp_model_type ON ml_predictions (model_type);

ALTER TABLE ml_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mlp_public_read" ON ml_predictions FOR SELECT USING (true);

-- ============================================
-- 2. ML_PREDICTION_SCORES — Prediction accuracy log
-- ============================================
CREATE TABLE IF NOT EXISTS ml_prediction_scores (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL,
  game_date DATE NOT NULL,
  model_type TEXT NOT NULL,
  predicted_winner TEXT,
  actual_winner TEXT,
  was_correct BOOLEAN,
  home_win_prob REAL,
  predicted_spread REAL,
  actual_spread REAL,
  spread_error REAL,
  predicted_total REAL,
  actual_total REAL,
  total_error REAL,
  player_scores JSONB,
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, model_type)
);

CREATE INDEX IF NOT EXISTS idx_mlps_game_date ON ml_prediction_scores (game_date);
CREATE INDEX IF NOT EXISTS idx_mlps_model_type ON ml_prediction_scores (model_type);
CREATE INDEX IF NOT EXISTS idx_mlps_correct_winner ON ml_prediction_scores (was_correct)
  WHERE model_type = 'game_winner';

ALTER TABLE ml_prediction_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mlps_public_read" ON ml_prediction_scores FOR SELECT USING (true);

-- ============================================
-- 3. ML_MODEL_METADATA — Model version tracking
-- ============================================
CREATE TABLE IF NOT EXISTS ml_model_metadata (
  id BIGSERIAL PRIMARY KEY,
  model_type TEXT NOT NULL,
  model_version TEXT NOT NULL,
  training_games INTEGER,
  training_date_range JSONB,
  hyperparameters JSONB,
  val_brier_score REAL,
  val_accuracy REAL,
  val_log_loss REAL,
  val_mae REAL,
  val_rmse REAL,
  train_accuracy REAL,
  overfit_gap REAL,
  prod_accuracy_7d REAL,
  prod_accuracy_30d REAL,
  prod_accuracy_season REAL,
  feature_importance JSONB,
  features_used JSONB,
  is_active BOOLEAN DEFAULT false,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(model_type, model_version)
);

CREATE INDEX IF NOT EXISTS idx_mlmm_model_type ON ml_model_metadata (model_type);
CREATE INDEX IF NOT EXISTS idx_mlmm_active ON ml_model_metadata (model_type, is_active)
  WHERE is_active = true;

ALTER TABLE ml_model_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mlmm_public_read" ON ml_model_metadata FOR SELECT USING (true);

-- ============================================
-- 4. ML_MODEL_EVALUATIONS — Monthly comprehensive evaluations
-- ============================================
CREATE TABLE IF NOT EXISTS ml_model_evaluations (
  id BIGSERIAL PRIMARY KEY,
  model_type TEXT NOT NULL,
  model_version TEXT NOT NULL,
  evaluation_date DATE NOT NULL,
  calibration_buckets JSONB,
  accuracy_by_confidence JSONB,
  vs_naive_baseline REAL,
  vs_simple_baseline REAL,
  vs_rule_based REAL,
  train_val_gap_history JSONB,
  is_overfitting BOOLEAN,
  feature_drift_score REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(model_type, model_version, evaluation_date)
);

CREATE INDEX IF NOT EXISTS idx_mlme_model_type ON ml_model_evaluations (model_type);

ALTER TABLE ml_model_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mlme_public_read" ON ml_model_evaluations FOR SELECT USING (true);
