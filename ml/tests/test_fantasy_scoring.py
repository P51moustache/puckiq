"""Tests for fantasy scoring format definitions."""

import pytest

from ml.fantasy.scoring import SCORING_FORMATS, compute_fantasy_points


class TestScoringFormats:
    """Tests for the SCORING_FORMATS dictionary."""

    def test_all_formats_defined(self):
        assert "yahoo" in SCORING_FORMATS
        assert "espn" in SCORING_FORMATS

    def test_all_player_types_defined(self):
        for fmt in SCORING_FORMATS:
            assert "skater" in SCORING_FORMATS[fmt], f"{fmt} missing skater"
            assert "goalie" in SCORING_FORMATS[fmt], f"{fmt} missing goalie"

    def test_yahoo_skater_weights(self):
        w = SCORING_FORMATS["yahoo"]["skater"]
        assert w["goals"] == 3.0
        assert w["assists"] == 2.0
        assert w["plus_minus"] == 1.0
        assert w["ppp"] == 1.0
        assert w["sog"] == 0.5
        assert w["hits"] == 0.5
        assert w["blocks"] == 0.5

    def test_espn_skater_weights(self):
        w = SCORING_FORMATS["espn"]["skater"]
        assert w["goals"] == 3.0
        assert w["assists"] == 2.0
        assert w["sog"] == 0.3
        assert w["hits"] == 0.3
        assert w["blocks"] == 0.5

    def test_yahoo_goalie_weights(self):
        w = SCORING_FORMATS["yahoo"]["goalie"]
        assert w["wins"] == 5.0
        assert w["saves"] == 0.2
        assert w["goals_against"] == -1.0
        assert w["shutouts"] == 3.0

    def test_espn_goalie_weights(self):
        w = SCORING_FORMATS["espn"]["goalie"]
        assert w["wins"] == 5.0
        assert w["saves"] == 0.2
        assert w["goals_against"] == -1.0
        assert w["shutouts"] == 3.0

    def test_yahoo_and_espn_goalie_identical(self):
        assert SCORING_FORMATS["yahoo"]["goalie"] == SCORING_FORMATS["espn"]["goalie"]

    def test_yahoo_and_espn_skater_differ(self):
        """Yahoo and ESPN skater formats differ on sog and hits weights."""
        y = SCORING_FORMATS["yahoo"]["skater"]
        e = SCORING_FORMATS["espn"]["skater"]
        assert y["sog"] != e["sog"]
        assert y["hits"] != e["hits"]


class TestComputeFantasyPoints:
    """Tests for compute_fantasy_points function."""

    def test_yahoo_skater_known_values(self):
        stats = {"goals": 2, "assists": 1, "sog": 4, "hits": 3, "blocks": 1}
        # 2*3 + 1*2 + 4*0.5 + 3*0.5 + 1*0.5 = 6 + 2 + 2 + 1.5 + 0.5 = 12.0
        assert compute_fantasy_points(stats, "yahoo", "skater") == 12.0

    def test_espn_skater_known_values(self):
        stats = {"goals": 2, "assists": 1, "sog": 4, "hits": 3, "blocks": 1}
        # 2*3 + 1*2 + 4*0.3 + 3*0.3 + 1*0.5 = 6 + 2 + 1.2 + 0.9 + 0.5 = 10.6
        result = compute_fantasy_points(stats, "espn", "skater")
        assert abs(result - 10.6) < 1e-9

    def test_yahoo_goalie_known_values(self):
        stats = {"wins": 1, "saves": 30, "goals_against": 2, "shutouts": 0}
        # 1*5 + 30*0.2 + 2*(-1) + 0*3 = 5 + 6 - 2 + 0 = 9.0
        assert compute_fantasy_points(stats, "yahoo", "goalie") == 9.0

    def test_espn_goalie_known_values(self):
        stats = {"wins": 1, "saves": 30, "goals_against": 2, "shutouts": 0}
        assert compute_fantasy_points(stats, "espn", "goalie") == 9.0

    def test_goalie_shutout_game(self):
        stats = {"wins": 1, "saves": 25, "goals_against": 0, "shutouts": 1}
        # 1*5 + 25*0.2 + 0*(-1) + 1*3 = 5 + 5 + 0 + 3 = 13.0
        assert compute_fantasy_points(stats, "yahoo", "goalie") == 13.0

    def test_missing_stat_keys_default_to_zero(self):
        stats = {"goals": 1}  # only goals, everything else missing
        # 1*3 = 3.0
        assert compute_fantasy_points(stats, "yahoo", "skater") == 3.0

    def test_empty_stats_returns_zero(self):
        assert compute_fantasy_points({}, "yahoo", "skater") == 0.0
        assert compute_fantasy_points({}, "espn", "skater") == 0.0
        assert compute_fantasy_points({}, "yahoo", "goalie") == 0.0
        assert compute_fantasy_points({}, "espn", "goalie") == 0.0

    def test_extra_stat_keys_ignored(self):
        stats = {"goals": 1, "faceoff_wins": 10}
        # faceoff_wins not in weights, should be ignored
        assert compute_fantasy_points(stats, "yahoo", "skater") == 3.0

    def test_unknown_format_raises(self):
        with pytest.raises(ValueError, match="Unknown format"):
            compute_fantasy_points({"goals": 1}, "fantrax", "skater")

    def test_unknown_player_type_raises(self):
        with pytest.raises(ValueError, match="Unknown player_type"):
            compute_fantasy_points({"goals": 1}, "yahoo", "defenseman")

    def test_negative_stat_values(self):
        stats = {"plus_minus": -3}
        # -3 * 1.0 = -3.0
        assert compute_fantasy_points(stats, "yahoo", "skater") == -3.0

    def test_fractional_stats(self):
        stats = {"goals": 0.5, "assists": 0.3}
        # 0.5*3 + 0.3*2 = 1.5 + 0.6 = 2.1
        result = compute_fantasy_points(stats, "yahoo", "skater")
        assert abs(result - 2.1) < 1e-9
