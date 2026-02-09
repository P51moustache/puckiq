"""
End-to-end integration test for the ML pipeline.

Verifies the full training → evaluation → scoring flow works without
Supabase by using synthetic data throughout. This catches interface
mismatches between modules that unit tests miss.
"""

import numpy as np
import pandas as pd
import pytest

from ml.config import ModelType
from ml.evaluation.calibration import compute_calibration_buckets, compute_ece
from ml.evaluation.confidence import bootstrap_ci
from ml.evaluation.overfitting import detect_overfitting
from ml.evaluation.validation import FoldResult, detect_concept_drift, walk_forward_cv
from ml.models.game_winner import GameWinnerModel
from ml.models.spread import SpreadModel
from ml.models.totals import TotalsModel


@pytest.fixture
def chronological_dataset():
    """
    Synthetic dataset simulating a season of games.

    300 games, chronologically ordered, with features and targets for
    all three model types (game_winner, spread, totals).
    Auto-discovers features from features.yaml.
    """
    from ml.features.registry import generate_synthetic_features

    np.random.seed(42)
    n = 300

    features = generate_synthetic_features(n=n, model_type="game_winner", seed=42)

    targets_binary = pd.Series(
        np.random.choice([0, 1], n, p=[0.45, 0.55]), name="home_win"
    )
    home_scores = np.random.poisson(3, n)
    away_scores = np.random.poisson(2.7, n)
    targets_spread = pd.Series(home_scores - away_scores, name="spread", dtype=float)
    targets_total = pd.Series(home_scores + away_scores, name="total_goals")

    return features, targets_binary, targets_spread, targets_total


class TestEndToEndGameWinner:
    """Full pipeline test: train → CV → evaluate → calibrate → drift check."""

    def test_full_pipeline(self, chronological_dataset):
        features, targets_binary, _, _ = chronological_dataset

        # 1. Walk-forward CV
        fold_results = walk_forward_cv(
            model_class=GameWinnerModel,
            features_df=features,
            targets=targets_binary,
            min_train=100,
            val_window=50,
            step_size=50,
        )
        assert len(fold_results) >= 2
        for fr in fold_results:
            assert "accuracy" in fr.val_metrics
            assert "brier_score" in fr.val_metrics

        # 2. Train final model on all data
        model = GameWinnerModel()
        train_metrics = model.train(features, targets_binary)
        assert "train_accuracy" in train_metrics
        assert "train_brier" in train_metrics

        # 3. Evaluate on the last chunk (simulating holdout)
        holdout_X = features.iloc[-50:]
        holdout_y = targets_binary.iloc[-50:]
        eval_metrics = model.evaluate(holdout_X, holdout_y)
        assert "accuracy" in eval_metrics
        assert "brier_score" in eval_metrics
        assert eval_metrics["n_games"] == 50

        # 4. Overfitting check
        overfit = detect_overfitting(train_metrics, eval_metrics)
        assert "is_overfitting" in overfit
        assert "thresholds_used" in overfit

        # 5. Calibration
        probs = model.predict(holdout_X)
        buckets = compute_calibration_buckets(probs, holdout_y.values)
        assert len(buckets) == 10
        ece = compute_ece(probs, holdout_y.values)
        assert 0.0 <= ece <= 1.0

        # 6. Confidence intervals
        from sklearn.metrics import accuracy_score
        ci = bootstrap_ci(
            holdout_y.values,
            model.predict_class(holdout_X),
            lambda yt, yp: float(accuracy_score(yt, yp)),
            n_bootstrap=200,
        )
        assert ci["ci_lower"] <= ci["ci_upper"]

        # 7. Concept drift check
        drift = detect_concept_drift(fold_results, metric_name="accuracy")
        assert "drift_detected" in drift
        assert "fold_values" in drift

        # 8. Feature importance
        importance = model.get_feature_importance()
        assert len(importance) == features.shape[1]


class TestEndToEndSpread:
    """Full pipeline for spread model."""

    def test_full_pipeline(self, chronological_dataset):
        features, _, targets_spread, _ = chronological_dataset

        # Walk-forward CV
        fold_results = walk_forward_cv(
            model_class=SpreadModel,
            features_df=features,
            targets=targets_spread,
            min_train=100,
            val_window=50,
            step_size=50,
        )
        assert len(fold_results) >= 2
        for fr in fold_results:
            assert "mae" in fr.val_metrics

        # Train + evaluate
        model = SpreadModel()
        model.train(features, targets_spread)
        eval_metrics = model.evaluate(features.iloc[-50:], targets_spread.iloc[-50:])
        assert eval_metrics["mae"] >= 0
        assert eval_metrics["rmse"] >= 0

        # Overfitting with per-metric thresholds
        train_m = {"mae": 1.0}
        val_m = {"mae": eval_metrics["mae"]}
        overfit = detect_overfitting(train_m, val_m)
        assert "thresholds_used" in overfit


class TestEndToEndTotals:
    """Full pipeline for totals ensemble model."""

    def test_full_pipeline(self, chronological_dataset):
        features, _, _, targets_total = chronological_dataset

        # Train the ensemble
        model = TotalsModel()
        train_metrics = model.train(features, targets_total)
        assert "poisson_mae" in train_metrics
        assert "lgbm_mae" in train_metrics
        assert "ensemble_mae" in train_metrics

        # Evaluate
        holdout_X = features.iloc[-50:]
        holdout_y = targets_total.iloc[-50:]
        eval_metrics = model.evaluate(holdout_X, holdout_y)
        assert eval_metrics["mae"] >= 0

        # Probability distribution (Poisson component)
        dist = model.predict_distribution(holdout_X)
        assert dist.shape == (50, 13)  # 50 games x (0..12 goals)
        # Poisson truncated at MAX_GOALS=12, so sums slightly below 1.0.
        # With many features, some rows may predict high totals where truncation
        # loses more tail probability, so we allow down to 0.90.
        assert np.all(dist.sum(axis=1) > 0.90)

        # Feature importance from LightGBM component
        importance = model.get_feature_importance()
        assert len(importance) > 0


class TestCrossModelConsistency:
    """Verify models produce consistent outputs across the pipeline."""

    def test_all_models_work_with_walk_forward(self, chronological_dataset):
        features, targets_binary, targets_spread, targets_total = chronological_dataset

        configs = [
            (GameWinnerModel, targets_binary, "accuracy"),
            (SpreadModel, targets_spread, "mae"),
            (TotalsModel, targets_total, "mae"),
        ]

        for model_class, targets, metric in configs:
            folds = walk_forward_cv(
                model_class=model_class,
                features_df=features,
                targets=targets,
                min_train=100,
                val_window=50,
                step_size=50,
            )
            assert len(folds) >= 2, f"{model_class.__name__} produced too few folds"
            for fr in folds:
                assert metric in fr.val_metrics, (
                    f"{model_class.__name__} fold missing '{metric}'"
                )

    def test_overfitting_check_works_for_all_metric_types(self):
        """Per-metric thresholds should handle classifier and regressor metrics."""
        # Classifier metrics
        result = detect_overfitting(
            {"accuracy": 0.65, "brier_score": 0.22, "log_loss": 0.60},
            {"accuracy": 0.58, "brier_score": 0.25, "log_loss": 0.65},
        )
        assert "accuracy" in result["gaps"]
        assert "brier_score" in result["gaps"]

        # Regressor metrics
        result = detect_overfitting(
            {"mae": 1.5, "rmse": 2.0},
            {"mae": 1.8, "rmse": 2.3},
        )
        assert "mae" in result["gaps"]
        assert "rmse" in result["gaps"]
