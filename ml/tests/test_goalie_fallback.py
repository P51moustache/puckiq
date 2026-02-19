"""
Tests for goalie save_pctg NULL fallback computation.

The goalie_season_stats table has save_pctg as NULL for ALL goalies in the DB.
Both _compute_lookup (season-level) and _compute_rolling_goalie (game-level
fallback to season-level) handle this by computing save_pctg from:

    saves / (saves + goals_against)

These tests verify every edge case of that fallback path, plus the case where
save_pctg IS populated (should use it directly).
"""

import numpy as np
import pytest

from ml.features.compute import (
    FeatureCache,
    _compute_lookup,
    _compute_rolling_goalie,
)
from ml.features.registry import FeatureDefinition


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_goalie_lookup_feature(team_key="home_team", select="starter"):
    """Create a FeatureDefinition for goalie save_pctg lookup."""
    return FeatureDefinition(
        name="test_goalie_save_pctg",
        description="test goalie save pctg",
        compute_type="lookup",
        config={
            "table": "goalie_season_stats",
            "column": "save_pctg",
            "team_key": team_key,
            "select": select,
        },
    )


def _make_rolling_goalie_feature(team_key="home_team", window=10):
    """Create a FeatureDefinition for rolling goalie save%."""
    return FeatureDefinition(
        name="test_rolling_goalie",
        description="test rolling goalie",
        compute_type="rolling_goalie",
        config={"team_key": team_key, "window": window},
    )


def _build_cache_with_goalies(goalie_stats_by_team):
    """Build a FeatureCache with only goalie data populated."""
    cache = FeatureCache()
    cache.goalie_stats_by_team = goalie_stats_by_team
    return cache


# ---------------------------------------------------------------------------
# Test _compute_lookup: goalie save_pctg NULL fallback
# ---------------------------------------------------------------------------


class TestGoalieSavePctgFallback:
    """Tests for save_pctg NULL fallback in _compute_lookup."""

    def test_normal_save_pctg_computation_when_null(self):
        """When save_pctg is None, compute from saves / (saves + goals_against)."""
        cache = _build_cache_with_goalies({
            "TOR": [
                {
                    "team_abbrev": "TOR",
                    "games_started": 30,
                    "save_pctg": None,
                    "saves": 180,
                    "goals_against": 20,
                    "player_name": "Starter",
                },
            ],
        })
        feat = _make_goalie_lookup_feature()
        result = _compute_lookup(
            feat, "TOR", "BOS", None, None, None, "2025-01-15", cache=cache,
        )
        assert abs(result - 0.90) < 1e-9  # 180 / (180 + 20) = 0.90

    def test_zero_saves_and_zero_goals_against(self):
        """Both saves and goals_against are 0 -- should not divide by zero, return NaN."""
        cache = _build_cache_with_goalies({
            "TOR": [
                {
                    "team_abbrev": "TOR",
                    "games_started": 1,
                    "save_pctg": None,
                    "saves": 0,
                    "goals_against": 0,
                    "player_name": "Starter",
                },
            ],
        })
        feat = _make_goalie_lookup_feature()
        result = _compute_lookup(
            feat, "TOR", "BOS", None, None, None, "2025-01-15", cache=cache,
        )
        # saves + goals_against == 0, so the (saves + ga) > 0 check fails.
        # value remains None, which maps to np.nan.
        assert np.isnan(result)

    def test_zero_saves_nonzero_goals_against(self):
        """saves=0, goals_against=10 -- save_pctg should be 0.0."""
        cache = _build_cache_with_goalies({
            "TOR": [
                {
                    "team_abbrev": "TOR",
                    "games_started": 10,
                    "save_pctg": None,
                    "saves": 0,
                    "goals_against": 10,
                    "player_name": "Starter",
                },
            ],
        })
        feat = _make_goalie_lookup_feature()
        result = _compute_lookup(
            feat, "TOR", "BOS", None, None, None, "2025-01-15", cache=cache,
        )
        assert abs(result - 0.0) < 1e-9  # 0 / (0 + 10) = 0.0

    def test_zero_goals_against_nonzero_saves(self):
        """goals_against=0, saves=100 -- save_pctg should be 1.0 (perfect)."""
        cache = _build_cache_with_goalies({
            "TOR": [
                {
                    "team_abbrev": "TOR",
                    "games_started": 10,
                    "save_pctg": None,
                    "saves": 100,
                    "goals_against": 0,
                    "player_name": "Starter",
                },
            ],
        })
        feat = _make_goalie_lookup_feature()
        result = _compute_lookup(
            feat, "TOR", "BOS", None, None, None, "2025-01-15", cache=cache,
        )
        assert abs(result - 1.0) < 1e-9  # 100 / (100 + 0) = 1.0

    def test_saves_and_goals_against_both_none(self):
        """When saves and goals_against are both None, fallback can't compute -- return NaN."""
        cache = _build_cache_with_goalies({
            "TOR": [
                {
                    "team_abbrev": "TOR",
                    "games_started": 10,
                    "save_pctg": None,
                    "saves": None,
                    "goals_against": None,
                    "player_name": "Starter",
                },
            ],
        })
        feat = _make_goalie_lookup_feature()
        result = _compute_lookup(
            feat, "TOR", "BOS", None, None, None, "2025-01-15", cache=cache,
        )
        assert np.isnan(result)

    def test_saves_none_goals_against_has_value(self):
        """When only saves is None, the 'saves is not None' guard fails -- return NaN."""
        cache = _build_cache_with_goalies({
            "TOR": [
                {
                    "team_abbrev": "TOR",
                    "games_started": 10,
                    "save_pctg": None,
                    "saves": None,
                    "goals_against": 20,
                    "player_name": "Starter",
                },
            ],
        })
        feat = _make_goalie_lookup_feature()
        result = _compute_lookup(
            feat, "TOR", "BOS", None, None, None, "2025-01-15", cache=cache,
        )
        assert np.isnan(result)

    def test_non_null_save_pctg_used_directly(self):
        """When save_pctg is NOT None, it should be used as-is (no recomputation)."""
        cache = _build_cache_with_goalies({
            "TOR": [
                {
                    "team_abbrev": "TOR",
                    "games_started": 30,
                    "save_pctg": 0.915,
                    "saves": 999,  # Would give a different value if recomputed
                    "goals_against": 1,
                    "player_name": "Starter",
                },
            ],
        })
        feat = _make_goalie_lookup_feature()
        result = _compute_lookup(
            feat, "TOR", "BOS", None, None, None, "2025-01-15", cache=cache,
        )
        # Should use the provided 0.915, not recompute from saves/ga
        assert abs(result - 0.915) < 1e-9

    def test_backup_goalie_null_save_pctg(self):
        """Backup goalie (second by games_started) should also use the fallback."""
        cache = _build_cache_with_goalies({
            "TOR": [
                {
                    "team_abbrev": "TOR",
                    "games_started": 40,
                    "save_pctg": None,
                    "saves": 900,
                    "goals_against": 100,
                    "player_name": "Starter",
                },
                {
                    "team_abbrev": "TOR",
                    "games_started": 15,
                    "save_pctg": None,
                    "saves": 300,
                    "goals_against": 40,
                    "player_name": "Backup",
                },
            ],
        })
        feat = _make_goalie_lookup_feature(select="backup")
        result = _compute_lookup(
            feat, "TOR", "BOS", None, None, None, "2025-01-15", cache=cache,
        )
        # Backup: 300 / (300 + 40) = 0.8824...
        expected = 300.0 / (300.0 + 40.0)
        assert abs(result - expected) < 1e-9

    def test_away_team_goalie_fallback(self):
        """Fallback should work for the away team too."""
        cache = _build_cache_with_goalies({
            "BOS": [
                {
                    "team_abbrev": "BOS",
                    "games_started": 25,
                    "save_pctg": None,
                    "saves": 750,
                    "goals_against": 50,
                    "player_name": "Away Starter",
                },
            ],
        })
        feat = _make_goalie_lookup_feature(team_key="away_team")
        result = _compute_lookup(
            feat, "TOR", "BOS", None, None, None, "2025-01-15", cache=cache,
        )
        expected = 750.0 / (750.0 + 50.0)
        assert abs(result - expected) < 1e-9

    def test_no_goalies_returns_nan(self):
        """No goalie data for the team should return NaN."""
        cache = _build_cache_with_goalies({})
        feat = _make_goalie_lookup_feature()
        result = _compute_lookup(
            feat, "TOR", "BOS", None, None, None, "2025-01-15", cache=cache,
        )
        assert np.isnan(result)


# ---------------------------------------------------------------------------
# Test _compute_rolling_goalie: season-level fallback with NULL save_pctg
# ---------------------------------------------------------------------------


class TestRollingGoalieFallback:
    """Tests for _compute_rolling_goalie's season-level fallback with NULL save_pctg.

    _compute_rolling_goalie first tries game-level goalie stats from
    game_goalie_stats. If that path doesn't yield results (not enough starts,
    no game-level data), it falls back to season-level goalie stats from
    goalie_season_stats -- which has the same NULL save_pctg issue.

    We test the season-level fallback path by providing a cache with goalie
    stats but no recent games (which skips the game-level path).
    """

    def test_season_fallback_with_null_save_pctg(self):
        """When game-level data is unavailable, fall back to season stats with NULL handling."""
        cache = FeatureCache()
        cache.goalie_stats_by_team = {
            "TOR": [
                {
                    "team_abbrev": "TOR",
                    "games_started": 30,
                    "save_pctg": None,
                    "saves": 800,
                    "goals_against": 80,
                    "player_name": "Starter",
                },
            ],
        }
        # No recent games in cache -- skips game-level path
        cache.recent_games_by_team = {}

        feat = _make_rolling_goalie_feature()
        # client=None because we're using cache and the game-level query
        # will be skipped (no recent_game_ids).
        result = _compute_rolling_goalie(
            feat, "TOR", "BOS", None, "2025-01-15", cache=cache,
        )
        expected = 800.0 / (800.0 + 80.0)  # 0.909...
        assert abs(result - expected) < 1e-6

    def test_season_fallback_with_non_null_save_pctg(self):
        """When save_pctg is present, use it directly in the fallback."""
        cache = FeatureCache()
        cache.goalie_stats_by_team = {
            "TOR": [
                {
                    "team_abbrev": "TOR",
                    "games_started": 30,
                    "save_pctg": 0.920,
                    "saves": 800,
                    "goals_against": 80,
                    "player_name": "Starter",
                },
            ],
        }
        cache.recent_games_by_team = {}

        feat = _make_rolling_goalie_feature()
        result = _compute_rolling_goalie(
            feat, "TOR", "BOS", None, "2025-01-15", cache=cache,
        )
        assert abs(result - 0.920) < 1e-9

    def test_season_fallback_zero_saves_and_ga(self):
        """Both 0 in season stats -- can't compute, return NaN."""
        cache = FeatureCache()
        cache.goalie_stats_by_team = {
            "TOR": [
                {
                    "team_abbrev": "TOR",
                    "games_started": 1,
                    "save_pctg": None,
                    "saves": 0,
                    "goals_against": 0,
                    "player_name": "Starter",
                },
            ],
        }
        cache.recent_games_by_team = {}

        feat = _make_rolling_goalie_feature()
        result = _compute_rolling_goalie(
            feat, "TOR", "BOS", None, "2025-01-15", cache=cache,
        )
        assert np.isnan(result)

    def test_season_fallback_selects_starter_by_most_games(self):
        """The starter is the goalie with the most games_started."""
        cache = FeatureCache()
        cache.goalie_stats_by_team = {
            "TOR": [
                {
                    "team_abbrev": "TOR",
                    "games_started": 10,
                    "save_pctg": None,
                    "saves": 200,
                    "goals_against": 30,
                    "player_name": "Backup",
                },
                {
                    "team_abbrev": "TOR",
                    "games_started": 35,
                    "save_pctg": None,
                    "saves": 900,
                    "goals_against": 70,
                    "player_name": "Starter",
                },
            ],
        }
        cache.recent_games_by_team = {}

        feat = _make_rolling_goalie_feature()
        result = _compute_rolling_goalie(
            feat, "TOR", "BOS", None, "2025-01-15", cache=cache,
        )
        # Starter (35 GP): 900 / (900 + 70) = 0.9278...
        expected = 900.0 / (900.0 + 70.0)
        assert abs(result - expected) < 1e-6

    def test_no_goalie_data_returns_nan(self):
        """No goalie stats at all -- should return NaN."""
        cache = FeatureCache()
        cache.goalie_stats_by_team = {}
        cache.recent_games_by_team = {}

        feat = _make_rolling_goalie_feature()
        result = _compute_rolling_goalie(
            feat, "TOR", "BOS", None, "2025-01-15", cache=cache,
        )
        assert np.isnan(result)

    def test_away_team_rolling_goalie_fallback(self):
        """Fallback should work for the away team via team_key='away_team'."""
        cache = FeatureCache()
        cache.goalie_stats_by_team = {
            "BOS": [
                {
                    "team_abbrev": "BOS",
                    "games_started": 28,
                    "save_pctg": None,
                    "saves": 700,
                    "goals_against": 60,
                    "player_name": "Away Starter",
                },
            ],
        }
        cache.recent_games_by_team = {}

        feat = _make_rolling_goalie_feature(team_key="away_team")
        result = _compute_rolling_goalie(
            feat, "TOR", "BOS", None, "2025-01-15", cache=cache,
        )
        expected = 700.0 / (700.0 + 60.0)
        assert abs(result - expected) < 1e-6
