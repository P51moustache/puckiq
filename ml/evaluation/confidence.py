"""
Bootstrap confidence intervals for model metrics.

WHY CONFIDENCE INTERVALS?

  A single accuracy number (e.g., 58%) tells you nothing about reliability.
  Is that based on 50 games or 500? Could the true accuracy be 52% or 64%?

  Bootstrap CIs answer this: resample the data 1000 times, compute the metric
  each time, and report the 2.5th and 97.5th percentiles. This gives a range
  like [54%, 62%] that we're 95% confident contains the true value.

  If the CI is wide, we need more data. If it's narrow, we can trust the metric.
"""

import logging
from typing import Callable

import numpy as np

logger = logging.getLogger(__name__)


def bootstrap_ci(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    metric_fn: Callable[[np.ndarray, np.ndarray], float],
    n_bootstrap: int = 1000,
    confidence: float = 0.95,
    seed: int = 42,
) -> dict[str, float]:
    """
    Compute a bootstrap confidence interval for a metric.

    Args:
        y_true: Ground truth values.
        y_pred: Predicted values.
        metric_fn: Function(y_true, y_pred) -> float.
        n_bootstrap: Number of bootstrap iterations.
        confidence: Confidence level (default 95%).
        seed: Random seed for reproducibility.

    Returns:
        Dict with keys: point_estimate, ci_lower, ci_upper, ci_width.
    """
    rng = np.random.default_rng(seed)
    n = len(y_true)

    if n == 0:
        return {"point_estimate": 0.0, "ci_lower": 0.0, "ci_upper": 0.0, "ci_width": 0.0}

    point_estimate = float(metric_fn(y_true, y_pred))

    boot_values = np.empty(n_bootstrap)
    for i in range(n_bootstrap):
        idx = rng.integers(0, n, size=n)
        boot_values[i] = metric_fn(y_true[idx], y_pred[idx])

    alpha = (1 - confidence) / 2
    ci_lower = float(np.percentile(boot_values, 100 * alpha))
    ci_upper = float(np.percentile(boot_values, 100 * (1 - alpha)))

    logger.info(
        "Bootstrap CI: %.4f [%.4f, %.4f] (n=%d, bootstrap=%d)",
        point_estimate, ci_lower, ci_upper, n, n_bootstrap,
    )

    return {
        "point_estimate": point_estimate,
        "ci_lower": ci_lower,
        "ci_upper": ci_upper,
        "ci_width": ci_upper - ci_lower,
    }
