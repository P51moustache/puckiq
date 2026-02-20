"""
Hyperparameter tuning with Optuna.

Uses walk-forward CV as the objective (not random K-fold) to prevent leakage.
Each Optuna trial proposes a set of hyperparameters, trains a model using
walk-forward CV, and reports the average validation metric.

WHY OPTUNA? (tutorial)

  LightGBM has ~15 hyperparameters that interact in complex ways. The defaults
  (num_leaves=31, learning_rate=0.1) are reasonable starting points, but tuning
  can improve performance by 2-5% — which matters for sports prediction.

  Optuna uses Bayesian optimization (TPE sampler), which is smarter than grid
  search: it learns from previous trials to focus on promising parameter regions.
  50-100 trials is usually enough for LightGBM.
"""

import logging
from typing import Any

import optuna
import pandas as pd

from ml.config import (
    LGBM_CLASSIFIER_DEFAULTS,
    LGBM_REGRESSOR_DEFAULTS,
    MIN_TRAINING_GAMES,
    ModelType,
    STEP_SIZE,
    VALIDATION_WINDOW,
)
from ml.evaluation.validation import walk_forward_cv
from ml.models.game_winner import GameWinnerModel
from ml.models.spread import SpreadModel
from ml.models.totals import TotalsModel

logger = logging.getLogger(__name__)

# Suppress Optuna's verbose trial logging
optuna.logging.set_verbosity(optuna.logging.WARNING)


def _suggest_lgbm_params(trial: optuna.Trial) -> dict[str, Any]:
    """Suggest LightGBM hyperparameters for a single trial."""
    return {
        "num_leaves": trial.suggest_int("num_leaves", 15, 63),
        "max_depth": trial.suggest_int("max_depth", 3, 8),
        "learning_rate": trial.suggest_float("learning_rate", 0.005, 0.3, log=True),
        "n_estimators": trial.suggest_int("n_estimators", 100, 500),
        "min_child_samples": trial.suggest_int("min_child_samples", 30, 100),
        "min_split_gain": trial.suggest_float("min_split_gain", 0.01, 1.0, log=True),
        "reg_alpha": trial.suggest_float("reg_alpha", 0.1, 2.0, log=True),
        "reg_lambda": trial.suggest_float("reg_lambda", 0.1, 2.0, log=True),
        "subsample": trial.suggest_float("subsample", 0.6, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
    }


def _get_model_class_and_metric(model_type: str) -> tuple[type, str, str]:
    """
    Return (model_class, primary_metric, direction) for the given model type.

    direction: 'minimize' or 'maximize' (for Optuna study).
    """
    if model_type == ModelType.GAME_WINNER:
        return GameWinnerModel, "brier_score", "minimize"
    elif model_type == ModelType.SPREAD:
        return SpreadModel, "mae", "minimize"
    elif model_type == ModelType.TOTALS:
        return TotalsModel, "mae", "minimize"
    else:
        raise ValueError(f"Unsupported model type for tuning: {model_type}")


def tune_model(
    model_type: str,
    features_df: pd.DataFrame,
    targets: pd.Series,
    n_trials: int = 50,
    min_train: int = MIN_TRAINING_GAMES,
    val_window: int = VALIDATION_WINDOW,
    step_size: int = STEP_SIZE,
) -> dict[str, Any]:
    """
    Tune hyperparameters for a model type using Optuna + walk-forward CV.

    Args:
        model_type: One of ModelType values (game_winner, spread, totals).
        features_df: Chronologically-sorted feature matrix.
        targets: Chronologically-sorted targets.
        n_trials: Number of Optuna trials to run.
        min_train: Min training games for walk-forward CV.
        val_window: Validation window size.
        step_size: CV step size.

    Returns:
        Dict with best_params, best_value, n_trials, and study summary.
    """
    model_class, metric_name, direction = _get_model_class_and_metric(model_type)

    def objective(trial: optuna.Trial) -> float:
        params = _suggest_lgbm_params(trial)

        # Add fixed params that shouldn't be tuned
        if model_type == ModelType.GAME_WINNER:
            params.update({"objective": "binary", "metric": "binary_logloss", "verbose": -1})
        else:
            params.update({"objective": "regression", "metric": "mae", "verbose": -1})

        fold_results = walk_forward_cv(
            model_class=model_class,
            features_df=features_df,
            targets=targets,
            min_train=min_train,
            val_window=val_window,
            step_size=step_size,
            model_kwargs={"params": params} if model_type != ModelType.TOTALS else {},
        )

        if not fold_results:
            return float("inf") if direction == "minimize" else float("-inf")

        # Average the target metric across folds
        values = [fr.val_metrics.get(metric_name, float("inf")) for fr in fold_results]
        return sum(values) / len(values)

    study = optuna.create_study(direction=direction)
    study.optimize(objective, n_trials=n_trials)

    best = study.best_trial
    logger.info(
        "Tuning complete for %s: best %s=%.4f after %d trials",
        model_type, metric_name, best.value, n_trials,
    )

    return {
        "model_type": model_type,
        "best_params": best.params,
        "best_value": best.value,
        "metric_name": metric_name,
        "n_trials": n_trials,
        "default_params": (
            LGBM_CLASSIFIER_DEFAULTS if model_type == ModelType.GAME_WINNER
            else LGBM_REGRESSOR_DEFAULTS
        ),
    }
