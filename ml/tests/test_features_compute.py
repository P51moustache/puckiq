"""
Tests for ml/features/compute.py — feature computation engine.

Tests the compute helper functions directly (day_before, days_since_last_game,
back-to-back detection, derived features) without requiring Supabase.
Also tests FeatureCache for in-memory lookups with as_of_date filtering.
"""

import numpy as np
import pandas as pd
import pytest

from ml.features.compute import (
    FeatureCache,
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


class TestFeatureCache:
    """Tests for the FeatureCache in-memory lookup class."""

    def _build_cache_with_data(self):
        """Create a FeatureCache populated with test data (no Supabase needed)."""
        cache = FeatureCache()

        # Standings: multiple snapshots per team, sorted by date desc
        cache.standings_by_team = {
            "TOR": [
                {"team_abbrev": "TOR", "snapshot_date": "2025-01-14", "point_pctg": 0.650, "home_wins": 15, "home_losses": 5, "home_ot_losses": 2},
                {"team_abbrev": "TOR", "snapshot_date": "2025-01-10", "point_pctg": 0.620, "home_wins": 13, "home_losses": 5, "home_ot_losses": 2},
                {"team_abbrev": "TOR", "snapshot_date": "2025-01-05", "point_pctg": 0.600, "home_wins": 12, "home_losses": 5, "home_ot_losses": 1},
            ],
            "BOS": [
                {"team_abbrev": "BOS", "snapshot_date": "2025-01-14", "point_pctg": 0.580, "road_wins": 10, "road_losses": 8, "road_ot_losses": 2},
                {"team_abbrev": "BOS", "snapshot_date": "2025-01-10", "point_pctg": 0.560, "road_wins": 9, "road_losses": 8, "road_ot_losses": 2},
            ],
        }

        # Goalie stats
        cache.goalie_stats_by_team = {
            "TOR": [
                {"team_abbrev": "TOR", "games_started": 30, "save_pctg": 0.915, "player_name": "Goalie A"},
                {"team_abbrev": "TOR", "games_started": 10, "save_pctg": 0.905, "player_name": "Goalie B"},
            ],
            "BOS": [
                {"team_abbrev": "BOS", "games_started": 28, "save_pctg": 0.920, "player_name": "Goalie C"},
            ],
        }

        # Team stat categories
        cache.team_stat_categories = {
            ("TOR", "powerplay"): [{"teamFullName": "Toronto", "powerPlayPct": 25.5}],
            ("BOS", "penaltykill"): [{"teamFullName": "Boston", "penaltyKillPct": 82.3}],
        }

        # Recent games (sorted by date desc)
        cache.recent_games_by_team = {
            "TOR": [
                {"id": "g3", "home_team_abbrev": "TOR", "away_team_abbrev": "MTL", "home_score": 4, "away_score": 2, "game_date": "2025-01-14", "game_state": "OFF"},
                {"id": "g2", "home_team_abbrev": "BOS", "away_team_abbrev": "TOR", "home_score": 1, "away_score": 3, "game_date": "2025-01-12", "game_state": "OFF"},
                {"id": "g1", "home_team_abbrev": "TOR", "away_team_abbrev": "NYR", "home_score": 2, "away_score": 5, "game_date": "2025-01-10", "game_state": "OFF"},
            ],
            "BOS": [
                {"id": "g2", "home_team_abbrev": "BOS", "away_team_abbrev": "TOR", "home_score": 1, "away_score": 3, "game_date": "2025-01-12", "game_state": "OFF"},
            ],
        }

        return cache

    # --- Standings lookups ---

    def test_standings_returns_latest_before_date(self):
        """Should return the most recent standings snapshot on or before the date."""
        cache = self._build_cache_with_data()
        result = cache.get_standings("TOR", "2025-01-14")
        assert result is not None
        assert result["snapshot_date"] == "2025-01-14"
        assert abs(result["point_pctg"] - 0.650) < 1e-9

    def test_standings_respects_as_of_date(self):
        """Should NOT return standings from after the as_of_date (leakage prevention)."""
        cache = self._build_cache_with_data()
        result = cache.get_standings("TOR", "2025-01-12")
        assert result is not None
        assert result["snapshot_date"] == "2025-01-10"
        assert abs(result["point_pctg"] - 0.620) < 1e-9

    def test_standings_returns_none_for_unknown_team(self):
        cache = self._build_cache_with_data()
        assert cache.get_standings("UTA", "2025-01-15") is None

    def test_standings_returns_none_when_before_all_snapshots(self):
        """If as_of_date is before all available snapshots, returns None."""
        cache = self._build_cache_with_data()
        assert cache.get_standings("TOR", "2025-01-01") is None

    # --- Goalie stats ---

    def test_goalie_stats_returns_all_goalies(self):
        cache = self._build_cache_with_data()
        goalies = cache.get_goalie_stats("TOR")
        assert len(goalies) == 2
        # Starter has most games
        starter = max(goalies, key=lambda g: g.get("games_started", 0))
        assert abs(starter["save_pctg"] - 0.915) < 1e-9

    def test_goalie_stats_returns_empty_for_unknown_team(self):
        cache = self._build_cache_with_data()
        assert cache.get_goalie_stats("UTA") == []

    # --- Team stat categories ---

    def test_team_stat_category_lookup(self):
        cache = self._build_cache_with_data()
        data = cache.get_team_stat_category("TOR", "powerplay")
        assert data is not None
        assert isinstance(data, list)
        assert data[0]["powerPlayPct"] == 25.5

    def test_team_stat_category_returns_none_for_missing(self):
        cache = self._build_cache_with_data()
        assert cache.get_team_stat_category("TOR", "faceoffs") is None

    # --- Recent games ---

    def test_recent_games_filters_by_date(self):
        """Should only return games with game_date < before_date (leakage prevention)."""
        cache = self._build_cache_with_data()
        # before_date = "2025-01-14", so game on 2025-01-14 should be EXCLUDED
        games = cache.get_recent_games("TOR", "2025-01-14", limit=10)
        assert len(games) == 2
        assert all(g["game_date"] < "2025-01-14" for g in games)

    def test_recent_games_respects_limit(self):
        cache = self._build_cache_with_data()
        games = cache.get_recent_games("TOR", "2025-01-15", limit=1)
        assert len(games) == 1
        assert games[0]["game_date"] == "2025-01-14"  # most recent

    def test_recent_games_returns_empty_for_unknown_team(self):
        cache = self._build_cache_with_data()
        assert cache.get_recent_games("UTA", "2025-01-15") == []

    def test_recent_games_returns_empty_when_before_all_games(self):
        cache = self._build_cache_with_data()
        games = cache.get_recent_games("TOR", "2025-01-01")
        assert games == []

    # --- Integration: cache used in compute functions ---

    def test_lookup_uses_cache_for_goalie_stats(self):
        """_compute_lookup should use cache for goalie_season_stats when cache provided."""
        cache = self._build_cache_with_data()
        feat = FeatureDefinition(
            name="test_goalie",
            description="test",
            compute_type="lookup",
            config={"table": "goalie_season_stats", "column": "save_pctg", "team_key": "home_team"},
        )
        # client=None because cache should be used, no Supabase call needed
        result = _compute_lookup(feat, "TOR", "BOS", None, None, None, "2025-01-15", cache=cache)
        assert abs(result - 0.915) < 1e-9  # TOR starter has 0.915

    def test_compute_all_features_accepts_cache_params(self):
        """compute_all_features should accept use_cache and cache parameters."""
        import inspect
        sig = inspect.signature(compute_all_features)
        assert "use_cache" in sig.parameters
        assert "cache" in sig.parameters
