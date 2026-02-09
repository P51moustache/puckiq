"""
Overfitting detection.

Monitors the gap between training and validation metrics.
If the gap exceeds MAX_TRAIN_VAL_GAP, the model is likely overfitting.
"""

import logging
from typing import Any

from ml.config import MAX_TRAIN_VAL_GAP, OVERFITTING_THRESHOLDS

logger = logging.getLogger(__name__)


def detect_overfitting(
    train_metrics: dict[str, float],
    val_metrics: dict[str, float],
    threshold: float = MAX_TRAIN_VAL_GAP,
    thresholds: dict[str, float] | None = None,
) -> dict[str, Any]:
    """
    Compare training vs validation metrics to detect overfitting.

    Uses per-metric thresholds when available (OVERFITTING_THRESHOLDS),
    falling back to the uniform `threshold` for unrecognized metrics.

    Args:
        train_metrics: Metrics from training set.
        val_metrics: Metrics from validation set.
        threshold: Default threshold for metrics not in thresholds dict.
        thresholds: Per-metric threshold overrides. Defaults to OVERFITTING_THRESHOLDS.

    Returns:
        Dict with is_overfitting, gaps, and details.
    """
    if thresholds is None:
        thresholds = OVERFITTING_THRESHOLDS

    result: dict[str, Any] = {
        "is_overfitting": False,
        "gaps": {},
        "threshold": threshold,
        "thresholds_used": {},
    }

    # Accuracy: higher is better, so train > val means overfitting
    if "accuracy" in train_metrics and "accuracy" in val_metrics:
        gap = train_metrics["accuracy"] - val_metrics["accuracy"]
        t = thresholds.get("accuracy", threshold)
        result["gaps"]["accuracy"] = gap
        result["thresholds_used"]["accuracy"] = t
        if gap > t:
            result["is_overfitting"] = True
            logger.warning(
                "Overfitting detected: accuracy gap=%.4f (threshold=%.4f)",
                gap, t,
            )

    # Brier: lower is better, so val > train means overfitting
    if "brier_score" in train_metrics and "brier_score" in val_metrics:
        gap = val_metrics["brier_score"] - train_metrics["brier_score"]
        t = thresholds.get("brier_score", threshold)
        result["gaps"]["brier_score"] = gap
        result["thresholds_used"]["brier_score"] = t
        if gap > t:
            result["is_overfitting"] = True
            logger.warning(
                "Overfitting detected: brier gap=%.4f (threshold=%.4f)",
                gap, t,
            )

    # MAE: lower is better, so val > train means overfitting
    if "mae" in train_metrics and "mae" in val_metrics:
        gap = val_metrics["mae"] - train_metrics["mae"]
        t = thresholds.get("mae", threshold)
        result["gaps"]["mae"] = gap
        result["thresholds_used"]["mae"] = t
        if gap > t:
            result["is_overfitting"] = True

    # RMSE: lower is better, so val > train means overfitting
    if "rmse" in train_metrics and "rmse" in val_metrics:
        gap = val_metrics["rmse"] - train_metrics["rmse"]
        t = thresholds.get("rmse", threshold)
        result["gaps"]["rmse"] = gap
        result["thresholds_used"]["rmse"] = t
        if gap > t:
            result["is_overfitting"] = True

    # Log loss: lower is better, so val > train means overfitting
    if "log_loss" in train_metrics and "log_loss" in val_metrics:
        gap = val_metrics["log_loss"] - train_metrics["log_loss"]
        t = thresholds.get("log_loss", threshold)
        result["gaps"]["log_loss"] = gap
        result["thresholds_used"]["log_loss"] = t
        if gap > t:
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
