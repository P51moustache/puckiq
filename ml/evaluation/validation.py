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
    sample_weights: pd.Series | None = None,
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
        sample_weights: Optional per-sample weights (e.g. season weights for multi-season).

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

        # Slice sample weights for this fold's training data
        train_kwargs: dict[str, Any] = {"eval_set": (X_val, y_val)}
        if sample_weights is not None:
            train_kwargs["sample_weight"] = sample_weights.iloc[:train_end]

        model = model_class(**(model_kwargs or {}))
        train_metrics = model.train(X_train, y_train, **train_kwargs)
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


def detect_concept_drift(
    fold_results: list[FoldResult],
    metric_name: str = "accuracy",
    min_folds: int = 3,
) -> dict[str, Any]:
    """
    Detect concept drift by analyzing metric trends across CV folds.

    Checks for:
    1. Monotonic decline — metric consistently decreases across folds
    2. Large drop — last fold is significantly worse than the average
    3. High variance — metric is unstable across folds

    Args:
        fold_results: Output from walk_forward_cv().
        metric_name: Which validation metric to analyze.
        min_folds: Minimum folds needed for drift analysis.

    Returns:
        Dict with drift_detected, trend info, and fold metric values.
    """
    if len(fold_results) < min_folds:
        return {
            "drift_detected": False,
            "reason": f"Too few folds ({len(fold_results)} < {min_folds})",
            "fold_values": [],
        }

    # Extract the metric from validation results
    values = []
    for fr in fold_results:
        val = fr.val_metrics.get(metric_name)
        if val is not None:
            values.append(val)

    if len(values) < min_folds:
        return {
            "drift_detected": False,
            "reason": f"Metric '{metric_name}' not found in enough folds",
            "fold_values": values,
        }

    # Check 1: Monotonic decline (for higher-is-better metrics like accuracy)
    # Count how many consecutive folds show decline
    declines = sum(1 for i in range(1, len(values)) if values[i] < values[i - 1])
    decline_rate = declines / (len(values) - 1)

    # Check 2: Large drop — last fold vs average of all folds
    avg_val = sum(values) / len(values)
    last_val = values[-1]
    # For accuracy-like metrics (higher is better), a drop means last < avg
    drop_pct = (avg_val - last_val) / avg_val if avg_val != 0 else 0

    # Check 3: High variance
    mean_val = sum(values) / len(values)
    variance = sum((v - mean_val) ** 2 for v in values) / len(values)
    std_val = variance ** 0.5
    cv = std_val / abs(mean_val) if mean_val != 0 else 0  # Coefficient of variation

    drift_detected = False
    reasons = []

    if decline_rate >= 0.75:
        drift_detected = True
        reasons.append(f"Monotonic decline: {decline_rate:.0%} of folds show decreasing {metric_name}")

    if drop_pct > 0.15:
        drift_detected = True
        reasons.append(f"Large drop: last fold {metric_name}={last_val:.4f} vs avg={avg_val:.4f} ({drop_pct:.0%} drop)")

    if cv > 0.20:
        drift_detected = True
        reasons.append(f"High variance: CV={cv:.2f} for {metric_name}")

    result = {
        "drift_detected": drift_detected,
        "reasons": reasons,
        "fold_values": values,
        "decline_rate": decline_rate,
        "last_vs_avg_drop": drop_pct,
        "coefficient_of_variation": cv,
        "metric_name": metric_name,
    }

    if drift_detected:
        logger.warning("Concept drift detected: %s", reasons)
    else:
        logger.info("No concept drift detected for %s", metric_name)

    return result
