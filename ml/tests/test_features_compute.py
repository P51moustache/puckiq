"""
Tests for ml/features/compute.py — feature computation engine.

Tests the compute helper functions directly (day_before, days_since_last_game,
back-to-back detection, derived features) without requiring Supabase.
"""

import numpy as np
import pandas as pd
import pytest

from ml.features.compute import (
    _compute_derived,
    _compute_lookup,
    _compute_rolling_team,
    _day_before,
    _days_since_last_game,
    compute_all_features,
)
from ml.features.registry import FeatureDefinition


class TestDayBefore:
    """Tests for the _day_before helper."""

    def test_normal_date(self):
        assert _day_before("2025-01-15") == "2025-01-14"

    def test_first_of_month(self):
        assert _day_before("2025-02-01") == "2025-01-31"

    def test_first_of_year(self):
        assert _day_before("2025-01-01") == "2024-12-31"

    def test_leap_year(self):
        assert _day_before("2024-03-01") == "2024-02-29"

    def test_non_leap_year(self):
        assert _day_before("2025-03-01") == "2025-02-28"


class TestDaysSinceLastGame:
    """Tests for _days_since_last_game."""

    def test_one_day_ago(self):
        recent = [{"game_date": "2025-01-14"}]
        assert _days_since_last_game(recent, "2025-01-15") == 1

    def test_same_day(self):
        recent = [{"game_date": "2025-01-15"}]
        assert _days_since_last_game(recent, "2025-01-15") == 0

    def test_three_days_ago(self):
        recent = [{"game_date": "2025-01-12"}]
        assert _days_since_last_game(recent, "2025-01-15") == 3

    def test_empty_list_returns_none(self):
        assert _days_since_last_game([], "2025-01-15") is None

    def test_none_returns_none(self):
        assert _days_since_last_game(None, "2025-01-15") is None

    def test_missing_date_returns_none(self):
        recent = [{"game_date": ""}]
        assert _days_since_last_game(recent, "2025-01-15") is None

    def test_uses_first_element(self):
        """Should use the first game in the list (most recent)."""
        recent = [
            {"game_date": "2025-01-14"},
            {"game_date": "2025-01-12"},
        ]
        assert _days_since_last_game(recent, "2025-01-15") == 1


class TestBackToBackDetection:
    """Tests for back-to-back detection via _compute_derived."""

    def _make_b2b_feature(self, name):
        return FeatureDefinition(
            name=name,
            description="test b2b",
            compute_type="derived",
        )

    def test_home_b2b_when_played_yesterday(self):
        """rest_days == 1 means the team played yesterday = back-to-back."""
        feat = self._make_b2b_feature("home_is_back_to_back")
        home_recent = [{"game_date": "2025-01-14"}]
        result = _compute_derived(feat, {}, "TOR", "BOS", home_recent, None, "2025-01-15")
        assert result == 1.0

    def test_home_not_b2b_when_two_days_rest(self):
        feat = self._make_b2b_feature("home_is_back_to_back")
        home_recent = [{"game_date": "2025-01-13"}]
        result = _compute_derived(feat, {}, "TOR", "BOS", home_recent, None, "2025-01-15")
        assert result == 0.0

    def test_away_b2b_when_played_yesterday(self):
        feat = self._make_b2b_feature("away_is_back_to_back")
        away_recent = [{"game_date": "2025-01-14"}]
        result = _compute_derived(feat, {}, "TOR", "BOS", None, away_recent, "2025-01-15")
        assert result == 1.0

    def test_away_not_b2b_when_three_days_rest(self):
        feat = self._make_b2b_feature("away_is_back_to_back")
        away_recent = [{"game_date": "2025-01-12"}]
        result = _compute_derived(feat, {}, "TOR", "BOS", None, away_recent, "2025-01-15")
        assert result == 0.0

    def test_b2b_no_recent_games(self):
        """No recent games should return 0.0 (not back-to-back)."""
        feat = self._make_b2b_feature("home_is_back_to_back")
        result = _compute_derived(feat, {}, "TOR", "BOS", [], None, "2025-01-15")
        assert result == 0.0

    def test_b2b_none_recent_games(self):
        feat = self._make_b2b_feature("home_is_back_to_back")
        result = _compute_derived(feat, {}, "TOR", "BOS", None, None, "2025-01-15")
        assert result == 0.0


class TestComputeDerived:
    """Tests for _compute_derived with different feature types."""

    def test_point_pctg_diff(self):
        feat = FeatureDefinition(
            name="point_pctg_diff",
            description="test",
            compute_type="derived",
        )
        row = {"home_point_pctg": 0.7, "away_point_pctg": 0.5}
        result = _compute_derived(feat, row, "TOR", "BOS", None, None, "2025-01-15")
        assert abs(result - 0.2) < 1e-9

    def test_point_pctg_diff_with_nan(self):
        feat = FeatureDefinition(
            name="point_pctg_diff",
            description="test",
            compute_type="derived",
        )
        row = {"home_point_pctg": np.nan, "away_point_pctg": 0.5}
        result = _compute_derived(feat, row, "TOR", "BOS", None, None, "2025-01-15")
        assert np.isnan(result)

    def test_rest_advantage(self):
        feat = FeatureDefinition(
            name="rest_advantage",
            description="test",
            compute_type="derived",
        )
        home_recent = [{"game_date": "2025-01-13"}]  # 2 days rest
        away_recent = [{"game_date": "2025-01-14"}]   # 1 day rest
        result = _compute_derived(feat, {}, "TOR", "BOS", home_recent, away_recent, "2025-01-15")
        assert result == 1.0  # home has 1 more rest day

    def test_rest_advantage_negative(self):
        feat = FeatureDefinition(
            name="rest_advantage",
            description="test",
            compute_type="derived",
        )
        home_recent = [{"game_date": "2025-01-14"}]  # 1 day rest
        away_recent = [{"game_date": "2025-01-12"}]   # 3 days rest
        result = _compute_derived(feat, {}, "TOR", "BOS", home_recent, away_recent, "2025-01-15")
        assert result == -2.0

    def test_unknown_derived_returns_nan(self):
        feat = FeatureDefinition(
            name="nonexistent_derived",
            description="test",
            compute_type="derived",
        )
        result = _compute_derived(feat, {}, "TOR", "BOS", None, None, "2025-01-15")
        assert np.isnan(result)


class TestComputeRollingTeam:
    """Tests for _compute_rolling_team."""

    def _make_rolling_feature(self, stat, team_key="home_team", window=10):
        return FeatureDefinition(
            name=f"test_{stat}",
            description="test",
            compute_type="rolling_team",
            config={"stat": stat, "team_key": team_key, "window": window},
        )

    def _make_game(self, home_team, away_team, home_score, away_score, date):
        return {
            "home_team_abbrev": home_team,
            "away_team_abbrev": away_team,
            "home_score": home_score,
            "away_score": away_score,
            "game_date": date,
        }

    def test_goals_for_home(self):
        """Home team goals_for should average the home_score when team is home."""
        feat = self._make_rolling_feature("goals_for", "home_team", window=3)
        recent = [
            self._make_game("TOR", "BOS", 4, 2, "2025-01-14"),
            self._make_game("TOR", "BOS", 3, 1, "2025-01-12"),
            self._make_game("TOR", "BOS", 2, 3, "2025-01-10"),
        ]
        result = _compute_rolling_team(feat, "TOR", "BOS", recent, [])
        assert abs(result - 3.0) < 1e-9  # (4 + 3 + 2) / 3

    def test_goals_for_away_games(self):
        """When the team played away, goals_for is the away_score."""
        feat = self._make_rolling_feature("goals_for", "home_team", window=2)
        recent = [
            self._make_game("BOS", "TOR", 2, 5, "2025-01-14"),  # TOR away, scored 5
            self._make_game("TOR", "MTL", 3, 1, "2025-01-12"),  # TOR home, scored 3
        ]
        result = _compute_rolling_team(feat, "TOR", "BOS", recent, [])
        assert abs(result - 4.0) < 1e-9  # (5 + 3) / 2

    def test_goals_against_home(self):
        feat = self._make_rolling_feature("goals_against", "home_team", window=2)
        recent = [
            self._make_game("TOR", "BOS", 4, 2, "2025-01-14"),
            self._make_game("TOR", "MTL", 3, 5, "2025-01-12"),
        ]
        result = _compute_rolling_team(feat, "TOR", "BOS", recent, [])
        assert abs(result - 3.5) < 1e-9  # (2 + 5) / 2

    def test_win_rate(self):
        feat = self._make_rolling_feature("win", "home_team", window=4)
        recent = [
            self._make_game("TOR", "BOS", 4, 2, "2025-01-14"),  # win
            self._make_game("TOR", "MTL", 3, 5, "2025-01-13"),  # loss
            self._make_game("BOS", "TOR", 1, 3, "2025-01-12"),  # TOR away, won
            self._make_game("TOR", "NYR", 2, 4, "2025-01-11"),  # loss
        ]
        result = _compute_rolling_team(feat, "TOR", "BOS", recent, [])
        assert abs(result - 0.5) < 1e-9  # 2 wins / 4 games

    def test_empty_recent_returns_nan(self):
        feat = self._make_rolling_feature("goals_for")
        result = _compute_rolling_team(feat, "TOR", "BOS", [], [])
        assert np.isnan(result)

    def test_window_limits_games(self):
        """Only the first `window` games from the list should be used."""
        feat = self._make_rolling_feature("goals_for", "home_team", window=2)
        recent = [
            self._make_game("TOR", "BOS", 4, 2, "2025-01-14"),
            self._make_game("TOR", "MTL", 6, 1, "2025-01-12"),
            self._make_game("TOR", "NYR", 1, 3, "2025-01-10"),  # outside window
        ]
        result = _compute_rolling_team(feat, "TOR", "BOS", recent, [])
        assert abs(result - 5.0) < 1e-9  # (4 + 6) / 2, ignoring the 3rd game


class TestComputeLookup:
    """Tests for _compute_lookup from standings data."""

    def _make_lookup_feature(self, column, team_key="home_team", table="standings"):
        return FeatureDefinition(
            name=f"test_{column}",
            description="test",
            compute_type="lookup",
            config={"table": table, "column": column, "team_key": team_key},
        )

    def test_lookup_standings_column(self):
        feat = self._make_lookup_feature("point_pctg")
        standings = {"point_pctg": 0.625, "wins": 30}
        result = _compute_lookup(feat, "TOR", "BOS", standings, None, None, "2025-01-15")
        assert abs(result - 0.625) < 1e-9

    def test_lookup_away_team(self):
        feat = self._make_lookup_feature("point_pctg", team_key="away_team")
        away_standings = {"point_pctg": 0.550}
        result = _compute_lookup(feat, "TOR", "BOS", None, away_standings, None, "2025-01-15")
        assert abs(result - 0.550) < 1e-9

    def test_lookup_missing_column_returns_nan(self):
        feat = self._make_lookup_feature("nonexistent_column")
        standings = {"point_pctg": 0.625}
        result = _compute_lookup(feat, "TOR", "BOS", standings, None, None, "2025-01-15")
        assert np.isnan(result)

    def test_lookup_no_standings_returns_nan(self):
        feat = self._make_lookup_feature("point_pctg")
        result = _compute_lookup(feat, "TOR", "BOS", None, None, None, "2025-01-15")
        assert np.isnan(result)


class TestComputeAllFeaturesFunctionExists:
    """Verify that the main orchestrating function exists and is callable."""

    def test_compute_all_features_is_callable(self):
        assert callable(compute_all_features)
