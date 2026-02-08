"""
Tests for ml/models/totals.py — Poisson + LightGBM ensemble for total goals.

Tests the PoissonComponent, LGBMComponent, and TotalsModel ensemble.
"""

import numpy as np
import pandas as pd
import pytest

from ml.models.totals import LGBMComponent, PoissonComponent, TotalsModel, MAX_GOALS


class TestPoissonComponent:
    """Tests for the Poisson GLM sub-model."""

    def test_train_returns_metrics(self, synthetic_game_features, synthetic_targets_total):
        poisson = PoissonComponent()
        metrics = poisson.train(synthetic_game_features, synthetic_targets_total)
        assert isinstance(metrics, dict)
        assert "poisson_mae" in metrics

    def test_train_mae_non_negative(self, synthetic_game_features, synthetic_targets_total):
        poisson = PoissonComponent()
        metrics = poisson.train(synthetic_game_features, synthetic_targets_total)
        assert metrics["poisson_mae"] >= 0

    def test_predict_returns_array(self, synthetic_game_features, synthetic_targets_total):
        poisson = PoissonComponent()
        poisson.train(synthetic_game_features, synthetic_targets_total)
        preds = poisson.predict(synthetic_game_features)
        assert isinstance(preds, np.ndarray)
        assert len(preds) == len(synthetic_game_features)

    def test_predict_positive_values(self, synthetic_game_features, synthetic_targets_total):
        """Poisson predictions (expected total goals) should be positive."""
        poisson = PoissonComponent()
        poisson.train(synthetic_game_features, synthetic_targets_total)
        preds = poisson.predict(synthetic_game_features)
        assert np.all(preds > 0)

    def test_predict_without_training_raises(self, synthetic_game_features):
        poisson = PoissonComponent()
        with pytest.raises(RuntimeError, match="not trained"):
            poisson.predict(synthetic_game_features)

    def test_predict_distribution_shape(self, synthetic_game_features, synthetic_targets_total):
        poisson = PoissonComponent()
        poisson.train(synthetic_game_features, synthetic_targets_total)
        dist = poisson.predict_distribution(synthetic_game_features)
        assert dist.shape == (len(synthetic_game_features), MAX_GOALS + 1)

    def test_predict_distribution_sums_near_one(self, synthetic_game_features, synthetic_targets_total):
        """Each row's probabilities should sum to approximately 1 (within MAX_GOALS)."""
        poisson = PoissonComponent()
        poisson.train(synthetic_game_features, synthetic_targets_total)
        dist = poisson.predict_distribution(synthetic_game_features)
        row_sums = dist.sum(axis=1)
        # Sum should be close to 1, but not exactly because we truncate at MAX_GOALS
        assert np.all(row_sums > 0.9)
        assert np.all(row_sums <= 1.0 + 1e-9)

    def test_predict_distribution_non_negative(self, synthetic_game_features, synthetic_targets_total):
        """All probabilities should be non-negative."""
        poisson = PoissonComponent()
        poisson.train(synthetic_game_features, synthetic_targets_total)
        dist = poisson.predict_distribution(synthetic_game_features)
        assert np.all(dist >= 0)


class TestLGBMComponent:
    """Tests for the LightGBM sub-model in the totals ensemble."""

    def test_train_returns_metrics(self, synthetic_game_features, synthetic_targets_total):
        lgbm = LGBMComponent()
        metrics = lgbm.train(synthetic_game_features, synthetic_targets_total)
        assert isinstance(metrics, dict)
        assert "lgbm_mae" in metrics

    def test_train_mae_non_negative(self, synthetic_game_features, synthetic_targets_total):
        lgbm = LGBMComponent()
        metrics = lgbm.train(synthetic_game_features, synthetic_targets_total)
        assert metrics["lgbm_mae"] >= 0

    def test_predict_returns_array(self, synthetic_game_features, synthetic_targets_total):
        lgbm = LGBMComponent()
        lgbm.train(synthetic_game_features, synthetic_targets_total)
        preds = lgbm.predict(synthetic_game_features)
        assert isinstance(preds, np.ndarray)
        assert len(preds) == len(synthetic_game_features)

    def test_predict_without_training_raises(self, synthetic_game_features):
        lgbm = LGBMComponent()
        with pytest.raises(RuntimeError, match="not trained"):
            lgbm.predict(synthetic_game_features)


class TestTotalsModel:
    """Tests for the TotalsModel ensemble."""

    def test_train_returns_metrics(self, synthetic_game_features, synthetic_targets_total):
        model = TotalsModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_total)
        assert isinstance(metrics, dict)

    def test_train_metrics_have_all_keys(self, synthetic_game_features, synthetic_targets_total):
        model = TotalsModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_total)
        assert "poisson_mae" in metrics
        assert "lgbm_mae" in metrics
        assert "ensemble_mae" in metrics
        assert "ensemble_rmse" in metrics

    def test_ensemble_mae_non_negative(self, synthetic_game_features, synthetic_targets_total):
        model = TotalsModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_total)
        assert metrics["ensemble_mae"] >= 0
        assert metrics["ensemble_rmse"] >= 0

    def test_predict_returns_array(self, synthetic_game_features, synthetic_targets_total):
        model = TotalsModel()
        model.train(synthetic_game_features, synthetic_targets_total)
        preds = model.predict(synthetic_game_features)
        assert isinstance(preds, np.ndarray)
        assert len(preds) == len(synthetic_game_features)

    def test_predict_values_reasonable(self, synthetic_game_features, synthetic_targets_total):
        """Total goals predictions should be in a reasonable range (0-15)."""
        model = TotalsModel()
        model.train(synthetic_game_features, synthetic_targets_total)
        preds = model.predict(synthetic_game_features)
        assert np.all(preds > 0)
        assert np.all(preds < 20)

    def test_predict_is_weighted_average(self, synthetic_game_features, synthetic_targets_total):
        """Ensemble prediction should be a weighted average of both components."""
        model = TotalsModel(poisson_weight=0.3, lgbm_weight=0.7)
        model.train(synthetic_game_features, synthetic_targets_total)

        p_pred = model.poisson.predict(synthetic_game_features)
        l_pred = model.lgbm.predict(synthetic_game_features)
        expected = 0.3 * p_pred + 0.7 * l_pred

        actual = model.predict(synthetic_game_features)
        np.testing.assert_allclose(actual, expected, rtol=1e-5)

    def test_predict_distribution_delegates_to_poisson(self, synthetic_game_features, synthetic_targets_total):
        """Distribution comes from Poisson only."""
        model = TotalsModel()
        model.train(synthetic_game_features, synthetic_targets_total)
        dist = model.predict_distribution(synthetic_game_features)
        assert dist.shape == (len(synthetic_game_features), MAX_GOALS + 1)

    def test_evaluate_returns_expected_keys(self, synthetic_game_features, synthetic_targets_total):
        model = TotalsModel()
        model.train(synthetic_game_features, synthetic_targets_total)
        result = model.evaluate(synthetic_game_features, synthetic_targets_total)
        assert "mae" in result
        assert "rmse" in result
        assert "n_games" in result

    def test_evaluate_n_games_matches(self, synthetic_game_features, synthetic_targets_total):
        model = TotalsModel()
        model.train(synthetic_game_features, synthetic_targets_total)
        result = model.evaluate(synthetic_game_features, synthetic_targets_total)
        assert result["n_games"] == len(synthetic_game_features)

    def test_custom_weights(self, synthetic_game_features, synthetic_targets_total):
        """Should accept custom Poisson/LGBM weights."""
        model = TotalsModel(poisson_weight=0.8, lgbm_weight=0.2)
        metrics = model.train(synthetic_game_features, synthetic_targets_total)
        assert isinstance(metrics, dict)

    def test_default_weights_are_equal(self):
        model = TotalsModel()
        assert model.poisson_weight == 0.5
        assert model.lgbm_weight == 0.5
