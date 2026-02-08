"""
Walk-forward cross-validation.

WHY NOT RANDOM K-FOLD? (tutorial)

  In standard ML, you randomly split data into train/test folds. But sports data
  is ordered in time — you can't use March games to predict January games.
  Walk-forward CV respects this temporal ordering:

  Fold 1: Train on games 1-100,  Validate on games 101-150
  Fold 2: Train on games 1-150,  Validate on games 151-200
  Fold 3: Train on games 1-200,  Validate on games 201-250
  ...

  This simulates the real production scenario: we always train on PAST games and
  predict FUTURE games. The expanding training window means each fold has more
  data than the last, just like in production as the season progresses.

  Key parameters:
  - MIN_TRAINING_GAMES (100): Don't start validating until we have enough data.
    Too few training games = model hasn't learned anything useful yet.
  - VALIDATION_WINDOW (50): Each fold validates on 50 games. Too small = noisy
    estimates. Too large = fewer folds.
  - STEP_SIZE (50): How much to expand the window per fold. Equals val_window
    so folds don't overlap.
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Protocol

import pandas as pd

from ml.config import MIN_TRAINING_GAMES, STEP_SIZE, VALIDATION_WINDOW

logger = logging.getLogger(__name__)


class TrainableModel(Protocol):
    """Protocol for models that can be used in walk-forward CV."""

    def train(
        self,
        features_df: pd.DataFrame,
        targets: pd.Series,
        eval_set: tuple[pd.DataFrame, pd.Series] | None = None,
    ) -> dict[str, float]: ...

    def evaluate(
        self, features_df: pd.DataFrame, targets: pd.Series
    ) -> dict[str, float]: ...


@dataclass
class FoldResult:
    """Results from a single CV fold."""

    fold_idx: int
    train_size: int
    val_size: int
    train_metrics: dict[str, float] = field(default_factory=dict)
    val_metrics: dict[str, float] = field(default_factory=dict)


def walk_forward_cv(
    model_class: type,
    features_df: pd.DataFrame,
    targets: pd.Series,
    min_train: int = MIN_TRAINING_GAMES,
    val_window: int = VALIDATION_WINDOW,
    step_size: int = STEP_SIZE,
    model_kwargs: dict[str, Any] | None = None,
) -> list[FoldResult]:
    """
    Run expanding-window walk-forward cross-validation.

    Games must be sorted chronologically before calling this function.

    Args:
        model_class: Model class to instantiate per fold (must have train + evaluate).
        features_df: Chronologically-sorted feature matrix.
        targets: Chronologically-sorted target series.
        min_train: Minimum number of games before first validation fold.
        val_window: Number of games per validation fold.
        step_size: How many games to expand the training window per step.
        model_kwargs: Optional kwargs passed to model_class constructor.

    Returns:
        List of FoldResult objects, one per fold.
    """
    n = len(features_df)
    results: list[FoldResult] = []
    fold_idx = 0

    train_end = min_train

    while train_end + val_window <= n:
        val_start = train_end
        val_end = val_start + val_window

        X_train = features_df.iloc[:train_end]
        y_train = targets.iloc[:train_end]
        X_val = features_df.iloc[val_start:val_end]
        y_val = targets.iloc[val_start:val_end]

        model = model_class(**(model_kwargs or {}))
        train_metrics = model.train(X_train, y_train, eval_set=(X_val, y_val))
        val_metrics = model.evaluate(X_val, y_val)

        result = FoldResult(
            fold_idx=fold_idx,
            train_size=len(X_train),
            val_size=len(X_val),
            train_metrics=train_metrics,
            val_metrics=val_metrics,
        )
        results.append(result)

        logger.info(
            "Fold %d: train=%d, val=%d, val_metrics=%s",
            fold_idx, len(X_train), len(X_val), val_metrics,
        )

        fold_idx += 1
        train_end += step_size

    logger.info("Walk-forward CV complete: %d folds", len(results))
    return results
