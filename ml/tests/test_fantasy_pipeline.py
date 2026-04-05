"""
Tests for fantasy projection integration in the daily pipeline.

Covers:
  - _predict_fantasy_points produces rows for both yahoo and espn formats
  - Each row has all required fields
  - Fantasy points are positive numbers
  - Game date and model version are correctly propagated
  - Empty input returns empty list
  - Multiple games are handled correctly
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from ml.pipeline.daily_run import _predict_fantasy_points


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_player_pred_rows():
    """Minimal player prediction rows as output by _predict_player_props."""
    return [
        {
            "game_id": 2025020001,
            "model_type": "player_props",
            "model_version": "2026-04-01_001",
            "game_date": "2026-04-04",
            "player_id": 8478402,
            "team_abbrev": "TOR",
            "position": "C",
            "player_predictions": {
                "expected_goals": 0.45,
                "expected_assists": 0.60,
                "expected_points": 1.05,
            },
            "data_quality": "fresh",
            "predicted_at": "2026-04-04T12:00:00+00:00",
        },
        {
            "game_id": 2025020001,
            "model_type": "player_props",
            "model_version": "2026-04-01_001",
            "game_date": "2026-04-04",
            "player_id": 8479318,
            "team_abbrev": "MTL",
            "position": "L",
            "player_predictions": {
                "expected_goals": 0.30,
                "expected_assists": 0.40,
                "expected_points": 0.70,
            },
            "data_quality": "fresh",
            "predicted_at": "2026-04-04T12:00:00+00:00",
        },
    ]


@pytest.fixture
def multi_game_pred_rows():
    """Player predictions spanning two different games."""
    return [
        {
            "game_id": 2025020001,
            "model_type": "player_props",
            "model_version": "2026-04-01_001",
            "game_date": "2026-04-04",
            "player_id": 8478402,
            "team_abbrev": "TOR",
            "position": "C",
            "player_predictions": {
                "expected_goals": 0.45,
                "expected_assists": 0.60,
                "expected_points": 1.05,
            },
            "data_quality": "fresh",
            "predicted_at": "2026-04-04T12:00:00+00:00",
        },
        {
            "game_id": 2025020002,
            "model_type": "player_props",
            "model_version": "2026-04-01_001",
            "game_date": "2026-04-04",
            "player_id": 8479318,
            "team_abbrev": "BOS",
            "position": "D",
            "player_predictions": {
                "expected_goals": 0.10,
                "expected_assists": 0.25,
                "expected_points": 0.35,
            },
            "data_quality": "stale",
            "predicted_at": "2026-04-04T12:00:00+00:00",
        },
    ]


@pytest.fixture
def mock_client():
    return MagicMock()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestPredictFantasyPoints:
    """Test _predict_fantasy_points function."""

    def test_produces_rows_for_both_formats(self, sample_player_pred_rows, mock_client):
        """Should produce rows for both yahoo and espn formats."""
        with patch("ml.pipeline.daily_run.write_fantasy_projections"):
            result = _predict_fantasy_points(
                sample_player_pred_rows, "2026-04-04", mock_client, "fresh"
            )

        # 2 players * 2 formats = 4 rows
        assert len(result) == 4

        formats = {r["format"] for r in result}
        assert formats == {"yahoo", "espn"}

        # Each format should have 2 players
        yahoo_rows = [r for r in result if r["format"] == "yahoo"]
        espn_rows = [r for r in result if r["format"] == "espn"]
        assert len(yahoo_rows) == 2
        assert len(espn_rows) == 2

    def test_each_row_has_all_required_fields(self, sample_player_pred_rows, mock_client):
        """Every output row must contain all required fields."""
        required_fields = {
            "game_id", "player_id", "player_name", "team_abbrev", "position",
            "format", "fantasy_points", "floor", "ceiling",
            "pred_goals", "pred_assists", "pred_points", "pred_sog", "pred_hits", "pred_blocks",
            "game_date", "model_version", "data_quality", "predicted_at",
        }

        with patch("ml.pipeline.daily_run.write_fantasy_projections"):
            result = _predict_fantasy_points(
                sample_player_pred_rows, "2026-04-04", mock_client, "fresh"
            )

        for row in result:
            missing = required_fields - set(row.keys())
            assert not missing, f"Row missing fields: {missing}"

    def test_fantasy_points_are_positive(self, sample_player_pred_rows, mock_client):
        """Fantasy points, floor, and ceiling should be non-negative for skaters with positive predictions."""
        with patch("ml.pipeline.daily_run.write_fantasy_projections"):
            result = _predict_fantasy_points(
                sample_player_pred_rows, "2026-04-04", mock_client, "fresh"
            )

        for row in result:
            assert row["fantasy_points"] >= 0, f"fantasy_points negative: {row['fantasy_points']}"
            assert row["ceiling"] >= row["fantasy_points"], (
                f"ceiling ({row['ceiling']}) < fantasy_points ({row['fantasy_points']})"
            )
            assert row["floor"] <= row["fantasy_points"], (
                f"floor ({row['floor']}) > fantasy_points ({row['fantasy_points']})"
            )

    def test_game_date_propagated(self, sample_player_pred_rows, mock_client):
        """game_date should match what was passed in."""
        with patch("ml.pipeline.daily_run.write_fantasy_projections"):
            result = _predict_fantasy_points(
                sample_player_pred_rows, "2026-04-04", mock_client, "fresh"
            )

        for row in result:
            assert row["game_date"] == "2026-04-04"

    def test_model_version_propagated(self, sample_player_pred_rows, mock_client):
        """model_version should come from the player prediction rows."""
        with patch("ml.pipeline.daily_run.write_fantasy_projections"):
            result = _predict_fantasy_points(
                sample_player_pred_rows, "2026-04-04", mock_client, "fresh"
            )

        for row in result:
            assert row["model_version"] == "2026-04-01_001"

    def test_data_quality_propagated(self, sample_player_pred_rows, mock_client):
        """data_quality should match what was passed in."""
        with patch("ml.pipeline.daily_run.write_fantasy_projections"):
            result = _predict_fantasy_points(
                sample_player_pred_rows, "2026-04-04", mock_client, "stale"
            )

        for row in result:
            assert row["data_quality"] == "stale"

    def test_empty_input_returns_empty(self, mock_client):
        """Empty player_pred_rows should return empty list without writing."""
        with patch("ml.pipeline.daily_run.write_fantasy_projections") as mock_write:
            result = _predict_fantasy_points([], "2026-04-04", mock_client, "fresh")

        assert result == []
        mock_write.assert_not_called()

    def test_writes_to_supabase(self, sample_player_pred_rows, mock_client):
        """Should call write_fantasy_projections with the projection rows."""
        with patch("ml.pipeline.daily_run.write_fantasy_projections") as mock_write:
            result = _predict_fantasy_points(
                sample_player_pred_rows, "2026-04-04", mock_client, "fresh"
            )

        assert mock_write.called
        # All rows should be written (may be in batches)
        total_written = sum(len(c[0][1]) for c in mock_write.call_args_list)
        assert total_written == len(result)

    def test_multi_game_predictions(self, multi_game_pred_rows, mock_client):
        """Should handle players from multiple games correctly."""
        with patch("ml.pipeline.daily_run.write_fantasy_projections"):
            result = _predict_fantasy_points(
                multi_game_pred_rows, "2026-04-04", mock_client, "fresh"
            )

        # 2 players * 2 formats = 4 rows
        assert len(result) == 4

        # Check game_ids are preserved
        game_ids = {r["game_id"] for r in result}
        assert game_ids == {2025020001, 2025020002}

    def test_pred_stats_are_floats(self, sample_player_pred_rows, mock_client):
        """All prediction stat fields should be floats."""
        with patch("ml.pipeline.daily_run.write_fantasy_projections"):
            result = _predict_fantasy_points(
                sample_player_pred_rows, "2026-04-04", mock_client, "fresh"
            )

        float_fields = [
            "fantasy_points", "floor", "ceiling",
            "pred_goals", "pred_assists", "pred_points",
            "pred_sog", "pred_hits", "pred_blocks",
        ]
        for row in result:
            for field in float_fields:
                assert isinstance(row[field], float), f"{field} is {type(row[field])}, expected float"

    def test_pred_goals_and_assists_match_input(self, sample_player_pred_rows, mock_client):
        """pred_goals and pred_assists should reflect the input player_predictions."""
        with patch("ml.pipeline.daily_run.write_fantasy_projections"):
            result = _predict_fantasy_points(
                sample_player_pred_rows, "2026-04-04", mock_client, "fresh"
            )

        # Player 8478402 had expected_goals=0.45, expected_assists=0.60
        player_rows = [r for r in result if r["player_id"] == 8478402]
        assert len(player_rows) == 2  # one per format
        for row in player_rows:
            assert abs(row["pred_goals"] - 0.45) < 1e-6
            assert abs(row["pred_assists"] - 0.60) < 1e-6
            assert abs(row["pred_points"] - 1.05) < 1e-6

    def test_position_preserved(self, sample_player_pred_rows, mock_client):
        """Player position should be carried through to projections."""
        with patch("ml.pipeline.daily_run.write_fantasy_projections"):
            result = _predict_fantasy_points(
                sample_player_pred_rows, "2026-04-04", mock_client, "fresh"
            )

        p1_rows = [r for r in result if r["player_id"] == 8478402]
        for row in p1_rows:
            assert row["position"] == "C"

        p2_rows = [r for r in result if r["player_id"] == 8479318]
        for row in p2_rows:
            assert row["position"] == "L"
