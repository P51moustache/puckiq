"""Tests for ml/evaluation/confidence.py — bootstrap confidence intervals."""

import numpy as np
import pytest

from ml.evaluation.confidence import bootstrap_ci


def _accuracy(y_true, y_pred):
    return float(np.mean(y_true == y_pred))


def _mae(y_true, y_pred):
    return float(np.mean(np.abs(y_true - y_pred)))


class TestBootstrapCI:
    def test_returns_required_keys(self):
        y_true = np.array([1, 0, 1, 0, 1])
        y_pred = np.array([1, 0, 1, 1, 1])
        result = bootstrap_ci(y_true, y_pred, _accuracy)
        assert "point_estimate" in result
        assert "ci_lower" in result
        assert "ci_upper" in result
        assert "ci_width" in result

    def test_ci_bounds_order(self):
        y_true = np.random.default_rng(42).choice([0, 1], 100)
        y_pred = np.random.default_rng(43).choice([0, 1], 100)
        result = bootstrap_ci(y_true, y_pred, _accuracy)
        assert result["ci_lower"] <= result["point_estimate"] <= result["ci_upper"]

    def test_perfect_predictions_narrow_ci(self):
        y_true = np.array([1, 0, 1, 0, 1, 0, 1, 0] * 20)
        y_pred = y_true.copy()
        result = bootstrap_ci(y_true, y_pred, _accuracy)
        assert result["point_estimate"] == 1.0
        assert result["ci_width"] == 0.0

    def test_ci_width_decreases_with_more_data(self):
        rng = np.random.default_rng(42)
        y_true_small = rng.choice([0, 1], 30)
        y_pred_small = rng.choice([0, 1], 30)
        y_true_large = rng.choice([0, 1], 500)
        y_pred_large = rng.choice([0, 1], 500)
        ci_small = bootstrap_ci(y_true_small, y_pred_small, _accuracy)
        ci_large = bootstrap_ci(y_true_large, y_pred_large, _accuracy)
        assert ci_small["ci_width"] > ci_large["ci_width"]

    def test_works_with_mae(self):
        rng = np.random.default_rng(42)
        y_true = rng.normal(5.5, 1.5, 100)
        y_pred = y_true + rng.normal(0, 0.5, 100)
        result = bootstrap_ci(y_true, y_pred, _mae)
        assert result["point_estimate"] > 0
        assert result["ci_lower"] > 0

    def test_empty_arrays(self):
        result = bootstrap_ci(np.array([]), np.array([]), _accuracy)
        assert result["point_estimate"] == 0.0
        assert result["ci_width"] == 0.0

    def test_reproducible_with_seed(self):
        rng = np.random.default_rng(99)
        y_true = rng.choice([0, 1], 50)
        y_pred = rng.choice([0, 1], 50)
        r1 = bootstrap_ci(y_true, y_pred, _accuracy, seed=42)
        r2 = bootstrap_ci(y_true, y_pred, _accuracy, seed=42)
        assert r1 == r2
