"""
Calibration analysis for probability predictions.

Computes calibration buckets for reliability diagrams:
  - Bin predictions into equal-width buckets
  - Compare average predicted probability to actual win rate per bucket
  - Well-calibrated model: predicted ≈ actual in each bucket
"""

import logging
from dataclasses import dataclass

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class CalibrationBucket:
    """A single bucket in the calibration analysis."""

    bucket_low: float
    bucket_high: float
    predicted_avg: float
    actual_avg: float
    count: int


def compute_calibration_buckets(
    predictions: np.ndarray,
    actuals: np.ndarray,
    n_buckets: int = 10,
) -> list[CalibrationBucket]:
    """
    Compute calibration buckets for reliability diagram data.

    Args:
        predictions: 1-D array of predicted probabilities (0 to 1).
        actuals: 1-D array of actual outcomes (0 or 1).
        n_buckets: Number of equal-width buckets.

    Returns:
        List of CalibrationBucket objects.
    """
    if len(predictions) != len(actuals):
        raise ValueError("predictions and actuals must have the same length")

    if len(predictions) == 0:
        return []

    edges = np.linspace(0.0, 1.0, n_buckets + 1)
    buckets: list[CalibrationBucket] = []

    for i in range(n_buckets):
        low = edges[i]
        high = edges[i + 1]

        # Include right edge in last bucket
        if i == n_buckets - 1:
            mask = (predictions >= low) & (predictions <= high)
        else:
            mask = (predictions >= low) & (predictions < high)

        bucket_preds = predictions[mask]
        bucket_actuals = actuals[mask]

        if len(bucket_preds) > 0:
            buckets.append(CalibrationBucket(
                bucket_low=float(low),
                bucket_high=float(high),
                predicted_avg=float(np.mean(bucket_preds)),
                actual_avg=float(np.mean(bucket_actuals)),
                count=int(len(bucket_preds)),
            ))
        else:
            buckets.append(CalibrationBucket(
                bucket_low=float(low),
                bucket_high=float(high),
                predicted_avg=float((low + high) / 2),
                actual_avg=0.0,
                count=0,
            ))

    non_empty = [b for b in buckets if b.count > 0]
    if non_empty:
        max_gap = max(abs(b.predicted_avg - b.actual_avg) for b in non_empty)
        logger.info(
            "Calibration: %d non-empty buckets, max gap=%.3f",
            len(non_empty), max_gap,
        )

    return buckets
