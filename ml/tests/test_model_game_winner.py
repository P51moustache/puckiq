"""
Tests for ml/models/game_winner.py — LightGBM binary classifier.

Uses synthetic data from conftest.py to verify training, prediction,
evaluation, and feature importance without real NHL data.
"""

import numpy as np
import pandas as pd
import pytest

from ml.models.game_winner import GameWinnerModel


class TestGameWinnerTrain:
    """Tests for GameWinnerModel.train()."""

    def test_train_returns_metrics_dict(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_binary)
        assert isinstance(metrics, dict)

    def test_train_metrics_have_expected_keys(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_binary)
        assert "train_accuracy" in metrics
        assert "train_brier" in metrics
        assert "train_log_loss" in metrics

    def test_train_accuracy_in_valid_range(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_binary)
        assert 0.0 <= metrics["train_accuracy"] <= 1.0

    def test_train_brier_in_valid_range(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_binary)
        assert 0.0 <= metrics["train_brier"] <= 1.0

    def test_train_log_loss_positive(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        metrics = model.train(synthetic_game_features, synthetic_targets_binary)
        assert metrics["train_log_loss"] > 0

    def test_train_sets_model(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        assert model.model is None
        model.train(synthetic_game_features, synthetic_targets_binary)
        assert model.model is not None

    def test_train_stores_feature_names(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        assert model.feature_names == list(synthetic_game_features.columns)

    def test_train_with_eval_set(self, synthetic_game_features, synthetic_targets_binary):
        """Training with an eval_set should enable early stopping."""
        model = GameWinnerModel()
        split = 150
        X_train = synthetic_game_features.iloc[:split]
        y_train = synthetic_targets_binary.iloc[:split]
        X_val = synthetic_game_features.iloc[split:]
        y_val = synthetic_targets_binary.iloc[split:]
        metrics = model.train(X_train, y_train, eval_set=(X_val, y_val))
        assert isinstance(metrics, dict)
        assert "train_accuracy" in metrics

    def test_custom_params(self, synthetic_game_features, synthetic_targets_binary):
        """Custom LightGBM params should override defaults."""
        model = GameWinnerModel(params={"n_estimators": 10, "num_leaves": 8})
        metrics = model.train(synthetic_game_features, synthetic_targets_binary)
        assert isinstance(metrics, dict)


class TestGameWinnerPredict:
    """Tests for GameWinnerModel.predict()."""

    def test_predict_returns_array(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        preds = model.predict(synthetic_game_features)
        assert isinstance(preds, np.ndarray)

    def test_predict_probabilities_in_range(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        preds = model.predict(synthetic_game_features)
        assert np.all(preds >= 0.0)
        assert np.all(preds <= 1.0)

    def test_predict_correct_length(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        preds = model.predict(synthetic_game_features)
        assert len(preds) == len(synthetic_game_features)

    def test_predict_without_training_raises(self, synthetic_game_features):
        model = GameWinnerModel()
        with pytest.raises(RuntimeError, match="not trained"):
            model.predict(synthetic_game_features)

    def test_predict_on_subset(self, synthetic_game_features, synthetic_targets_binary):
        """Should handle prediction on fewer rows than training."""
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        preds = model.predict(synthetic_game_features.iloc[:10])
        assert len(preds) == 10


class TestGameWinnerPredictClass:
    """Tests for GameWinnerModel.predict_class()."""

    def test_predict_class_returns_binary(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        preds = model.predict_class(synthetic_game_features)
        unique_vals = set(preds)
        assert unique_vals.issubset({0, 1})

    def test_predict_class_correct_length(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        preds = model.predict_class(synthetic_game_features)
        assert len(preds) == len(synthetic_game_features)

    def test_predict_class_without_training_raises(self, synthetic_game_features):
        model = GameWinnerModel()
        with pytest.raises(RuntimeError, match="not trained"):
            model.predict_class(synthetic_game_features)


class TestGameWinnerEvaluate:
    """Tests for GameWinnerModel.evaluate()."""

    def test_evaluate_returns_expected_keys(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        result = model.evaluate(synthetic_game_features, synthetic_targets_binary)
        assert "accuracy" in result
        assert "brier_score" in result
        assert "log_loss" in result
        assert "n_games" in result

    def test_evaluate_n_games_matches(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        result = model.evaluate(synthetic_game_features, synthetic_targets_binary)
        assert result["n_games"] == len(synthetic_game_features)

    def test_evaluate_accuracy_in_range(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        result = model.evaluate(synthetic_game_features, synthetic_targets_binary)
        assert 0.0 <= result["accuracy"] <= 1.0


class TestGameWinnerFeatureImportance:
    """Tests for GameWinnerModel.get_feature_importance()."""

    def test_returns_dict(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        importance = model.get_feature_importance()
        assert isinstance(importance, dict)

    def test_all_features_present(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        importance = model.get_feature_importance()
        assert set(importance.keys()) == set(synthetic_game_features.columns)

    def test_importances_non_negative(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        importance = model.get_feature_importance()
        for val in importance.values():
            assert val >= 0

    def test_untrained_model_returns_empty(self):
        model = GameWinnerModel()
        assert model.get_feature_importance() == {}

    def test_sorted_descending(self, synthetic_game_features, synthetic_targets_binary):
        model = GameWinnerModel()
        model.train(synthetic_game_features, synthetic_targets_binary)
        importance = model.get_feature_importance()
        values = list(importance.values())
        assert values == sorted(values, reverse=True)
