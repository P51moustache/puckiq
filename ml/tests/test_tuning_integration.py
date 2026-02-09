"""Integration tests for Optuna tuning wired into the weekly retrain pipeline."""

import numpy as np
import pandas as pd
import pytest

from ml.config import ModelType
from ml.evaluation.validation import walk_forward_cv
from ml.features.registry import generate_synthetic_features
from ml.models.game_winner import GameWinnerModel
from ml.models.spread import SpreadModel
from ml.tuning.optuna_tuner import tune_model


@pytest.fixture
def synthetic_game_winner_data():
    """Synthetic data for game_winner model with targets."""
    np.random.seed(42)
    features = generate_synthetic_features(n=250, model_type="game_winner")
    targets = pd.Series(np.random.choice([0, 1], len(features)))
    return features, targets


@pytest.fixture
def synthetic_spread_data():
    """Synthetic data for spread model with targets."""
    np.random.seed(42)
    features = generate_synthetic_features(n=250, model_type="spread")
    targets = pd.Series(np.random.uniform(-5, 5, len(features)))
    return features, targets


class TestTuningProducesValidParams:
    def test_game_winner_tuned_params_are_nonempty(self, synthetic_game_winner_data):
        """When ENABLE_TUNING is True, tuned params should be generated and non-empty."""
        features, targets = synthetic_game_winner_data
        result = tune_model(
            model_type=ModelType.GAME_WINNER,
            features_df=features,
            targets=targets,
            n_trials=2,
            min_train=80,
            val_window=30,
            step_size=30,
        )
        assert result["best_params"]
        assert len(result["best_params"]) > 0
        assert "num_leaves" in result["best_params"]
        assert "learning_rate" in result["best_params"]

    def test_spread_tuned_params_are_nonempty(self, synthetic_spread_data):
        """Spread model tuning should also produce valid params."""
        features, targets = synthetic_spread_data
        result = tune_model(
            model_type=ModelType.SPREAD,
            features_df=features,
            targets=targets,
            n_trials=2,
            min_train=80,
            val_window=30,
            step_size=30,
        )
        assert result["best_params"]
        assert "num_leaves" in result["best_params"]


class TestTunedParamsPassToModels:
    def test_game_winner_accepts_tuned_params(self, synthetic_game_winner_data):
        """GameWinnerModel should accept tuned params and train successfully."""
        features, targets = synthetic_game_winner_data
        result = tune_model(
            model_type=ModelType.GAME_WINNER,
            features_df=features,
            targets=targets,
            n_trials=2,
            min_train=80,
            val_window=30,
            step_size=30,
        )
        best_params = result["best_params"]

        model = GameWinnerModel(params=best_params)
        train_metrics = model.train(features, targets)
        assert "train_accuracy" in train_metrics

        preds = model.predict(features)
        assert len(preds) == len(features)
        assert all(0 <= p <= 1 for p in preds)

    def test_spread_accepts_tuned_params(self, synthetic_spread_data):
        """SpreadModel should accept tuned params and train successfully."""
        features, targets = synthetic_spread_data
        result = tune_model(
            model_type=ModelType.SPREAD,
            features_df=features,
            targets=targets,
            n_trials=2,
            min_train=80,
            val_window=30,
            step_size=30,
        )
        best_params = result["best_params"]

        model = SpreadModel(params=best_params)
        train_metrics = model.train(features, targets)
        assert "train_mae" in train_metrics

        preds = model.predict(features)
        assert len(preds) == len(features)


class TestWalkForwardCVWithModelKwargs:
    def test_cv_with_tuned_params_game_winner(self, synthetic_game_winner_data):
        """walk_forward_cv should accept model_kwargs with tuned params."""
        features, targets = synthetic_game_winner_data
        tuned_params = {
            "num_leaves": 20,
            "learning_rate": 0.05,
            "n_estimators": 80,
            "min_child_samples": 15,
            "reg_alpha": 0.05,
            "reg_lambda": 0.05,
            "objective": "binary",
            "metric": "binary_logloss",
            "verbose": -1,
        }

        folds = walk_forward_cv(
            GameWinnerModel,
            features,
            targets,
            min_train=80,
            val_window=30,
            step_size=30,
            model_kwargs={"params": tuned_params},
        )
        assert len(folds) > 0
        for fold in folds:
            assert "accuracy" in fold.val_metrics or "brier_score" in fold.val_metrics

    def test_cv_without_model_kwargs_still_works(self, synthetic_game_winner_data):
        """walk_forward_cv should still work with default params (no model_kwargs)."""
        features, targets = synthetic_game_winner_data
        folds = walk_forward_cv(
            GameWinnerModel,
            features,
            targets,
            min_train=80,
            val_window=30,
            step_size=30,
        )
        assert len(folds) > 0


class TestTuningFallbackBehavior:
    def test_model_works_with_none_params(self):
        """When ENABLE_TUNING is False, best_params is None and models use defaults."""
        best_params = None
        model_kwargs = {"params": best_params} if best_params else {}

        # model_kwargs should be empty when no tuning
        assert model_kwargs == {}

        # Model should construct fine with empty kwargs
        model = GameWinnerModel(**model_kwargs)
        assert model is not None

    def test_model_kwargs_constructed_correctly_with_params(self):
        """When tuning produces params, model_kwargs should wrap them correctly."""
        best_params = {"num_leaves": 25, "learning_rate": 0.05}
        model_kwargs = {"params": best_params} if best_params else {}

        assert model_kwargs == {"params": {"num_leaves": 25, "learning_rate": 0.05}}
        model = GameWinnerModel(**model_kwargs)
        assert model.params["num_leaves"] == 25
        assert model.params["learning_rate"] == 0.05
