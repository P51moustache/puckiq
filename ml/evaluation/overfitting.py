"""
Overfitting detection.

Monitors the gap between training and validation metrics.
If the gap exceeds MAX_TRAIN_VAL_GAP, the model is likely overfitting.
"""

import logging
from typing import Any

from ml.config import MAX_TRAIN_VAL_GAP

logger = logging.getLogger(__name__)


def detect_overfitting(
    train_metrics: dict[str, float],
    val_metrics: dict[str, float],
    threshold: float = MAX_TRAIN_VAL_GAP,
) -> dict[str, Any]:
    """
    Compare training vs validation metrics to detect overfitting.

    Checks accuracy gap (train - val) and Brier gap (val - train).
    For both, a large gap indicates overfitting.

    Args:
        train_metrics: Metrics from training set.
        val_metrics: Metrics from validation set.
        threshold: Maximum acceptable gap.

    Returns:
        Dict with is_overfitting, gaps, and details.
    """
    result: dict[str, Any] = {
        "is_overfitting": False,
        "gaps": {},
        "threshold": threshold,
    }

    # Accuracy: higher is better, so train > val means overfitting
    if "accuracy" in train_metrics and "accuracy" in val_metrics:
        gap = train_metrics["accuracy"] - val_metrics["accuracy"]
        result["gaps"]["accuracy"] = gap
        if gap > threshold:
            result["is_overfitting"] = True
            logger.warning(
                "Overfitting detected: accuracy gap=%.4f (threshold=%.4f)",
                gap, threshold,
            )

    # Brier: lower is better, so val > train means overfitting
    if "brier_score" in train_metrics and "brier_score" in val_metrics:
        gap = val_metrics["brier_score"] - train_metrics["brier_score"]
        result["gaps"]["brier_score"] = gap
        if gap > threshold:
            result["is_overfitting"] = True
            logger.warning(
                "Overfitting detected: brier gap=%.4f (threshold=%.4f)",
                gap, threshold,
            )

    # MAE: lower is better, so val > train means overfitting
    if "mae" in train_metrics and "mae" in val_metrics:
        gap = val_metrics["mae"] - train_metrics["mae"]
        result["gaps"]["mae"] = gap
        if gap > threshold:
            result["is_overfitting"] = True

    if not result["is_overfitting"]:
        logger.info("No overfitting detected: gaps=%s", result["gaps"])

    return result


def compute_train_val_gap_history(
    model_metadata_list: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Compute historical train-val gap trend from model metadata records.

    Each metadata record should contain train_metrics and val_metrics dicts.

    Args:
        model_metadata_list: List of model metadata records, ordered chronologically.

    Returns:
        List of dicts with version, gaps, and is_overfitting per entry.
    """
    history: list[dict[str, Any]] = []

    for meta in model_metadata_list:
        train_m = meta.get("train_metrics", {})
        val_m = meta.get("val_metrics", {})
        version = meta.get("version", "unknown")

        result = detect_overfitting(train_m, val_m)
        history.append({
            "version": version,
            "gaps": result["gaps"],
            "is_overfitting": result["is_overfitting"],
        })

    return history
