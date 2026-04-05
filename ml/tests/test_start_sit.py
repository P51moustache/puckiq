"""Tests for ml.fantasy.start_sit — start/sit recommendation engine."""

import pytest

from ml.fantasy.start_sit import compute_start_sit


# ---------------------------------------------------------------------------
# Must-start: high projection, hot trend, weak opponent
# ---------------------------------------------------------------------------

class TestMustStart:
    def test_high_projection_hot_weak_opponent(self):
        result = compute_start_sit({
            "fantasy_points": 8.0,
            "floor": 5.0,
            "ceiling": 12.0,
            "is_b2b": False,
            "trend": "HOT",
            "opponent_rank": 30,
        })
        assert result["recommendation"] == "START"
        assert result["confidence"] == "high"
        assert result["score"] >= 0.6

    def test_strong_projection_warm_trend(self):
        result = compute_start_sit({
            "fantasy_points": 6.0,
            "floor": 4.0,
            "ceiling": 9.0,
            "is_b2b": False,
            "trend": "WARM",
            "opponent_rank": 20,
        })
        assert result["recommendation"] == "START"


# ---------------------------------------------------------------------------
# Must-sit: low projection, cold trend, tough opponent, B2B
# ---------------------------------------------------------------------------

class TestMustSit:
    def test_low_projection_cold_tough_b2b(self):
        result = compute_start_sit({
            "fantasy_points": 1.0,
            "floor": 0.5,
            "ceiling": 2.0,
            "is_b2b": True,
            "trend": "COLD",
            "opponent_rank": 2,
        })
        assert result["recommendation"] == "SIT"
        assert result["confidence"] == "high"
        assert result["score"] < 0.35

    def test_zero_projection(self):
        result = compute_start_sit({
            "fantasy_points": 0.0,
            "floor": 0.0,
            "ceiling": 0.0,
            "is_b2b": False,
            "trend": "STEADY",
            "opponent_rank": 16,
        })
        assert result["recommendation"] == "SIT"


# ---------------------------------------------------------------------------
# Upside play: medium projection but high ceiling spread
# ---------------------------------------------------------------------------

class TestUpside:
    def test_medium_projection_high_spread(self):
        result = compute_start_sit({
            "fantasy_points": 3.5,
            "floor": 1.0,
            "ceiling": 8.0,  # spread = 7 > 5
            "is_b2b": False,
            "trend": "STEADY",
            "opponent_rank": 20,
        })
        assert result["recommendation"] == "UPSIDE"
        assert "high ceiling spread" in result["reason"].lower()

    def test_upside_requires_spread(self):
        """Same score range but low spread -> FLEX, not UPSIDE."""
        result = compute_start_sit({
            "fantasy_points": 3.5,
            "floor": 2.0,
            "ceiling": 5.0,  # spread = 3 < 5
            "is_b2b": False,
            "trend": "STEADY",
            "opponent_rank": 20,
        })
        assert result["recommendation"] != "UPSIDE"


# ---------------------------------------------------------------------------
# Flex: borderline case
# ---------------------------------------------------------------------------

class TestFlex:
    def test_borderline_flex(self):
        result = compute_start_sit({
            "fantasy_points": 2.5,
            "floor": 1.5,
            "ceiling": 4.0,  # spread = 2.5 < 5
            "is_b2b": False,
            "trend": "STEADY",
            "opponent_rank": 16,
        })
        assert result["recommendation"] == "FLEX"

    def test_flex_with_cool_trend(self):
        result = compute_start_sit({
            "fantasy_points": 3.0,
            "floor": 1.5,
            "ceiling": 4.5,
            "is_b2b": False,
            "trend": "COOL",
            "opponent_rank": 16,
        })
        assert result["recommendation"] in ("FLEX", "SIT")


# ---------------------------------------------------------------------------
# Confidence levels
# ---------------------------------------------------------------------------

class TestConfidence:
    def test_high_confidence_start(self):
        """Score well above 0.5 -> high confidence."""
        result = compute_start_sit({
            "fantasy_points": 8.0,
            "floor": 5.0,
            "ceiling": 10.0,
            "trend": "HOT",
            "opponent_rank": 28,
        })
        assert result["confidence"] == "high"

    def test_high_confidence_sit(self):
        """Score well below 0.5 -> high confidence."""
        result = compute_start_sit({
            "fantasy_points": 0.5,
            "floor": 0.0,
            "ceiling": 1.0,
            "is_b2b": True,
            "trend": "COLD",
            "opponent_rank": 3,
        })
        assert result["confidence"] == "high"

    def test_low_confidence_borderline(self):
        """Score near 0.5 -> low confidence."""
        result = compute_start_sit({
            "fantasy_points": 3.0,
            "floor": 1.5,
            "ceiling": 5.0,
            "is_b2b": False,
            "trend": "STEADY",
            "opponent_rank": 16,
        })
        assert result["confidence"] == "low"


# ---------------------------------------------------------------------------
# Reason string
# ---------------------------------------------------------------------------

class TestReason:
    def test_hot_trend_in_reason(self):
        result = compute_start_sit({
            "fantasy_points": 5.0,
            "floor": 3.0,
            "ceiling": 7.0,
            "trend": "HOT",
            "opponent_rank": 16,
        })
        assert "trending hot" in result["reason"].lower()

    def test_cold_trend_in_reason(self):
        result = compute_start_sit({
            "fantasy_points": 2.0,
            "floor": 1.0,
            "ceiling": 3.0,
            "trend": "COLD",
            "opponent_rank": 16,
        })
        assert "trending cold" in result["reason"].lower()

    def test_b2b_in_reason(self):
        result = compute_start_sit({
            "fantasy_points": 4.0,
            "floor": 2.0,
            "ceiling": 6.0,
            "is_b2b": True,
            "trend": "STEADY",
            "opponent_rank": 16,
        })
        assert "back-to-back" in result["reason"].lower()

    def test_soft_matchup_in_reason(self):
        result = compute_start_sit({
            "fantasy_points": 4.0,
            "floor": 2.0,
            "ceiling": 6.0,
            "trend": "STEADY",
            "opponent_rank": 30,
        })
        assert "soft matchup" in result["reason"].lower()

    def test_tough_matchup_in_reason(self):
        result = compute_start_sit({
            "fantasy_points": 4.0,
            "floor": 2.0,
            "ceiling": 6.0,
            "trend": "STEADY",
            "opponent_rank": 3,
        })
        assert "tough matchup" in result["reason"].lower()

    def test_default_reason_for_average(self):
        result = compute_start_sit({
            "fantasy_points": 4.0,
            "floor": 2.0,
            "ceiling": 5.0,
            "trend": "STEADY",
            "opponent_rank": 16,
        })
        assert result["reason"] == "average matchup, steady form"


# ---------------------------------------------------------------------------
# Edge cases: missing optional keys use defaults
# ---------------------------------------------------------------------------

class TestDefaults:
    def test_only_fantasy_points(self):
        """Only required key provided; defaults fill the rest."""
        result = compute_start_sit({"fantasy_points": 4.0})
        assert result["recommendation"] in ("START", "SIT", "UPSIDE", "FLEX")
        assert result["confidence"] in ("high", "medium", "low")
        assert 0.0 <= result["score"] <= 1.0
        assert isinstance(result["reason"], str)

    def test_missing_floor_defaults_zero(self):
        r1 = compute_start_sit({"fantasy_points": 4.0})
        r2 = compute_start_sit({"fantasy_points": 4.0, "floor": 0.0})
        assert r1["score"] == r2["score"]

    def test_missing_ceiling_defaults_to_fp(self):
        r1 = compute_start_sit({"fantasy_points": 4.0})
        r2 = compute_start_sit({"fantasy_points": 4.0, "ceiling": 4.0})
        assert r1["score"] == r2["score"]

    def test_missing_trend_defaults_steady(self):
        r1 = compute_start_sit({"fantasy_points": 4.0})
        r2 = compute_start_sit({"fantasy_points": 4.0, "trend": "STEADY"})
        assert r1["score"] == r2["score"]

    def test_missing_opponent_rank_defaults_16(self):
        r1 = compute_start_sit({"fantasy_points": 4.0})
        r2 = compute_start_sit({"fantasy_points": 4.0, "opponent_rank": 16})
        assert r1["score"] == r2["score"]


# ---------------------------------------------------------------------------
# Score clamping
# ---------------------------------------------------------------------------

class TestClamping:
    def test_score_never_below_zero(self):
        result = compute_start_sit({
            "fantasy_points": 0.0,
            "floor": 0.0,
            "ceiling": 0.0,
            "is_b2b": True,
            "trend": "COLD",
            "opponent_rank": 1,
        })
        assert result["score"] >= 0.0

    def test_score_never_above_one(self):
        result = compute_start_sit({
            "fantasy_points": 100.0,
            "floor": 100.0,
            "ceiling": 200.0,
            "is_b2b": False,
            "trend": "HOT",
            "opponent_rank": 32,
        })
        assert result["score"] <= 1.0
