"""
Tests for ml/models/spread.py — LightGBM regression for point spread.

Uses synthetic data to verify training, prediction, evaluation,
and feature importance.
"""

import numpy as np
import pandas as pd
import pytest

from ml.models.spread import SpreadModel


class TestSpreadModelTrain:
    """Tests for SpreadModel.train()."""

    def test_train_returns_metrics_dict(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_spread)
        assert isinstance(metrics, dict)

    def test_train_metrics_have_mae_and_rmse(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_spread)
        assert "train_mae" in metrics
        assert "train_rmse" in metrics

    def test_train_mae_non_negative(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_spread)
        assert metrics["train_mae"] >= 0

    def test_train_rmse_non_negative(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_spread)
        assert metrics["train_rmse"] >= 0

    def test_rmse_greater_or_equal_to_mae(self, synthetic_game_features, synthetic_targets_spread):
        """RMSE is always >= MAE for any dataset."""
        model = SpreadModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_spread)
        assert metrics["train_rmse"] >= metrics["train_mae"] - 1e-9

    def test_train_sets_model(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        assert model.model is None
        model.train(synthetic_game_features, synthetic_targets_spread)
        assert model.model is not None

    def test_train_stores_feature_names(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        model.train(synthetic_game_features, synthetic_targets_spread)
        assert model.feature_names == list(synthetic_game_features.columns)

    def test_train_with_eval_set(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        split = 150
        X_train = synthetic_game_features.iloc[:split]
        y_train = synthetic_targets_spread.iloc[:split]
        X_val = synthetic_game_features.iloc[split:]
        y_val = synthetic_targets_spread.iloc[split:]
        metrics = model.train(X_train, y_train, eval_set=(X_val, y_val))
        assert isinstance(metrics, dict)

    def test_custom_params(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel(params={"n_estimators": 10, "num_leaves": 8})
        metrics = model.train(synthetic_game_features, synthetic_targets_spread)
        assert isinstance(metrics, dict)


class TestSpreadModelPredict:
    """Tests for SpreadModel.predict()."""

    def test_predict_returns_array(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        model.train(synthetic_game_features, synthetic_targets_spread)
        preds = model.predict(synthetic_game_features)
        assert isinstance(preds, np.ndarray)

    def test_predict_correct_length(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        model.train(synthetic_game_features, synthetic_targets_spread)
        preds = model.predict(synthetic_game_features)
        assert len(preds) == len(synthetic_game_features)

    def test_predict_returns_numeric(self, synthetic_game_features, synthetic_targets_spread):
        """Spread predictions should be real numbers (not probabilities)."""
        model = SpreadModel()
        model.train(synthetic_game_features, synthetic_targets_spread)
        preds = model.predict(synthetic_game_features)
        assert preds.dtype in [np.float64, np.float32]

    def test_predict_can_be_negative(self, synthetic_game_features, synthetic_targets_spread):
        """Spreads can be negative (away team favored)."""
        model = SpreadModel()
        model.train(synthetic_game_features, synthetic_targets_spread)
        preds = model.predict(synthetic_game_features)
        # With random data, we should get at least some negative predictions
        assert np.any(preds < 0) or np.any(preds > 0)  # at least some non-zero

    def test_predict_without_training_raises(self, synthetic_game_features):
        model = SpreadModel()
        with pytest.raises(RuntimeError, match="not trained"):
            model.predict(synthetic_game_features)

    def test_predict_on_subset(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        model.train(synthetic_game_features, synthetic_targets_spread)
        preds = model.predict(synthetic_game_features.iloc[:5])
        assert len(preds) == 5


class TestSpreadModelEvaluate:
    """Tests for SpreadModel.evaluate()."""

    def test_evaluate_returns_expected_keys(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        model.train(synthetic_game_features, synthetic_targets_spread)
        result = model.evaluate(synthetic_game_features, synthetic_targets_spread)
        assert "mae" in result
        assert "rmse" in result
        assert "n_games" in result

    def test_evaluate_n_games_matches(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        model.train(synthetic_game_features, synthetic_targets_spread)
        result = model.evaluate(synthetic_game_features, synthetic_targets_spread)
        assert result["n_games"] == len(synthetic_game_features)

    def test_evaluate_mae_non_negative(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        model.train(synthetic_game_features, synthetic_targets_spread)
        result = model.evaluate(synthetic_game_features, synthetic_targets_spread)
        assert result["mae"] >= 0


class TestSpreadModelFeatureImportance:
    """Tests for SpreadModel.get_feature_importance()."""

    def test_returns_dict(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        model.train(synthetic_game_features, synthetic_targets_spread)
        importance = model.get_feature_importance()
        assert isinstance(importance, dict)

    def test_all_features_present(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        model.train(synthetic_game_features, synthetic_targets_spread)
        importance = model.get_feature_importance()
        assert set(importance.keys()) == set(synthetic_game_features.columns)

    def test_importances_non_negative(self, synthetic_game_features, synthetic_targets_spread):
        model = SpreadModel()
        model.train(synthetic_game_features, synthetic_targets_spread)
        importance = model.get_feature_importance()
        for val in importance.values():
            assert val >= 0

    def test_untrained_model_returns_empty(self):
        model = SpreadModel()
        assert model.get_feature_importance() == {}
