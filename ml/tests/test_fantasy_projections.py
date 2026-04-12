"""Tests for fantasy points projection layer."""

import pandas as pd
import pytest

from ml.fantasy.projections import project_fantasy_points, STAT_VARIANCE
from ml.fantasy.scoring import compute_fantasy_points


def _make_skater_df(**overrides):
    """Create a single-skater predictions DataFrame."""
    base = {
        "player_id": 1,
        "position": "C",
        "pred_goals": 1.0,
        "pred_assists": 1.5,
        "pred_sog": 3.0,
        "pred_hits": 2.0,
        "pred_blocks": 1.0,
        "pred_ppp": 0.5,
        "pred_plus_minus": 0.2,
    }
    base.update(overrides)
    return pd.DataFrame([base])


def _make_goalie_df(**overrides):
    """Create a single-goalie predictions DataFrame."""
    base = {
        "player_id": 99,
        "position": "G",
        "pred_wins": 0.6,
        "pred_saves": 28.0,
        "pred_goals_against": 2.5,
        "pred_shutouts": 0.05,
    }
    base.update(overrides)
    return pd.DataFrame([base])


class TestSkaterProjection:
    """Tests for skater fantasy point projections."""

    def test_output_columns(self):
        result = project_fantasy_points(_make_skater_df(), "yahoo")
        assert list(result.columns) == [
            "player_id",
            "fantasy_points",
            "floor",
            "ceiling",
            "format",
        ]

    def test_fantasy_points_value(self):
        df = _make_skater_df()
        result = project_fantasy_points(df, "yahoo")
        # Manually compute expected: 1*3 + 1.5*2 + 0.2*1 + 0.5*1 + 3*0.5 + 2*0.5 + 1*0.5
        # = 3 + 3 + 0.2 + 0.5 + 1.5 + 1.0 + 0.5 = 9.7
        expected = compute_fantasy_points(
            {
                "goals": 1.0,
                "assists": 1.5,
                "sog": 3.0,
                "hits": 2.0,
                "blocks": 1.0,
                "ppp": 0.5,
                "plus_minus": 0.2,
            },
            "yahoo",
            "skater",
        )
        assert result.iloc[0]["fantasy_points"] == round(expected, 2)

    def test_floor_less_than_points_less_than_ceiling(self):
        result = project_fantasy_points(_make_skater_df(), "yahoo")
        row = result.iloc[0]
        assert row["floor"] < row["fantasy_points"] < row["ceiling"]

    def test_format_column(self):
        result = project_fantasy_points(_make_skater_df(), "espn")
        assert result.iloc[0]["format"] == "espn"

    def test_floor_stats_clamped_to_zero(self):
        """Stats close to zero should have floor clamped at 0, not go negative."""
        df = _make_skater_df(pred_goals=0.1, pred_ppp=0.1)
        result = project_fantasy_points(df, "yahoo")
        # Floor should still be non-negative for the overall points
        # (individual stats are clamped, so points reflect that)
        row = result.iloc[0]
        assert row["floor"] >= 0

    def test_plus_minus_floor_can_be_negative(self):
        """plus_minus is the one stat NOT clamped to 0."""
        df = _make_skater_df(pred_plus_minus=-0.5)
        result = project_fantasy_points(df, "yahoo")
        # The floor for plus_minus = -0.5 - 1.0 = -1.5, which is valid
        row = result.iloc[0]
        assert row["floor"] < row["fantasy_points"]


class TestGoalieProjection:
    """Tests for goalie fantasy point projections."""

    def test_goalie_output_columns(self):
        result = project_fantasy_points(_make_goalie_df(), "yahoo")
        assert list(result.columns) == [
            "player_id",
            "fantasy_points",
            "floor",
            "ceiling",
            "format",
        ]

    def test_goalie_fantasy_points_value(self):
        df = _make_goalie_df()
        result = project_fantasy_points(df, "yahoo")
        expected = compute_fantasy_points(
            {"wins": 0.6, "saves": 28.0, "goals_against": 2.5, "shutouts": 0.05},
            "yahoo",
            "goalie",
        )
        assert result.iloc[0]["fantasy_points"] == round(expected, 2)

    def test_goalie_floor_less_than_ceiling(self):
        result = project_fantasy_points(_make_goalie_df(), "yahoo")
        row = result.iloc[0]
        assert row["floor"] < row["fantasy_points"] < row["ceiling"]


class TestMultiplePlayers:
    """Tests for handling multiple players."""

    def test_multiple_skaters(self):
        df = pd.DataFrame(
            [
                {
                    "player_id": 1,
                    "position": "C",
                    "pred_goals": 1.0,
                    "pred_assists": 1.0,
                    "pred_sog": 3.0,
                    "pred_hits": 1.0,
                    "pred_blocks": 1.0,
                    "pred_ppp": 0.5,
                    "pred_plus_minus": 0.0,
                },
                {
                    "player_id": 2,
                    "position": "D",
                    "pred_goals": 0.2,
                    "pred_assists": 0.8,
                    "pred_sog": 2.0,
                    "pred_hits": 3.0,
                    "pred_blocks": 2.0,
                    "pred_ppp": 0.1,
                    "pred_plus_minus": 0.5,
                },
            ]
        )
        result = project_fantasy_points(df, "yahoo")
        assert len(result) == 2
        assert list(result["player_id"]) == [1, 2]
        # Each row should have floor < points < ceiling
        for _, row in result.iterrows():
            assert row["floor"] < row["fantasy_points"] < row["ceiling"]

    def test_mixed_skaters_and_goalies(self):
        df = pd.DataFrame(
            [
                {
                    "player_id": 1,
                    "position": "LW",
                    "pred_goals": 0.8,
                    "pred_assists": 1.2,
                    "pred_sog": 4.0,
                    "pred_hits": 1.5,
                    "pred_blocks": 0.5,
                    "pred_ppp": 0.3,
                    "pred_plus_minus": 0.1,
                },
                {
                    "player_id": 99,
                    "position": "G",
                    "pred_wins": 0.5,
                    "pred_saves": 25.0,
                    "pred_goals_against": 3.0,
                    "pred_shutouts": 0.02,
                },
            ]
        )
        result = project_fantasy_points(df, "yahoo")
        assert len(result) == 2
        assert result.iloc[0]["player_id"] == 1
        assert result.iloc[1]["player_id"] == 99


class TestFormats:
    """Tests for different scoring formats."""

    def test_yahoo_format(self):
        result = project_fantasy_points(_make_skater_df(), "yahoo")
        assert result.iloc[0]["format"] == "yahoo"

    def test_espn_format(self):
        result = project_fantasy_points(_make_skater_df(), "espn")
        assert result.iloc[0]["format"] == "espn"

    def test_yahoo_and_espn_differ(self):
        """Yahoo and ESPN have different weights, so points should differ."""
        yahoo = project_fantasy_points(_make_skater_df(), "yahoo")
        espn = project_fantasy_points(_make_skater_df(), "espn")
        # sog and hits have different weights, so totals should differ
        assert yahoo.iloc[0]["fantasy_points"] != espn.iloc[0]["fantasy_points"]

    def test_invalid_format_raises(self):
        with pytest.raises(ValueError, match="Unknown format"):
            project_fantasy_points(_make_skater_df(), "invalid_format")


class TestRounding:
    """Tests for output precision."""

    def test_fantasy_points_rounded_to_2_decimals(self):
        result = project_fantasy_points(_make_skater_df(), "yahoo")
        fp = result.iloc[0]["fantasy_points"]
        assert fp == round(fp, 2)

    def test_floor_rounded_to_2_decimals(self):
        result = project_fantasy_points(_make_skater_df(), "yahoo")
        floor = result.iloc[0]["floor"]
        assert floor == round(floor, 2)

    def test_ceiling_rounded_to_2_decimals(self):
        result = project_fantasy_points(_make_skater_df(), "yahoo")
        ceiling = result.iloc[0]["ceiling"]
        assert ceiling == round(ceiling, 2)
