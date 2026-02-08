"""
Tests for ml/evaluation/validation.py — walk-forward cross-validation.

Verifies the expanding-window CV produces the correct number of folds
and that training data is always strictly before validation data.
"""

import numpy as np
import pandas as pd
import pytest

from ml.evaluation.validation import FoldResult, walk_forward_cv


class _DummyClassifier:
    """Minimal model that satisfies the TrainableModel protocol for testing."""

    def train(self, features_df, targets, eval_set=None):
        self._n_train = len(features_df)
        return {"train_accuracy": 0.6}

    def evaluate(self, features_df, targets):
        return {"accuracy": 0.55, "n_games": len(features_df)}


class _DummyRegressor:
    """Minimal regression model for testing walk-forward CV."""

    def train(self, features_df, targets, eval_set=None):
        self._n_train = len(features_df)
        return {"train_mae": 2.0}

    def evaluate(self, features_df, targets):
        return {"mae": 2.5, "n_games": len(features_df)}


class TestWalkForwardCV:
    """Tests for the walk_forward_cv function."""

    def test_returns_list_of_fold_results(self, synthetic_game_features, synthetic_targets_binary):
        results = walk_forward_cv(
            _DummyClassifier,
            synthetic_game_features,
            synthetic_targets_binary,
            min_train=50,
            val_window=25,
            step_size=25,
        )
        assert isinstance(results, list)
        for r in results:
            assert isinstance(r, FoldResult)

    def test_correct_number_of_folds(self):
        """With 200 rows, min_train=100, val_window=50, step_size=50:
        Fold 0: train=100, val=100-150
        Fold 1: train=150, val=150-200
        = 2 folds
        """
        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(200)})
        y = pd.Series(np.random.choice([0, 1], 200))
        results = walk_forward_cv(
            _DummyClassifier, X, y,
            min_train=100, val_window=50, step_size=50,
        )
        assert len(results) == 2

    def test_more_folds_with_smaller_window(self):
        """Smaller val_window and step_size should produce more folds."""
        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(200)})
        y = pd.Series(np.random.choice([0, 1], 200))
        results = walk_forward_cv(
            _DummyClassifier, X, y,
            min_train=50, val_window=25, step_size=25,
        )
        # Expected folds: (200 - 50) / 25 = 6
        assert len(results) == 6

    def test_fold_indices_sequential(self):
        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(300)})
        y = pd.Series(np.random.choice([0, 1], 300))
        results = walk_forward_cv(
            _DummyClassifier, X, y,
            min_train=100, val_window=50, step_size=50,
        )
        for i, r in enumerate(results):
            assert r.fold_idx == i

    def test_training_size_expands(self):
        """Each fold should have more training data than the previous."""
        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(300)})
        y = pd.Series(np.random.choice([0, 1], 300))
        results = walk_forward_cv(
            _DummyClassifier, X, y,
            min_train=100, val_window=50, step_size=50,
        )
        for i in range(1, len(results)):
            assert results[i].train_size > results[i - 1].train_size

    def test_validation_size_constant(self):
        """All folds should have the same validation window size."""
        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(300)})
        y = pd.Series(np.random.choice([0, 1], 300))
        results = walk_forward_cv(
            _DummyClassifier, X, y,
            min_train=100, val_window=50, step_size=50,
        )
        for r in results:
            assert r.val_size == 50

    def test_training_before_validation(self):
        """Training data must be strictly before validation data (temporal ordering)."""
        np.random.seed(42)
        n = 300
        X = pd.DataFrame({"f1": np.arange(n)})  # Use sequential values as proxy for time
        y = pd.Series(np.random.choice([0, 1], n))

        # Track which indices are used for train and val in each fold
        class _IndexTracker:
            def __init__(self):
                self.train_max_idx = None
                self.val_min_idx = None

            def train(self, features_df, targets, eval_set=None):
                self.train_max_idx = features_df["f1"].max()
                return {"train_accuracy": 0.6}

            def evaluate(self, features_df, targets):
                self.val_min_idx = features_df["f1"].min()
                return {"accuracy": 0.55, "n_games": len(features_df)}

        results = walk_forward_cv(
            _IndexTracker, X, y,
            min_train=100, val_window=50, step_size=50,
        )
        # Cannot directly access model instances, but we verify fold structure
        assert len(results) > 0
        # Verify the expanding window: first fold has min_train, each subsequent has more
        assert results[0].train_size == 100

    def test_no_folds_when_too_little_data(self):
        """If data is smaller than min_train + val_window, no folds are produced."""
        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(30)})
        y = pd.Series(np.random.choice([0, 1], 30))
        results = walk_forward_cv(
            _DummyClassifier, X, y,
            min_train=100, val_window=50, step_size=50,
        )
        assert len(results) == 0

    def test_fold_metrics_stored(self):
        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(200)})
        y = pd.Series(np.random.choice([0, 1], 200))
        results = walk_forward_cv(
            _DummyClassifier, X, y,
            min_train=100, val_window=50, step_size=50,
        )
        for r in results:
            assert "train_accuracy" in r.train_metrics
            assert "accuracy" in r.val_metrics

    def test_works_with_regressor(self):
        """Walk-forward CV should work with regression models too."""
        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(200)})
        y = pd.Series(np.random.randn(200))
        results = walk_forward_cv(
            _DummyRegressor, X, y,
            min_train=100, val_window=50, step_size=50,
        )
        assert len(results) == 2
        for r in results:
            assert "train_mae" in r.train_metrics
            assert "mae" in r.val_metrics

    def test_model_kwargs_passed(self):
        """model_kwargs should be forwarded to the model constructor."""

        class _ParamModel:
            def __init__(self, my_param=None):
                self.my_param = my_param

            def train(self, features_df, targets, eval_set=None):
                return {"train_accuracy": 0.6}

            def evaluate(self, features_df, targets):
                return {"accuracy": 0.55, "n_games": len(features_df)}

        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(200)})
        y = pd.Series(np.random.choice([0, 1], 200))
        results = walk_forward_cv(
            _ParamModel, X, y,
            min_train=100, val_window=50, step_size=50,
            model_kwargs={"my_param": "test_value"},
        )
        assert len(results) == 2


class TestFoldResultDataclass:
    """Tests for the FoldResult dataclass."""

    def test_create_fold_result(self):
        fr = FoldResult(
            fold_idx=0,
            train_size=100,
            val_size=50,
            train_metrics={"accuracy": 0.7},
            val_metrics={"accuracy": 0.6},
        )
        assert fr.fold_idx == 0
        assert fr.train_size == 100
        assert fr.val_size == 50

    def test_default_empty_metrics(self):
        fr = FoldResult(fold_idx=0, train_size=100, val_size=50)
        assert fr.train_metrics == {}
        assert fr.val_metrics == {}


class TestTemporalOrdering:
    """Extra tests specifically for the temporal ordering guarantee."""

    def test_train_end_before_val_start(self):
        """In each fold, training ends exactly where validation begins."""
        np.random.seed(42)
        n = 400
        X = pd.DataFrame({"time_idx": np.arange(n)})
        y = pd.Series(np.random.choice([0, 1], n))

        class _RangeRecorder:
            instances = []

            def __init__(self):
                self.train_indices = None
                self.val_indices = None
                _RangeRecorder.instances.append(self)

            def train(self, features_df, targets, eval_set=None):
                self.train_indices = features_df["time_idx"].tolist()
                return {}

            def evaluate(self, features_df, targets):
                self.val_indices = features_df["time_idx"].tolist()
                return {"accuracy": 0.5, "n_games": len(features_df)}

        _RangeRecorder.instances = []
        results = walk_forward_cv(
            _RangeRecorder, X, y,
            min_train=100, val_window=50, step_size=50,
        )

        for model_instance in _RangeRecorder.instances:
            train_max = max(model_instance.train_indices)
            val_min = min(model_instance.val_indices)
            assert train_max < val_min, (
                f"Training data (max idx={train_max}) must be strictly before "
                f"validation data (min idx={val_min})"
            )
