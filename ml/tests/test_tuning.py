"""Tests for ml/tuning/optuna_tuner.py — hyperparameter tuning."""

import numpy as np
import pandas as pd
import pytest

from ml.config import ModelType
from ml.tuning.optuna_tuner import tune_model, _suggest_lgbm_params


class TestSuggestParams:
    def test_returns_expected_keys(self):
        """Suggested params should include all tunable hyperparameters."""
        import optuna
        study = optuna.create_study()
        trial = study.ask()
        params = _suggest_lgbm_params(trial)
        expected_keys = {
            "num_leaves", "max_depth", "learning_rate", "n_estimators",
            "min_child_samples", "min_split_gain", "reg_alpha", "reg_lambda",
            "subsample", "colsample_bytree",
        }
        assert set(params.keys()) == expected_keys

    def test_param_ranges_valid(self):
        import optuna
        study = optuna.create_study()
        trial = study.ask()
        params = _suggest_lgbm_params(trial)
        assert 15 <= params["num_leaves"] <= 63
        assert 0.005 <= params["learning_rate"] <= 0.3
        assert 100 <= params["n_estimators"] <= 500


class TestTuneModel:
    @pytest.fixture
    def small_dataset(self):
        """Minimal dataset for fast tuning tests."""
        np.random.seed(42)
        n = 200
        features = pd.DataFrame({
            "f1": np.random.uniform(0, 1, n),
            "f2": np.random.uniform(0, 1, n),
            "f3": np.random.uniform(0, 1, n),
        })
        targets = pd.Series(np.random.choice([0, 1], n))
        return features, targets

    def test_tune_returns_best_params(self, small_dataset):
        features, targets = small_dataset
        result = tune_model(
            model_type=ModelType.GAME_WINNER,
            features_df=features,
            targets=targets,
            n_trials=3,  # Minimal for speed
            min_train=80,
            val_window=30,
            step_size=30,
        )
        assert "best_params" in result
        assert "best_value" in result
        assert "num_leaves" in result["best_params"]

    def test_tune_returns_metadata(self, small_dataset):
        features, targets = small_dataset
        result = tune_model(
            model_type=ModelType.GAME_WINNER,
            features_df=features,
            targets=targets,
            n_trials=2,
            min_train=80,
            val_window=30,
            step_size=30,
        )
        assert result["model_type"] == ModelType.GAME_WINNER
        assert result["n_trials"] == 2
        assert result["metric_name"] == "brier_score"
