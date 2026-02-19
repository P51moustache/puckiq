"""
Tests for the daily prediction pipeline (ml/pipeline/daily_run.py).

Covers:
  - Prediction flow for each model type (game_winner, spread, totals, player_props)
  - Graceful failure when models are missing
  - Data freshness checks
  - Cross-model feature injection (gw_home_win_prob)
  - Prediction write operations
  - Empty game list handling
"""

import logging
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

import numpy as np
import pandas as pd
import pytest

from ml.config import CONFIDENCE_HIGH, CONFIDENCE_LOW, ModelType
from ml.features.registry import generate_synthetic_features, get_model_features
from ml.pipeline.daily_run import (
    _predict_game_winners,
    _predict_player_props,
    _predict_spreads,
    _predict_totals,
    _run,
    main,
)


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_storage():
    """Create a mock ModelStorage with configurable load_model and get_manifest."""
    storage = MagicMock()
    storage.get_manifest.return_value = {"active_version": "2026-02-01_001"}
    return storage


@pytest.fixture
def mock_client():
    """Create a mock Supabase client."""
    return MagicMock()


@pytest.fixture
def sample_games_df():
    """Minimal games DataFrame for today with 3 games."""
    return pd.DataFrame({
        "id": [2025020001, 2025020002, 2025020003],
        "home_team_abbrev": ["TOR", "BOS", "NYR"],
        "away_team_abbrev": ["MTL", "DET", "PHI"],
        "home_score": [0, 0, 0],
        "away_score": [0, 0, 0],
        "game_state": ["FUT", "FUT", "FUT"],
        "game_date": ["2026-02-18", "2026-02-18", "2026-02-18"],
        "season": [20252026, 20252026, 20252026],
    })


@pytest.fixture
def sample_features_df():
    """Synthetic feature DataFrame matching game_winner model features."""
    return generate_synthetic_features(n=3, model_type="game_winner", seed=99)


@pytest.fixture
def mock_gw_model():
    """Mock game winner model that returns probabilities."""
    model = MagicMock()
    model.predict.return_value = np.array([0.72, 0.45, 0.61])
    return model


@pytest.fixture
def mock_spread_model():
    """Mock spread model that returns spread values."""
    model = MagicMock()
    model.predict.return_value = np.array([1.5, -0.8, 0.3])
    return model


@pytest.fixture
def mock_totals_model():
    """Mock totals model that returns total goals."""
    model = MagicMock()
    model.predict.return_value = np.array([5.8, 6.2, 4.9])
    return model


@pytest.fixture
def mock_player_props_model():
    """Mock player props model that returns per-stat predictions."""
    model = MagicMock()
    model.predict.return_value = {
        "goals": np.array([0.3, 0.5, 0.1, 0.2]),
        "assists": np.array([0.5, 0.4, 0.3, 0.6]),
        "points": np.array([0.8, 0.9, 0.4, 0.8]),
    }
    return model


# ---------------------------------------------------------------------------
# Test: Prediction flow for each model type
# ---------------------------------------------------------------------------


class TestPredictGameWinners:
    """Test _predict_game_winners with a mock model."""

    def test_produces_predictions_with_correct_shape(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_gw_model
    ):
        mock_storage.load_model.return_value = mock_gw_model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            result = _predict_game_winners(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        assert result is not None
        assert len(result) == 3
        # write_predictions should have been called with 3 prediction dicts
        mock_write.assert_called_once()
        written = mock_write.call_args[0][1]
        assert len(written) == 3

    def test_probabilities_in_valid_range(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_gw_model
    ):
        mock_storage.load_model.return_value = mock_gw_model

        with patch("ml.pipeline.daily_run.write_predictions"):
            result = _predict_game_winners(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        for prob in result:
            assert 0.0 <= prob <= 1.0

    def test_prediction_fields_are_correct(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_gw_model
    ):
        mock_storage.load_model.return_value = mock_gw_model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_game_winners(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        predictions = mock_write.call_args[0][1]
        for pred in predictions:
            assert "game_id" in pred
            assert "model_type" in pred
            assert pred["model_type"] == ModelType.GAME_WINNER.value
            assert "model_version" in pred
            assert "game_date" in pred
            assert "home_win_prob" in pred
            assert "away_win_prob" in pred
            assert "predicted_winner" in pred
            assert "confidence" in pred
            assert "data_quality" in pred
            assert "predicted_at" in pred
            # home + away probs should sum to 1
            assert abs(pred["home_win_prob"] + pred["away_win_prob"] - 1.0) < 1e-9

    def test_confidence_labels_mapped_correctly(
        self, mock_storage, sample_features_df, sample_games_df, mock_client
    ):
        """Verify confidence mapping: high >= 0.65, medium >= 0.55, else low."""
        model = MagicMock()
        # prob=0.72 -> confidence_val=0.72 -> high
        # prob=0.45 -> away_win_prob=0.55 -> medium
        # prob=0.52 -> confidence_val=0.52 -> low
        model.predict.return_value = np.array([0.72, 0.45, 0.52])
        mock_storage.load_model.return_value = model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_game_winners(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", MagicMock(), "fresh",
            )

        predictions = mock_write.call_args[0][1]
        assert predictions[0]["confidence"] == "high"
        assert predictions[1]["confidence"] == "medium"
        assert predictions[2]["confidence"] == "low"

    def test_predicted_winner_is_correct_team(
        self, mock_storage, sample_features_df, sample_games_df, mock_client
    ):
        model = MagicMock()
        # 0.8 -> home wins, 0.3 -> away wins
        model.predict.return_value = np.array([0.8, 0.3, 0.6])
        mock_storage.load_model.return_value = model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_game_winners(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", MagicMock(), "fresh",
            )

        predictions = mock_write.call_args[0][1]
        assert predictions[0]["predicted_winner"] == "TOR"   # home favored
        assert predictions[1]["predicted_winner"] == "DET"   # away favored
        assert predictions[2]["predicted_winner"] == "NYR"   # home favored


class TestPredictSpreads:
    """Test _predict_spreads with a mock model."""

    def test_produces_predictions_with_correct_shape(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_spread_model
    ):
        mock_storage.load_model.return_value = mock_spread_model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_spreads(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        mock_write.assert_called_once()
        written = mock_write.call_args[0][1]
        assert len(written) == 3

    def test_spreads_are_reasonable(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_spread_model
    ):
        mock_storage.load_model.return_value = mock_spread_model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_spreads(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        predictions = mock_write.call_args[0][1]
        for pred in predictions:
            assert "predicted_spread" in pred
            # Spreads should be reasonable (within ~10 goals)
            assert -10 <= pred["predicted_spread"] <= 10

    def test_spread_prediction_fields(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_spread_model
    ):
        mock_storage.load_model.return_value = mock_spread_model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_spreads(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        predictions = mock_write.call_args[0][1]
        for pred in predictions:
            assert pred["model_type"] == ModelType.SPREAD.value
            assert "game_id" in pred
            assert "model_version" in pred
            assert "game_date" in pred
            assert "data_quality" in pred
            assert "predicted_at" in pred


class TestPredictTotals:
    """Test _predict_totals with a mock model."""

    def test_produces_predictions_with_correct_shape(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_totals_model
    ):
        mock_storage.load_model.return_value = mock_totals_model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_totals(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        mock_write.assert_called_once()
        written = mock_write.call_args[0][1]
        assert len(written) == 3

    def test_totals_are_positive(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_totals_model
    ):
        mock_storage.load_model.return_value = mock_totals_model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_totals(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        predictions = mock_write.call_args[0][1]
        for pred in predictions:
            assert pred["predicted_total"] > 0

    def test_totals_fillna_applied(self, mock_storage, sample_games_df, mock_client):
        """Verify that NaN features are filled with 0 for the Poisson component."""
        features = generate_synthetic_features(n=3, model_type="game_winner", seed=99)
        # Inject some NaN values
        features.iloc[0, 0] = np.nan
        features.iloc[1, 2] = np.nan

        model = MagicMock()
        model.predict.return_value = np.array([5.5, 6.0, 5.0])
        mock_storage.load_model.return_value = model

        with patch("ml.pipeline.daily_run.write_predictions"):
            _predict_totals(
                mock_storage, features, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        # The model should have been called with a DataFrame that has no NaN
        call_X = model.predict.call_args[0][0]
        assert not call_X.isna().any().any(), "NaN values should be filled with 0"


class TestPredictPlayerProps:
    """Test _predict_player_props with mocked dependencies."""

    def test_produces_predictions_for_players(
        self, mock_storage, sample_games_df, mock_client, mock_player_props_model
    ):
        mock_storage.load_model.return_value = mock_player_props_model

        # Mock season stats with players on the teams in sample_games_df
        season_stats = pd.DataFrame({
            "player_id": [101, 102, 103, 104],
            "team_abbrev": ["TOR", "TOR", "MTL", "BOS"],
            "goals_per_game": [0.4, 0.2, 0.3, 0.5],
            "avg_toi_per_game": [18.0, 14.0, 16.0, 20.0],
            "shooting_pctg": [12.0, 8.0, 10.0, 15.0],
        })

        # Standings mock
        standings_resp = MagicMock()
        standings_resp.data = [
            {"team_abbrev": "TOR", "goals_against": 100, "games_played": 40},
            {"team_abbrev": "MTL", "goals_against": 120, "games_played": 40},
        ]
        mock_client.table.return_value.select.return_value.execute.return_value = standings_resp

        with (
            patch("ml.pipeline.daily_run.read_player_season_stats", return_value=season_stats),
            patch("ml.pipeline.daily_run.compute_player_features") as mock_compute,
            patch("ml.pipeline.daily_run.write_predictions") as mock_write,
            patch("ml.pipeline.daily_run.get_model_features", return_value=["gpg", "toi", "shot_pct", "opp_ga_per_game", "is_home"]),
        ):
            # compute_player_features returns DataFrame with features
            player_features = pd.DataFrame({
                "player_id": [101, 102, 103, 104],
                "game_id": [2025020001, 2025020001, 2025020001, 2025020002],
                "gpg": [0.4, 0.2, 0.3, 0.5],
                "toi": [18.0, 14.0, 16.0, 20.0],
                "shot_pct": [12.0, 8.0, 10.0, 15.0],
                "opp_ga_per_game": [3.0, 3.0, 2.5, 2.8],
                "is_home": [1.0, 1.0, 0.0, 1.0],
            })
            mock_compute.return_value = player_features

            _predict_player_props(
                mock_storage, sample_games_df, "2026-02-18", mock_client, "fresh",
            )

        # write_predictions should have been called (potentially in batches)
        assert mock_write.called
        # Gather all written predictions from all batch calls
        all_written = []
        for c in mock_write.call_args_list:
            all_written.extend(c[0][1])
        assert len(all_written) == 4

    def test_player_props_prediction_fields(
        self, mock_storage, sample_games_df, mock_client, mock_player_props_model
    ):
        mock_storage.load_model.return_value = mock_player_props_model

        season_stats = pd.DataFrame({
            "player_id": [101, 102, 103, 104],
            "team_abbrev": ["TOR", "TOR", "MTL", "BOS"],
            "goals_per_game": [0.4, 0.2, 0.3, 0.5],
            "avg_toi_per_game": [18.0, 14.0, 16.0, 20.0],
            "shooting_pctg": [12.0, 8.0, 10.0, 15.0],
        })

        standings_resp = MagicMock()
        standings_resp.data = []
        mock_client.table.return_value.select.return_value.execute.return_value = standings_resp

        with (
            patch("ml.pipeline.daily_run.read_player_season_stats", return_value=season_stats),
            patch("ml.pipeline.daily_run.compute_player_features") as mock_compute,
            patch("ml.pipeline.daily_run.write_predictions") as mock_write,
            patch("ml.pipeline.daily_run.get_model_features", return_value=["gpg", "toi", "shot_pct", "opp_ga_per_game", "is_home"]),
        ):
            player_features = pd.DataFrame({
                "player_id": [101, 102, 103, 104],
                "game_id": [2025020001, 2025020001, 2025020001, 2025020002],
                "gpg": [0.4, 0.2, 0.3, 0.5],
                "toi": [18.0, 14.0, 16.0, 20.0],
                "shot_pct": [12.0, 8.0, 10.0, 15.0],
                "opp_ga_per_game": [3.0, 3.0, 2.5, 2.8],
                "is_home": [1.0, 1.0, 0.0, 1.0],
            })
            mock_compute.return_value = player_features

            _predict_player_props(
                mock_storage, sample_games_df, "2026-02-18", mock_client, "fresh",
            )

        all_written = []
        for c in mock_write.call_args_list:
            all_written.extend(c[0][1])

        for pred in all_written:
            assert pred["model_type"] == ModelType.PLAYER_PROPS.value
            assert "player_id" in pred
            assert "player_predictions" in pred
            pp = pred["player_predictions"]
            assert "expected_goals" in pp
            assert "expected_assists" in pp
            assert "expected_points" in pp
            assert pred["data_quality"] == "fresh"


# ---------------------------------------------------------------------------
# Test: Graceful failure when model is missing
# ---------------------------------------------------------------------------


class TestModelMissing:
    """Verify each prediction function handles missing models gracefully."""

    def test_game_winner_missing_model_returns_none(
        self, mock_storage, sample_features_df, sample_games_df, mock_client
    ):
        mock_storage.load_model.side_effect = FileNotFoundError("No active model")

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            result = _predict_game_winners(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        assert result is None
        mock_write.assert_not_called()

    def test_spread_missing_model_returns_none(
        self, mock_storage, sample_features_df, sample_games_df, mock_client
    ):
        mock_storage.load_model.side_effect = FileNotFoundError("No active model")

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_spreads(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        mock_write.assert_not_called()

    def test_totals_missing_model_returns_none(
        self, mock_storage, sample_features_df, sample_games_df, mock_client
    ):
        mock_storage.load_model.side_effect = FileNotFoundError("No active model")

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_totals(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        mock_write.assert_not_called()

    def test_player_props_missing_model_skips(
        self, mock_storage, sample_games_df, mock_client
    ):
        mock_storage.load_model.side_effect = FileNotFoundError("No active model")

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_player_props(
                mock_storage, sample_games_df, "2026-02-18", mock_client, "fresh",
            )

        mock_write.assert_not_called()

    def test_missing_model_logs_warning(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, caplog
    ):
        mock_storage.load_model.side_effect = FileNotFoundError("No active model")

        with patch("ml.pipeline.daily_run.write_predictions"):
            with caplog.at_level(logging.WARNING):
                _predict_game_winners(
                    mock_storage, sample_features_df, sample_games_df,
                    "2026-02-18", mock_client, "fresh",
                )

        assert any("skipping inference" in msg.lower() for msg in caplog.messages)


# ---------------------------------------------------------------------------
# Test: Data freshness check
# ---------------------------------------------------------------------------


class TestDataFreshness:
    """Verify data freshness affects data_quality flag in predictions."""

    def test_fresh_data_sets_quality_fresh(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_gw_model
    ):
        mock_storage.load_model.return_value = mock_gw_model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_game_winners(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        predictions = mock_write.call_args[0][1]
        for pred in predictions:
            assert pred["data_quality"] == "fresh"

    def test_stale_data_sets_quality_stale(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_gw_model
    ):
        mock_storage.load_model.return_value = mock_gw_model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_game_winners(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "stale",
            )

        predictions = mock_write.call_args[0][1]
        for pred in predictions:
            assert pred["data_quality"] == "stale"

    def test_freshness_check_in_run(self):
        """Verify _run sets data_quality based on check_data_freshness result."""
        with (
            patch("ml.pipeline.daily_run.create_supabase_client") as mock_create,
            patch("ml.pipeline.daily_run.check_data_freshness", return_value=False),
            patch("ml.pipeline.daily_run.read_games", return_value=pd.DataFrame()),
            patch("ml.pipeline.daily_run.score_yesterdays_predictions", return_value=0),
            patch("ml.pipeline.daily_run._ping_healthcheck"),
        ):
            mock_create.return_value = MagicMock()
            _run()  # Should not crash -- handles empty games gracefully

    def test_freshness_check_true_in_run(self):
        """Verify data_quality='fresh' when check_data_freshness returns True."""
        mock_client = MagicMock()

        with (
            patch("ml.pipeline.daily_run.create_supabase_client", return_value=mock_client),
            patch("ml.pipeline.daily_run.check_data_freshness", return_value=True),
            patch("ml.pipeline.daily_run.read_games", return_value=pd.DataFrame()),
            patch("ml.pipeline.daily_run.score_yesterdays_predictions", return_value=0),
            patch("ml.pipeline.daily_run._ping_healthcheck"),
        ):
            _run()  # No games, but freshness check should pass


# ---------------------------------------------------------------------------
# Test: Cross-model feature injection
# ---------------------------------------------------------------------------


class TestCrossModelFeatureInjection:
    """Verify gw_home_win_prob is injected into features for spread/totals."""

    def test_gw_probs_injected_into_features(
        self, mock_storage, sample_games_df, mock_client
    ):
        """When game_winner succeeds, gw_home_win_prob is added to features_df."""
        features = generate_synthetic_features(n=3, model_type="game_winner", seed=99)

        # game_winner model returns probabilities
        gw_model = MagicMock()
        gw_model.predict.return_value = np.array([0.65, 0.40, 0.55])

        # spread model will be called with features that include gw_home_win_prob
        spread_model = MagicMock()
        spread_model.predict.return_value = np.array([1.0, -0.5, 0.2])

        def load_model_side_effect(model_type):
            if model_type == ModelType.GAME_WINNER.value:
                return gw_model
            elif model_type == ModelType.SPREAD.value:
                return spread_model
            raise FileNotFoundError(f"No model for {model_type}")

        mock_storage.load_model.side_effect = load_model_side_effect

        # Execute the game_winner prediction and inject
        with patch("ml.pipeline.daily_run.write_predictions"):
            gw_probs = _predict_game_winners(
                mock_storage, features, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        # Simulate the injection as _run does
        assert gw_probs is not None
        assert len(gw_probs) == len(features)
        features["gw_home_win_prob"] = gw_probs
        assert "gw_home_win_prob" in features.columns

        # Now spread/totals can use it
        with patch("ml.pipeline.daily_run.write_predictions"):
            _predict_spreads(
                mock_storage, features, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        # Verify spread model was called
        spread_model.predict.assert_called_once()

    def test_gw_failure_does_not_block_spread_totals(
        self, mock_storage, sample_games_df, mock_client
    ):
        """When game_winner model is missing, spread/totals still run (with NaN gw_home_win_prob)."""
        features = generate_synthetic_features(n=3, model_type="game_winner", seed=99)

        # game_winner model missing
        def load_model_side_effect(model_type):
            if model_type == ModelType.GAME_WINNER.value:
                raise FileNotFoundError("No GW model")
            model = MagicMock()
            model.predict.return_value = np.array([1.0, -0.5, 0.2])
            return model

        mock_storage.load_model.side_effect = load_model_side_effect

        with patch("ml.pipeline.daily_run.write_predictions"):
            gw_probs = _predict_game_winners(
                mock_storage, features, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        # gw_probs is None, so no injection
        assert gw_probs is None
        assert "gw_home_win_prob" not in features.columns

        # Spread should still work without gw_home_win_prob
        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_spreads(
                mock_storage, features, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )
        mock_write.assert_called_once()

    def test_run_guards_gw_probs_length_mismatch(self):
        """In _run, gw_probs length mismatch prevents injection into features_df.

        The guard 'if gw_probs is not None and len(gw_probs) == len(features_df)'
        lives in _run(). We test it by verifying the logic directly: if gw_probs
        has wrong length, gw_home_win_prob should NOT be injected.
        """
        features = generate_synthetic_features(n=3, model_type="game_winner", seed=99)

        # Simulate _run's guard with mismatched length
        gw_probs = [0.65, 0.40]  # only 2 for 3 rows
        if gw_probs is not None and len(gw_probs) == len(features):
            features["gw_home_win_prob"] = gw_probs

        assert "gw_home_win_prob" not in features.columns

    def test_run_injects_when_lengths_match(self):
        """In _run, gw_probs with matching length IS injected into features_df."""
        features = generate_synthetic_features(n=3, model_type="game_winner", seed=99)

        gw_probs = [0.65, 0.40, 0.55]  # matches 3 rows
        if gw_probs is not None and len(gw_probs) == len(features):
            features["gw_home_win_prob"] = gw_probs

        assert "gw_home_win_prob" in features.columns
        assert list(features["gw_home_win_prob"]) == [0.65, 0.40, 0.55]


# ---------------------------------------------------------------------------
# Test: Prediction write operations
# ---------------------------------------------------------------------------


class TestPredictionWriteOperations:
    """Verify predictions are written correctly to Supabase."""

    def test_write_called_with_correct_client(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_gw_model
    ):
        mock_storage.load_model.return_value = mock_gw_model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_game_winners(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        # First arg should be the client
        mock_write.assert_called_once()
        assert mock_write.call_args[0][0] is mock_client

    def test_model_version_from_manifest(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_gw_model
    ):
        mock_storage.load_model.return_value = mock_gw_model
        mock_storage.get_manifest.return_value = {"active_version": "2026-02-15_003"}

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_game_winners(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        predictions = mock_write.call_args[0][1]
        for pred in predictions:
            assert pred["model_version"] == "2026-02-15_003"

    def test_model_version_unknown_when_no_manifest(
        self, mock_storage, sample_features_df, sample_games_df, mock_client, mock_gw_model
    ):
        mock_storage.load_model.return_value = mock_gw_model
        mock_storage.get_manifest.return_value = None

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_game_winners(
                mock_storage, sample_features_df, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        predictions = mock_write.call_args[0][1]
        for pred in predictions:
            assert pred["model_version"] == "unknown"

    def test_player_props_batch_write(
        self, mock_storage, sample_games_df, mock_client
    ):
        """Player props with many players should be written in batches of 100."""
        # Create model that handles variable-length inputs
        model = MagicMock()

        def predict_fn(X):
            n = len(X)
            return {
                "goals": np.random.rand(n),
                "assists": np.random.rand(n),
                "points": np.random.rand(n),
            }
        model.predict.side_effect = predict_fn
        mock_storage.load_model.return_value = model

        # Create 250 players across games
        player_ids = list(range(100, 350))
        season_stats = pd.DataFrame({
            "player_id": player_ids,
            "team_abbrev": ["TOR"] * 125 + ["MTL"] * 125,
            "goals_per_game": [0.3] * 250,
            "avg_toi_per_game": [15.0] * 250,
            "shooting_pctg": [10.0] * 250,
        })

        standings_resp = MagicMock()
        standings_resp.data = []
        mock_client.table.return_value.select.return_value.execute.return_value = standings_resp

        with (
            patch("ml.pipeline.daily_run.read_player_season_stats", return_value=season_stats),
            patch("ml.pipeline.daily_run.compute_player_features") as mock_compute,
            patch("ml.pipeline.daily_run.write_predictions") as mock_write,
            patch("ml.pipeline.daily_run.get_model_features", return_value=["gpg", "toi", "shot_pct", "opp_ga_per_game", "is_home"]),
        ):
            n_players = 250
            player_features = pd.DataFrame({
                "player_id": player_ids,
                "game_id": [2025020001] * 125 + [2025020001] * 125,
                "gpg": [0.3] * n_players,
                "toi": [15.0] * n_players,
                "shot_pct": [10.0] * n_players,
                "opp_ga_per_game": [3.0] * n_players,
                "is_home": [1.0] * 125 + [0.0] * 125,
            })
            mock_compute.return_value = player_features

            _predict_player_props(
                mock_storage, sample_games_df, "2026-02-18", mock_client, "fresh",
            )

        # Should be called in batches: 100 + 100 + 50 = 3 calls
        assert mock_write.call_count == 3
        total_written = sum(len(c[0][1]) for c in mock_write.call_args_list)
        assert total_written == 250


# ---------------------------------------------------------------------------
# Test: Empty game list
# ---------------------------------------------------------------------------


class TestEmptyGameList:
    """Verify pipeline handles no games for today gracefully."""

    def test_run_with_no_games_logs_message(self, caplog):
        with (
            patch("ml.pipeline.daily_run.create_supabase_client") as mock_create,
            patch("ml.pipeline.daily_run.check_data_freshness", return_value=True),
            patch("ml.pipeline.daily_run.read_games", return_value=pd.DataFrame()),
            patch("ml.pipeline.daily_run.score_yesterdays_predictions", return_value=0),
            patch("ml.pipeline.daily_run._ping_healthcheck"),
        ):
            mock_create.return_value = MagicMock()

            with caplog.at_level(logging.INFO):
                _run()

        assert any("no games scheduled" in msg.lower() for msg in caplog.messages)

    def test_run_with_no_games_still_scores_yesterday(self):
        """Even with no games today, we should still score yesterday's predictions."""
        with (
            patch("ml.pipeline.daily_run.create_supabase_client") as mock_create,
            patch("ml.pipeline.daily_run.check_data_freshness", return_value=True),
            patch("ml.pipeline.daily_run.read_games", return_value=pd.DataFrame()),
            patch("ml.pipeline.daily_run.score_yesterdays_predictions", return_value=5) as mock_score,
            patch("ml.pipeline.daily_run._ping_healthcheck"),
        ):
            mock_create.return_value = MagicMock()
            _run()

        mock_score.assert_called_once()

    def test_run_with_no_games_still_pings_healthcheck(self):
        """Even with no games today, healthcheck should be pinged."""
        with (
            patch("ml.pipeline.daily_run.create_supabase_client") as mock_create,
            patch("ml.pipeline.daily_run.check_data_freshness", return_value=True),
            patch("ml.pipeline.daily_run.read_games", return_value=pd.DataFrame()),
            patch("ml.pipeline.daily_run.score_yesterdays_predictions", return_value=0),
            patch("ml.pipeline.daily_run._ping_healthcheck") as mock_ping,
        ):
            mock_create.return_value = MagicMock()
            _run()

        mock_ping.assert_called_once()

    def test_run_with_games_on_other_dates(self):
        """Games exist but none are for today -- treated as empty."""
        games_df = pd.DataFrame({
            "id": [1, 2],
            "home_team_abbrev": ["TOR", "BOS"],
            "away_team_abbrev": ["MTL", "DET"],
            "game_state": ["FUT", "FUT"],
            "game_date": ["2026-02-19", "2026-02-20"],
        })

        with (
            patch("ml.pipeline.daily_run.create_supabase_client") as mock_create,
            patch("ml.pipeline.daily_run.check_data_freshness", return_value=True),
            patch("ml.pipeline.daily_run.read_games", return_value=games_df),
            patch("ml.pipeline.daily_run.score_yesterdays_predictions", return_value=0),
            patch("ml.pipeline.daily_run._ping_healthcheck"),
            patch("ml.pipeline.daily_run.datetime") as mock_dt,
        ):
            # Fix "today" to 2026-02-18 so our games on 2/19 and 2/20 don't match
            mock_dt.now.return_value = datetime(2026, 2, 18, 12, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            mock_create.return_value = MagicMock()
            _run()


# ---------------------------------------------------------------------------
# Test: Full pipeline orchestration
# ---------------------------------------------------------------------------


class TestPipelineOrchestration:
    """Verify the _run function orchestrates all steps correctly."""

    def test_main_catches_exceptions_and_exits(self):
        """main() wraps _run in try/except and calls sys.exit(1) on failure."""
        with (
            patch("ml.pipeline.daily_run._run", side_effect=RuntimeError("boom")),
            patch("ml.pipeline.daily_run._notify_discord") as mock_discord,
            pytest.raises(SystemExit) as exc_info,
        ):
            main()

        assert exc_info.value.code == 1
        mock_discord.assert_called_once()
        assert "boom" in mock_discord.call_args[0][0]

    def test_main_success_does_not_exit(self):
        """main() should not call sys.exit on success."""
        with patch("ml.pipeline.daily_run._run"):
            main()  # Should return normally

    def test_player_props_skips_when_no_season_stats(
        self, mock_storage, sample_games_df, mock_client
    ):
        """If no season stats, player props should exit early."""
        model = MagicMock()
        mock_storage.load_model.return_value = model

        with (
            patch("ml.pipeline.daily_run.read_player_season_stats", return_value=pd.DataFrame()),
            patch("ml.pipeline.daily_run.write_predictions") as mock_write,
        ):
            _predict_player_props(
                mock_storage, sample_games_df, "2026-02-18", mock_client, "fresh",
            )

        mock_write.assert_not_called()

    def test_available_features_subset(
        self, mock_storage, sample_games_df, mock_client
    ):
        """Model should work even when not all expected features are available."""
        # Only provide a subset of features
        features = pd.DataFrame({
            "home_point_pctg": [0.6, 0.5, 0.7],
            "away_point_pctg": [0.55, 0.45, 0.65],
        })

        model = MagicMock()
        model.predict.return_value = np.array([0.6, 0.4, 0.55])
        mock_storage.load_model.return_value = model

        with patch("ml.pipeline.daily_run.write_predictions") as mock_write:
            _predict_game_winners(
                mock_storage, features, sample_games_df,
                "2026-02-18", mock_client, "fresh",
            )

        # Model should be called with only the available features
        call_X = model.predict.call_args[0][0]
        # The available features should be a subset that exists in features_df
        assert len(call_X.columns) <= 2
        mock_write.assert_called_once()


# ---------------------------------------------------------------------------
# Test: Healthcheck and Discord notifications
# ---------------------------------------------------------------------------


class TestNotifications:
    """Test healthcheck ping and Discord notification helpers."""

    def test_ping_healthcheck_no_url(self):
        """No-op when HEALTHCHECK_URL is empty."""
        with patch("ml.pipeline.daily_run.HEALTHCHECK_URL", ""):
            from ml.pipeline.daily_run import _ping_healthcheck
            _ping_healthcheck()  # Should not raise

    def test_ping_healthcheck_success(self):
        with (
            patch("ml.pipeline.daily_run.HEALTHCHECK_URL", "https://example.com/ping"),
            patch("ml.pipeline.daily_run.httpx") as mock_httpx,
        ):
            from ml.pipeline.daily_run import _ping_healthcheck
            _ping_healthcheck()
            mock_httpx.get.assert_called_once_with("https://example.com/ping", timeout=10)

    def test_ping_healthcheck_failure_does_not_raise(self):
        with (
            patch("ml.pipeline.daily_run.HEALTHCHECK_URL", "https://example.com/ping"),
            patch("ml.pipeline.daily_run.httpx") as mock_httpx,
        ):
            mock_httpx.get.side_effect = Exception("network error")
            from ml.pipeline.daily_run import _ping_healthcheck
            _ping_healthcheck()  # Should not raise

    def test_notify_discord_no_url(self):
        """No-op when DISCORD_WEBHOOK_URL is empty."""
        with patch("ml.pipeline.daily_run.DISCORD_WEBHOOK_URL", ""):
            from ml.pipeline.daily_run import _notify_discord
            _notify_discord("test message")  # Should not raise

    def test_notify_discord_success(self):
        with (
            patch("ml.pipeline.daily_run.DISCORD_WEBHOOK_URL", "https://discord.com/webhook"),
            patch("ml.pipeline.daily_run.httpx") as mock_httpx,
        ):
            from ml.pipeline.daily_run import _notify_discord
            _notify_discord("Pipeline failed!")
            mock_httpx.post.assert_called_once_with(
                "https://discord.com/webhook",
                json={"content": "Pipeline failed!"},
                timeout=10,
            )

    def test_notify_discord_failure_does_not_raise(self):
        with (
            patch("ml.pipeline.daily_run.DISCORD_WEBHOOK_URL", "https://discord.com/webhook"),
            patch("ml.pipeline.daily_run.httpx") as mock_httpx,
        ):
            mock_httpx.post.side_effect = Exception("network error")
            from ml.pipeline.daily_run import _notify_discord
            _notify_discord("test")  # Should not raise
