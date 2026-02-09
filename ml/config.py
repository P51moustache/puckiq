"""
Central configuration for the PuckIQ ML pipeline.

All constants, hyperparameters, and environment-driven settings live here.
Nothing is hardcoded in model or pipeline code — import from this module.
"""

import os
from enum import Enum
from pathlib import Path

# Load .env if present (local dev). In GitHub Actions the env vars are set directly.
try:
    from dotenv import load_dotenv
    _env_file = Path(__file__).parent / ".env"
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

MIN_TRAINING_GAMES = 100
VALIDATION_WINDOW = 50
STEP_SIZE = 50


# ---------------------------------------------------------------------------
# Season weighting (for multi-season training)
# ---------------------------------------------------------------------------

CURRENT_SEASON_WEIGHT = 1.0
PRIOR_SEASON_WEIGHT = 0.7


# ---------------------------------------------------------------------------
# Model promotion thresholds
# ---------------------------------------------------------------------------

MIN_BRIER_IMPROVEMENT = 0.02      # New model must improve Brier by at least this much
MIN_GAMES_FOR_PROMOTION = 200     # Minimum games in training set before promoting

# ---------------------------------------------------------------------------
# Quality gates — model must pass ALL of these before going live in the app.
# These protect against promoting a model that technically "improved" over the
# previous version but is still worse than trivial baselines.
# ---------------------------------------------------------------------------

MAX_BRIER_SCORE = 0.260           # Must be better than coin flip (0.250 = random, but
                                  #   real-world noise means 0.260 is a safe ceiling)
MIN_ACCURACY = 0.520              # Must beat random guessing (50%) by a meaningful margin
MAX_TRAIN_VAL_GAP = 0.05          # Default gap threshold (backward compat)

# Per-metric overfitting thresholds — different metrics have different scales.
# Accuracy/Brier are 0-1, so 0.05 gap is meaningful.
# MAE is in goal units (0-10+), so 0.05 would false-alarm on every model.
OVERFITTING_THRESHOLDS = {
    "accuracy": 0.05,
    "brier_score": 0.05,
    "mae": 0.50,      # Half a goal tolerance for regression models
    "rmse": 0.50,
    "log_loss": 0.10,
}
MIN_CALIBRATION_QUALITY = 0.80    # Calibration R² — predicted probabilities must roughly
                                  #   match actual outcomes (1.0 = perfect calibration)

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

# Source tables (read-only)
GAMES_TABLE = "games"
STANDINGS_TABLE = "standings"
SKATER_SEASON_STATS_TABLE = "skater_season_stats"
GOALIE_SEASON_STATS_TABLE = "goalie_season_stats"
TEAM_STAT_CATEGORIES_TABLE = "team_stat_categories"
GAME_SKATER_STATS_TABLE = "game_skater_stats"
GAME_GOALIE_STATS_TABLE = "game_goalie_stats"
SYNC_LOG_TABLE = "sync_log"


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
    "min_child_samples": 20,
    "reg_alpha": 0.1,
    "reg_lambda": 0.1,
    "objective": "binary",
    "metric": "binary_logloss",
    "verbose": -1,
}

LGBM_REGRESSOR_DEFAULTS = {
    "num_leaves": 31,
    "learning_rate": 0.1,
    "n_estimators": 100,
    "min_child_samples": 20,
    "reg_alpha": 0.1,
    "reg_lambda": 0.1,
    "objective": "regression",
    "metric": "mae",
    "verbose": -1,
}


# ---------------------------------------------------------------------------
# Pipeline / external services (from env vars)
# ---------------------------------------------------------------------------

HEALTHCHECK_URL = os.getenv("HEALTHCHECK_URL", "")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")

# Supabase (pipeline reads from env; app reads from EXPO_PUBLIC_ prefix)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
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
