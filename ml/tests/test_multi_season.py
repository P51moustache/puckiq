"""
Tests for multi-season training support (Part B).

Covers:
- TRAINING_SEASONS and SEASON_WEIGHTS config
- read_games_multi() function
- FeatureCache multi-season lookups
- Sample weights passing through walk-forward CV and model training
"""

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

from ml.config import (
    CURRENT_SEASON,
    CURRENT_SEASON_WEIGHT,
    PRIOR_SEASON_WEIGHT,
    SEASON_WEIGHTS,
    TRAINING_SEASONS,
)
from ml.evaluation.validation import walk_forward_cv
from ml.features.compute import FeatureCache


# --- Config tests ---


class TestTrainingSeasonsConfig:
    """Tests for TRAINING_SEASONS and SEASON_WEIGHTS constants."""

    def test_training_seasons_is_list(self):
        assert isinstance(TRAINING_SEASONS, list)

    def test_training_seasons_has_multiple(self):
        assert len(TRAINING_SEASONS) >= 2

    def test_current_season_in_training_seasons(self):
        assert CURRENT_SEASON in TRAINING_SEASONS

    def test_all_seasons_are_integers(self):
        for s in TRAINING_SEASONS:
            assert isinstance(s, int)
            assert s >= 20202021

    def test_seasons_are_sorted(self):
        assert TRAINING_SEASONS == sorted(TRAINING_SEASONS)

    def test_season_weights_covers_training_seasons(self):
        for s in TRAINING_SEASONS:
            assert s in SEASON_WEIGHTS, f"Season {s} missing from SEASON_WEIGHTS"

    def test_current_season_has_full_weight(self):
        assert SEASON_WEIGHTS[CURRENT_SEASON] == CURRENT_SEASON_WEIGHT

    def test_prior_seasons_have_discount(self):
        for s in TRAINING_SEASONS:
            if s != CURRENT_SEASON:
                assert SEASON_WEIGHTS[s] == PRIOR_SEASON_WEIGHT
                assert SEASON_WEIGHTS[s] < SEASON_WEIGHTS[CURRENT_SEASON]


# --- read_games_multi tests ---


class TestReadGamesMulti:
    """Tests for the read_games_multi() function."""

    @patch("ml.io.supabase_client.read_games")
    def test_concatenates_multiple_seasons(self, mock_read):
        from ml.io.supabase_client import read_games_multi

        df1 = pd.DataFrame({
            "id": [1, 2], "game_date": ["2023-10-10", "2023-10-11"], "season": [20232024, 20232024],
        })
        df2 = pd.DataFrame({
            "id": [3, 4], "game_date": ["2024-10-10", "2024-10-11"], "season": [20242025, 20242025],
        })
        mock_read.side_effect = [df1, df2]
        client = MagicMock()

        result = read_games_multi(client, [20232024, 20242025])
        assert len(result) == 4
        assert mock_read.call_count == 2

    @patch("ml.io.supabase_client.read_games")
    def test_sorted_by_game_date(self, mock_read):
        from ml.io.supabase_client import read_games_multi

        df1 = pd.DataFrame({
            "id": [1], "game_date": ["2024-10-10"], "season": [20242025],
        })
        df2 = pd.DataFrame({
            "id": [2], "game_date": ["2023-10-10"], "season": [20232024],
        })
        mock_read.side_effect = [df1, df2]
        client = MagicMock()

        result = read_games_multi(client, [20242025, 20232024])
        # Should be sorted by date regardless of input order
        assert result.iloc[0]["game_date"] == "2023-10-10"
        assert result.iloc[1]["game_date"] == "2024-10-10"

    @patch("ml.io.supabase_client.read_games")
    def test_returns_empty_when_no_data(self, mock_read):
        from ml.io.supabase_client import read_games_multi

        mock_read.return_value = pd.DataFrame()
        client = MagicMock()

        result = read_games_multi(client, [20232024])
        assert result.empty

    @patch("ml.io.supabase_client.read_games")
    def test_passes_game_state(self, mock_read):
        from ml.io.supabase_client import read_games_multi

        mock_read.return_value = pd.DataFrame()
        client = MagicMock()

        read_games_multi(client, [20252026], game_state="OFF")
        mock_read.assert_called_once_with(client, 20252026, game_state="OFF")

    @patch("ml.io.supabase_client.read_games")
    def test_skips_empty_seasons(self, mock_read):
        from ml.io.supabase_client import read_games_multi

        df1 = pd.DataFrame({
            "id": [1], "game_date": ["2024-10-10"], "season": [20242025],
        })
        mock_read.side_effect = [pd.DataFrame(), df1]
        client = MagicMock()

        result = read_games_multi(client, [20232024, 20242025])
        assert len(result) == 1


# --- FeatureCache multi-season tests ---


class TestFeatureCacheMultiSeason:
    """Tests for season-aware FeatureCache lookups."""

    def _build_multi_season_cache(self):
        cache = FeatureCache()
        cache.seasons = [20232024, 20242025, 20252026]

        # Goalie stats keyed by (team, season)
        cache.goalie_stats_by_team_season = {
            ("TOR", 20232024): [{"team_abbrev": "TOR", "games_started": 25, "save_pctg": 0.910}],
            ("TOR", 20252026): [{"team_abbrev": "TOR", "games_started": 30, "save_pctg": 0.920}],
        }
        # Also populate legacy dict for current season
        cache.goalie_stats_by_team = {
            "TOR": [{"team_abbrev": "TOR", "games_started": 30, "save_pctg": 0.920}],
        }

        # Team stat categories keyed by (team, season, category)
        cache.team_stat_categories_by_season = {
            ("TOR", 20232024, "powerplay"): [{"powerPlayPct": 22.5}],
            ("TOR", 20252026, "powerplay"): [{"powerPlayPct": 25.0}],
        }
        cache.team_stat_categories = {
            ("TOR", "powerplay"): [{"powerPlayPct": 25.0}],
        }

        return cache

    def test_goalie_stats_by_season(self):
        cache = self._build_multi_season_cache()
        result = cache.get_goalie_stats("TOR", season=20232024)
        assert len(result) == 1
        assert result[0]["save_pctg"] == 0.910

    def test_goalie_stats_current_season(self):
        cache = self._build_multi_season_cache()
        result = cache.get_goalie_stats("TOR", season=20252026)
        assert len(result) == 1
        assert result[0]["save_pctg"] == 0.920

    def test_goalie_stats_falls_back_to_legacy(self):
        """When season not in season-keyed dict, falls back to legacy."""
        cache = self._build_multi_season_cache()
        result = cache.get_goalie_stats("TOR", season=20242025)
        # Not in season dict, should fall back to legacy
        assert len(result) == 1
        assert result[0]["save_pctg"] == 0.920

    def test_goalie_stats_no_season_uses_legacy(self):
        cache = self._build_multi_season_cache()
        result = cache.get_goalie_stats("TOR")
        assert len(result) == 1
        assert result[0]["save_pctg"] == 0.920

    def test_goalie_stats_unknown_team(self):
        cache = self._build_multi_season_cache()
        assert cache.get_goalie_stats("UTA", season=20252026) == []

    def test_team_stat_category_by_season(self):
        cache = self._build_multi_season_cache()
        result = cache.get_team_stat_category("TOR", "powerplay", season=20232024)
        assert result is not None
        assert result[0]["powerPlayPct"] == 22.5

    def test_team_stat_category_falls_back_to_legacy(self):
        cache = self._build_multi_season_cache()
        result = cache.get_team_stat_category("TOR", "powerplay", season=20242025)
        assert result is not None
        assert result[0]["powerPlayPct"] == 25.0

    def test_team_stat_category_no_season_uses_legacy(self):
        cache = self._build_multi_season_cache()
        result = cache.get_team_stat_category("TOR", "powerplay")
        assert result is not None
        assert result[0]["powerPlayPct"] == 25.0


# --- Sample weights in walk-forward CV ---


class TestSampleWeightsCV:
    """Tests for sample_weights passing through walk_forward_cv."""

    def test_sample_weights_passed_to_model_train(self):
        """walk_forward_cv should pass sliced sample_weights to model.train()."""
        received_weights = []

        class _WeightCapture:
            def train(self, features_df, targets, eval_set=None, sample_weight=None):
                received_weights.append(sample_weight)
                return {"train_accuracy": 0.6}

            def evaluate(self, features_df, targets):
                return {"accuracy": 0.55, "n_games": len(features_df)}

        np.random.seed(42)
        n = 200
        X = pd.DataFrame({"f1": np.random.randn(n)})
        y = pd.Series(np.random.choice([0, 1], n))
        weights = pd.Series([0.7] * 100 + [1.0] * 100)

        results = walk_forward_cv(
            _WeightCapture, X, y,
            min_train=100, val_window=50, step_size=50,
            sample_weights=weights,
        )
        assert len(results) == 2
        # Each fold should have received weights
        for w in received_weights:
            assert w is not None

    def test_sample_weights_sliced_correctly(self):
        """Weights should be sliced to match training size per fold."""
        weight_lengths = []

        class _WeightLenCapture:
            def train(self, features_df, targets, eval_set=None, sample_weight=None):
                if sample_weight is not None:
                    weight_lengths.append(len(sample_weight))
                return {"train_accuracy": 0.6}

            def evaluate(self, features_df, targets):
                return {"accuracy": 0.55, "n_games": len(features_df)}

        np.random.seed(42)
        n = 250
        X = pd.DataFrame({"f1": np.random.randn(n)})
        y = pd.Series(np.random.choice([0, 1], n))
        weights = pd.Series(np.ones(n))

        results = walk_forward_cv(
            _WeightLenCapture, X, y,
            min_train=100, val_window=50, step_size=50,
            sample_weights=weights,
        )
        # Fold 0: train_size=100, Fold 1: train_size=150, Fold 2: train_size=200
        assert weight_lengths == [100, 150, 200]

    def test_none_weights_not_passed(self):
        """When sample_weights is None, model.train should not receive it."""
        received_kwargs = []

        class _KwargCapture:
            def train(self, features_df, targets, eval_set=None, **kwargs):
                received_kwargs.append(kwargs)
                return {"train_accuracy": 0.6}

            def evaluate(self, features_df, targets):
                return {"accuracy": 0.55, "n_games": len(features_df)}

        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(200)})
        y = pd.Series(np.random.choice([0, 1], 200))

        walk_forward_cv(
            _KwargCapture, X, y,
            min_train=100, val_window=50, step_size=50,
            sample_weights=None,
        )
        # No sample_weight key should be passed
        for kw in received_kwargs:
            assert "sample_weight" not in kw


# --- Sample weights in base model ---


class TestSampleWeightsModel:
    """Tests that BaseLGBMModel.train() correctly passes sample_weight."""

    def test_game_winner_accepts_sample_weight(self):
        """GameWinnerModel.train() should accept sample_weight parameter."""
        from ml.models.game_winner import GameWinnerModel

        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(100), "f2": np.random.randn(100)})
        y = pd.Series(np.random.choice([0, 1], 100))
        weights = pd.Series(np.ones(100))

        model = GameWinnerModel()
        metrics = model.train(X, y, sample_weight=weights)
        assert "train_accuracy" in metrics

    def test_spread_accepts_sample_weight(self):
        """SpreadModel.train() should accept sample_weight parameter."""
        from ml.models.spread import SpreadModel

        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(100), "f2": np.random.randn(100)})
        y = pd.Series(np.random.randn(100))
        weights = pd.Series(np.ones(100))

        model = SpreadModel()
        metrics = model.train(X, y, sample_weight=weights)
        assert "train_mae" in metrics

    def test_totals_accepts_sample_weight(self):
        """TotalsModel.train() should accept sample_weight parameter."""
        from ml.models.totals import TotalsModel

        np.random.seed(42)
        X = pd.DataFrame({"f1": np.random.randn(100), "f2": np.random.randn(100)})
        y = pd.Series(np.abs(np.random.randn(100)) * 3 + 3)  # positive totals
        weights = pd.Series(np.ones(100))

        model = TotalsModel()
        metrics = model.train(X, y, sample_weight=weights)
        assert "ensemble_mae" in metrics
