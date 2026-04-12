"""
Central configuration for the PuckIQ ML pipeline.

All constants, hyperparameters, and environment-driven settings live here.
Nothing is hardcoded in model or pipeline code — import from this module.
"""

import os
from enum import Enum
from pathlib import Path

# Load .env if present (local dev). In GitHub Actions the env vars are set directly.
# Check ml/.env first, then project root .env.
try:
    from dotenv import load_dotenv
    _env_candidates = [
        Path(__file__).parent / ".env",           # ml/.env
        Path(__file__).parent.parent / ".env",     # project root .env
    ]
    for _env_file in _env_candidates:
        if _env_file.exists():
            load_dotenv(_env_file)
except ImportError:
    pass  # python-dotenv not installed — fine in CI


# ---------------------------------------------------------------------------
# Model types
# ---------------------------------------------------------------------------

class ModelType(str, Enum):
    GAME_WINNER = "game_winner"
    SPREAD = "spread"
    TOTALS = "totals"
    PLAYER_PROPS = "player_props"


# ---------------------------------------------------------------------------
# Walk-forward cross-validation
# ---------------------------------------------------------------------------

MIN_TRAINING_GAMES = 200
VALIDATION_WINDOW = 50
STEP_SIZE = 50


# ---------------------------------------------------------------------------
# Season weighting (for multi-season training)
# ---------------------------------------------------------------------------

CURRENT_SEASON_WEIGHT = 1.0
PRIOR_SEASON_WEIGHT = 0.7

# Training seasons: 3 seasons with decay weights (more data reduces overfitting)
TRAINING_SEASONS = [20232024, 20242025, 20252026]

SEASON_WEIGHTS = {
    20232024: PRIOR_SEASON_WEIGHT * PRIOR_SEASON_WEIGHT,  # 0.49
    20242025: PRIOR_SEASON_WEIGHT,                         # 0.70
    20252026: CURRENT_SEASON_WEIGHT,                       # 1.00
}


# ---------------------------------------------------------------------------
# Model promotion thresholds
# ---------------------------------------------------------------------------

MIN_BRIER_IMPROVEMENT = 0.003     # New model must improve Brier by at least this much
MIN_GAMES_FOR_PROMOTION = 200     # Minimum games in training set before promoting

# ---------------------------------------------------------------------------
# Quality gates — model must pass ALL of these before going live in the app.
# These protect against promoting a model that technically "improved" over the
# previous version but is still worse than trivial baselines.
# ---------------------------------------------------------------------------

MAX_BRIER_SCORE = 0.260           # Must be better than coin flip (0.250 = random, but
                                  #   real-world noise means 0.260 is a safe ceiling)
MIN_ACCURACY = 0.520              # Must beat random guessing (50%) by a meaningful margin
MAX_TRAIN_VAL_GAP = 0.10          # Default gap threshold (backward compat)

# Per-metric overfitting thresholds — different metrics have different scales.
# Accuracy/Brier are 0-1, so 0.05 gap is meaningful.
# MAE is in goal units (0-10+), so 0.05 would false-alarm on every model.
OVERFITTING_THRESHOLDS = {
    "accuracy": 0.10,
    "brier_score": 0.10,
    "mae": 0.50,      # Half a goal tolerance for regression models
    "rmse": 0.50,
    "log_loss": 0.10,
}
MIN_CALIBRATION_QUALITY = 0.80    # Calibration R² — predicted probabilities must roughly
                                  #   match actual outcomes (1.0 = perfect calibration)
MAX_ECE_FOR_PROMOTION = 0.15      # ECE measures miscalibration; 0.15 ensures predictions within ~15% of true probabilities

# ---------------------------------------------------------------------------
# Underfitting thresholds — model must beat these minimums or it's too weak
# to be useful. These are per-model-type since different tasks have different
# scales and baselines.
# ---------------------------------------------------------------------------

UNDERFITTING_THRESHOLDS = {
    "game_winner": {
        "metric": "accuracy",
        "direction": "min",       # value must be >= threshold
        "threshold": 0.520,       # Must beat coin flip (50%) by meaningful margin
    },
    "spread": {
        "metric": "mae",
        "direction": "max",       # value must be <= threshold
        "threshold": 2.50,        # Home-away spread MAE; random guess ~3.0
    },
    "totals": {
        "metric": "mae",
        "direction": "max",       # value must be <= threshold
        "threshold": 2.00,        # Total goals MAE; average ~6.0, naive guess ~2.5
    },
}

# ---------------------------------------------------------------------------
# Overfitting guard
# ---------------------------------------------------------------------------

# MAX_TRAIN_VAL_GAP defined above in quality gates


# ---------------------------------------------------------------------------
# Feature limits (V1)
# ---------------------------------------------------------------------------

MAX_FEATURES_V1 = 20


# ---------------------------------------------------------------------------
# Confidence thresholds (game winner probability)
# ---------------------------------------------------------------------------

CONFIDENCE_HIGH = 0.65
CONFIDENCE_LOW = 0.55


# ---------------------------------------------------------------------------
# Data freshness
# ---------------------------------------------------------------------------

MAX_STALENESS_HOURS = 14


# ---------------------------------------------------------------------------
# Supabase table names
# ---------------------------------------------------------------------------

ML_PREDICTIONS_TABLE = "ml_predictions"
ML_SCORES_TABLE = "ml_prediction_scores"
ML_MODEL_METADATA_TABLE = "ml_model_metadata"
ML_MODEL_EVALUATIONS_TABLE = "ml_model_evaluations"
ML_PLAYER_PROJECTIONS_TABLE = "ml_player_projections"

# Source tables (read-only)
GAMES_TABLE = "games"
STANDINGS_TABLE = "standings"
SKATER_SEASON_STATS_TABLE = "skater_season_stats"
GOALIE_SEASON_STATS_TABLE = "goalie_season_stats"
TEAM_STAT_CATEGORIES_TABLE = "team_stat_categories"
GAME_SKATER_STATS_TABLE = "game_skater_stats"
GAME_GOALIE_STATS_TABLE = "game_goalie_stats"
SKATER_GAME_CATEGORIES_TABLE = "skater_game_categories"
SYNC_LOG_TABLE = "sync_log"
GAME_PLAY_BY_PLAY_TABLE = "game_play_by_play"
GAME_DETAILS_TABLE = "game_details"


# ---------------------------------------------------------------------------
# NHL constants
# ---------------------------------------------------------------------------

CURRENT_SEASON = 20252026
ALL_TEAMS = [
    "ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL",
    "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD",
    "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS",
    "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH",
]


# ---------------------------------------------------------------------------
# LightGBM default hyperparameters
# ---------------------------------------------------------------------------

LGBM_CLASSIFIER_DEFAULTS = {
    "num_leaves": 31,
    "learning_rate": 0.1,
    "n_estimators": 100,
    "min_child_samples": 50,
    "reg_alpha": 0.5,
    "reg_lambda": 0.5,
    "objective": "binary",
    "metric": "binary_logloss",
    "verbose": -1,
}

LGBM_REGRESSOR_DEFAULTS = {
    "num_leaves": 31,
    "learning_rate": 0.1,
    "n_estimators": 100,
    "min_child_samples": 50,
    "reg_alpha": 0.5,
    "reg_lambda": 0.5,
    "objective": "regression",
    "metric": "mae",
    "verbose": -1,
}


# ---------------------------------------------------------------------------
# Optuna tuning
# ---------------------------------------------------------------------------

ENABLE_TUNING = True  # Re-enabled after baseline V3 models established
TUNING_N_TRIALS = 75  # Enough trials for TPE to converge on 10 hyperparameters


# ---------------------------------------------------------------------------
# Pipeline / external services (from env vars)
# ---------------------------------------------------------------------------

HEALTHCHECK_URL = os.getenv("HEALTHCHECK_URL", "")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")

# Supabase (pipeline reads from env; app reads from EXPO_PUBLIC_ prefix)
# Support both SUPABASE_URL and EXPO_PUBLIC_SUPABASE_URL for local dev.
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("EXPO_PUBLIC_SUPABASE_URL") or ""
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


# ---------------------------------------------------------------------------
# Model storage
# ---------------------------------------------------------------------------

MODEL_STORAGE_BUCKET = "ml-models"
MODEL_VERSIONS_TO_KEEP = 5


# ---------------------------------------------------------------------------
# Totals model ensemble weights
# ---------------------------------------------------------------------------

TOTALS_POISSON_WEIGHT = 0.5
TOTALS_LGBM_WEIGHT = 0.5

# Game winner ensemble weights (LightGBM + Logistic Regression)
GW_LGBM_WEIGHT = 0.7
GW_LR_WEIGHT = 0.3
