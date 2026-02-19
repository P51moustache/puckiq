"""
Tests for ml/models/baselines.py — baseline models for comparison.

Tests NaiveBaseline, FavoriteBaseline, and SimpleLogisticBaseline.
"""

import numpy as np
import pandas as pd
import pytest

from ml.models.baselines import (
    FavoriteBaseline,
    NaiveBaseline,
    SimpleLogisticBaseline,
    evaluate_baselines,
)


class TestNaiveBaseline:
    """Tests for NaiveBaseline — always predicts home team wins."""

    def test_evaluate_returns_expected_keys(self, synthetic_games_df):
        naive = NaiveBaseline()
        result = naive.evaluate(synthetic_games_df)
        assert "accuracy" in result
        assert "brier_score" in result
        assert "n_games" in result

    def test_accuracy_matches_home_win_rate(self, synthetic_games_df):
        """Accuracy should equal the proportion of home wins, since we always pick home."""
        naive = NaiveBaseline()
        result = naive.evaluate(synthetic_games_df)
        actual_home_wins = (synthetic_games_df["home_score"] > synthetic_games_df["away_score"]).mean()
        assert abs(result["accuracy"] - actual_home_wins) < 1e-9

    def test_n_games_correct(self, synthetic_games_df):
        naive = NaiveBaseline()
        result = naive.evaluate(synthetic_games_df)
        assert result["n_games"] == len(synthetic_games_df)

    def test_predicts_home_always(self):
        """With all home wins, accuracy should be 1.0."""
        df = pd.DataFrame({"home_score": [5, 4, 3], "away_score": [1, 2, 1]})
        naive = NaiveBaseline()
        result = naive.evaluate(df)
        assert result["accuracy"] == 1.0

    def test_all_away_wins(self):
        """With all away wins, accuracy should be 0.0."""
        df = pd.DataFrame({"home_score": [1, 2, 1], "away_score": [5, 4, 3]})
        naive = NaiveBaseline()
        result = naive.evaluate(df)
        assert result["accuracy"] == 0.0

    def test_brier_score_for_certain_predictions(self):
        """Predicting 1.0 probability when all are home wins should give Brier = 0."""
        df = pd.DataFrame({"home_score": [5, 4, 3], "away_score": [1, 2, 1]})
        naive = NaiveBaseline()
        result = naive.evaluate(df)
        assert result["brier_score"] == 0.0


class TestFavoriteBaseline:
    """Tests for FavoriteBaseline — picks team with higher point percentage."""

    def test_evaluate_returns_expected_keys(self, synthetic_games_df, synthetic_features_with_pctg):
        fav = FavoriteBaseline()
        result = fav.evaluate(synthetic_games_df, synthetic_features_with_pctg)
        assert "accuracy" in result
        assert "brier_score" in result
        assert "n_games" in result

    def test_picks_higher_pctg_team(self):
        """When home team always has higher pctg and always wins, accuracy = 1.0."""
        games = pd.DataFrame({"home_score": [5, 4], "away_score": [1, 2]})
        features = pd.DataFrame({
            "home_point_pctg": [0.8, 0.7],
            "away_point_pctg": [0.4, 0.3],
        })
        fav = FavoriteBaseline()
        result = fav.evaluate(games, features)
        assert result["accuracy"] == 1.0

    def test_wrong_when_underdog_wins(self):
        """When away team (lower pctg) wins all games, accuracy = 0.0."""
        games = pd.DataFrame({"home_score": [1, 2], "away_score": [5, 4]})
        features = pd.DataFrame({
            "home_point_pctg": [0.8, 0.7],
            "away_point_pctg": [0.4, 0.3],
        })
        fav = FavoriteBaseline()
        result = fav.evaluate(games, features)
        assert result["accuracy"] == 0.0

    def test_equal_pctg_predicts_home(self):
        """When point percentages are equal, should predict home (>= comparison)."""
        games = pd.DataFrame({"home_score": [3], "away_score": [2]})
        features = pd.DataFrame({
            "home_point_pctg": [0.5],
            "away_point_pctg": [0.5],
        })
        fav = FavoriteBaseline()
        result = fav.evaluate(games, features)
        assert result["accuracy"] == 1.0

    def test_n_games_correct(self, synthetic_games_df, synthetic_features_with_pctg):
        fav = FavoriteBaseline()
        result = fav.evaluate(synthetic_games_df, synthetic_features_with_pctg)
        assert result["n_games"] == len(synthetic_games_df)

    def test_brier_score_in_range(self, synthetic_games_df, synthetic_features_with_pctg):
        fav = FavoriteBaseline()
        result = fav.evaluate(synthetic_games_df, synthetic_features_with_pctg)
        assert 0.0 <= result["brier_score"] <= 1.0


class TestSimpleLogisticBaseline:
    """Tests for SimpleLogisticBaseline — logistic regression with 5 features."""

    def test_has_expected_features(self):
        logistic = SimpleLogisticBaseline()
        assert "home_point_pctg" in logistic.FEATURES
        assert "away_point_pctg" in logistic.FEATURES
        assert "rest_advantage" in logistic.FEATURES

    def test_fit_and_predict(self, synthetic_game_features, synthetic_targets_binary):
        logistic = SimpleLogisticBaseline()
        logistic.fit(synthetic_game_features, synthetic_targets_binary)
        preds = logistic.predict(synthetic_game_features)
        assert len(preds) == len(synthetic_game_features)
        assert set(preds).issubset({0, 1})

    def test_predict_proba(self, synthetic_game_features, synthetic_targets_binary):
        logistic = SimpleLogisticBaseline()
        logistic.fit(synthetic_game_features, synthetic_targets_binary)
        probs = logistic.predict_proba(synthetic_game_features)
        assert len(probs) == len(synthetic_game_features)
        assert np.all(probs >= 0)
        assert np.all(probs <= 1)

    def test_evaluate_returns_keys(self, synthetic_game_features, synthetic_targets_binary):
        logistic = SimpleLogisticBaseline()
        logistic.fit(synthetic_game_features, synthetic_targets_binary)
        result = logistic.evaluate(synthetic_game_features, synthetic_targets_binary)
        assert "accuracy" in result
        assert "brier_score" in result
        assert "n_games" in result

    def test_handles_nan_in_features(self, synthetic_targets_binary):
        """Logistic baseline should fillna(0) and not crash on NaN."""
        np.random.seed(42)
        n = len(synthetic_targets_binary)
        features = pd.DataFrame({
            "home_point_pctg": [np.nan] * n,  # All NaN
            "away_point_pctg": np.random.uniform(0.3, 0.8, n),
            "rest_advantage": np.random.choice([-1, 0, 1], n).astype(float),
            "home_starter_save_pctg": np.random.uniform(0.88, 0.94, n),
            "away_starter_save_pctg": np.random.uniform(0.88, 0.94, n),
        })
        logistic = SimpleLogisticBaseline()
        logistic.fit(features, synthetic_targets_binary)
        preds = logistic.predict(features)
        assert len(preds) == n


class TestEvaluateBaselines:
    """Tests for the evaluate_baselines convenience function."""

    def test_returns_all_three_baselines(self, synthetic_games_df, synthetic_features_with_pctg):
        results = evaluate_baselines(synthetic_games_df, synthetic_features_with_pctg)
        assert "naive_home" in results
        assert "favorite" in results
        assert "logistic" in results

    def test_each_baseline_has_accuracy(self, synthetic_games_df, synthetic_features_with_pctg):
        results = evaluate_baselines(synthetic_games_df, synthetic_features_with_pctg)
        for name, metrics in results.items():
            assert "accuracy" in metrics, f"Baseline '{name}' missing accuracy"

    def test_accuracies_in_valid_range(self, synthetic_games_df, synthetic_features_with_pctg):
        results = evaluate_baselines(synthetic_games_df, synthetic_features_with_pctg)
        for name, metrics in results.items():
            assert 0.0 <= metrics["accuracy"] <= 1.0, f"Baseline '{name}' accuracy out of range"

    def test_too_few_games_for_logistic(self):
        """With too few games, logistic baseline should return default metrics."""
        from ml.features.registry import generate_synthetic_features
        games = pd.DataFrame({
            "home_score": [3, 2],
            "away_score": [1, 4],
            "home_team_abbrev": ["TOR", "BOS"],
            "away_team_abbrev": ["MTL", "NYR"],
            "game_date": ["2025-10-10", "2025-10-11"],
        })
        features = generate_synthetic_features(n=2, model_type="game_winner", seed=99)
        results = evaluate_baselines(games, features)
        assert results["logistic"]["n_games"] == 0
