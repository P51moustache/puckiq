"""
Tests for ml/evaluation/scoring.py — daily prediction scoring.

Tests the internal _compute_score function directly with synthetic
predictions and game results, without requiring a Supabase connection.
"""

from ml.config import ModelType
from ml.evaluation.scoring import _compute_score


class TestScoreGameWinner:
    """Tests for _compute_score with ModelType.GAME_WINNER."""

    def test_correct_home_win_prediction(self):
        prediction = {
            "game_id": "game_1",
            "game_date": "2025-01-15",
            "home_win_prob": 0.7,
            "predicted_winner": "TOR",
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 4,
            "away_score": 2,
        }
        result = _compute_score(prediction, actual, ModelType.GAME_WINNER)
        assert result is not None
        assert result["was_correct"] is True
        assert result["home_win_prob"] == 0.7
        assert result["actual_winner"] == "TOR"

    def test_incorrect_home_win_prediction(self):
        prediction = {
            "game_id": "game_2",
            "game_date": "2025-01-15",
            "home_win_prob": 0.7,
            "predicted_winner": "TOR",
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 2,
            "away_score": 4,
        }
        result = _compute_score(prediction, actual, ModelType.GAME_WINNER)
        assert result is not None
        assert result["was_correct"] is False
        assert result["actual_winner"] == "BOS"

    def test_correct_away_win_prediction(self):
        prediction = {
            "game_id": "game_3",
            "game_date": "2025-01-15",
            "home_win_prob": 0.3,
            "predicted_winner": "BOS",
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 1,
            "away_score": 3,
        }
        result = _compute_score(prediction, actual, ModelType.GAME_WINNER)
        assert result is not None
        assert result["was_correct"] is True

    def test_infers_predicted_winner_from_prob(self):
        """When predicted_winner is empty, infer from home_win_prob."""
        prediction = {
            "game_id": "game_4",
            "game_date": "2025-01-15",
            "home_win_prob": 0.6,
            "predicted_winner": "",
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 3,
            "away_score": 2,
        }
        result = _compute_score(prediction, actual, ModelType.GAME_WINNER)
        assert result is not None
        assert result["predicted_winner"] == "home"
        assert result["was_correct"] is True

    def test_exactly_50_percent_predicts_home(self):
        """0.5 home_win_prob should predict home (>= 0.5)."""
        prediction = {
            "game_id": "game_5",
            "game_date": "2025-01-15",
            "home_win_prob": 0.5,
            "predicted_winner": "",
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 3,
            "away_score": 2,
        }
        result = _compute_score(prediction, actual, ModelType.GAME_WINNER)
        assert result["was_correct"] is True

    def test_base_fields_present(self):
        prediction = {
            "game_id": "game_6",
            "game_date": "2025-01-15",
            "home_win_prob": 0.6,
            "predicted_winner": "TOR",
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 3,
            "away_score": 2,
        }
        result = _compute_score(prediction, actual, ModelType.GAME_WINNER)
        assert result["game_id"] == "game_6"
        assert result["game_date"] == "2025-01-15"
        assert result["model_type"] == ModelType.GAME_WINNER
        assert result["actual_spread"] == 1  # 3 - 2
        assert result["actual_total"] == 5   # 3 + 2
        assert "scored_at" in result


class TestScoreSpread:
    """Tests for _compute_score with ModelType.SPREAD."""

    def test_spread_prediction(self):
        prediction = {
            "game_id": "game_7",
            "game_date": "2025-01-15",
            "predicted_spread": 1.5,
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 4,
            "away_score": 2,
        }
        result = _compute_score(prediction, actual, ModelType.SPREAD)
        assert result is not None
        assert result["predicted_spread"] == 1.5
        assert result["spread_error"] == abs(1.5 - 2)  # |1.5 - (4-2)| = 0.5
        assert result["actual_spread"] == 2

    def test_perfect_spread_prediction(self):
        prediction = {
            "game_id": "game_8",
            "game_date": "2025-01-15",
            "predicted_spread": 2.0,
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 4,
            "away_score": 2,
        }
        result = _compute_score(prediction, actual, ModelType.SPREAD)
        assert result["spread_error"] == 0.0

    def test_negative_spread(self):
        """Away win should produce negative actual_spread."""
        prediction = {
            "game_id": "game_9",
            "game_date": "2025-01-15",
            "predicted_spread": -1.0,
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 2,
            "away_score": 4,
        }
        result = _compute_score(prediction, actual, ModelType.SPREAD)
        assert result["actual_spread"] == -2
        assert result["spread_error"] == abs(-1.0 - (-2))  # 1.0


class TestScoreTotals:
    """Tests for _compute_score with ModelType.TOTALS."""

    def test_totals_prediction(self):
        prediction = {
            "game_id": "game_10",
            "game_date": "2025-01-15",
            "predicted_total": 5.5,
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 3,
            "away_score": 2,
        }
        result = _compute_score(prediction, actual, ModelType.TOTALS)
        assert result is not None
        assert result["predicted_total"] == 5.5
        assert result["actual_total"] == 5
        assert result["total_error"] == 0.5

    def test_perfect_total_prediction(self):
        prediction = {
            "game_id": "game_11",
            "game_date": "2025-01-15",
            "predicted_total": 6.0,
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 4,
            "away_score": 2,
        }
        result = _compute_score(prediction, actual, ModelType.TOTALS)
        assert result["total_error"] == 0.0

    def test_high_scoring_game(self):
        prediction = {
            "game_id": "game_12",
            "game_date": "2025-01-15",
            "predicted_total": 5.0,
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 7,
            "away_score": 5,
        }
        result = _compute_score(prediction, actual, ModelType.TOTALS)
        assert result["actual_total"] == 12
        assert result["total_error"] == 7.0


class TestScoreUnknownModelType:
    """Tests for unknown model types."""

    def test_unknown_model_returns_none(self):
        prediction = {"game_id": "game_13", "game_date": "2025-01-15"}
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 3,
            "away_score": 2,
        }
        result = _compute_score(prediction, actual, "unknown_model")
        assert result is None


class TestScoreWithMissingData:
    """Tests for edge cases with missing or None scores."""

    def test_none_scores_skipped(self):
        """Games with None scores should be skipped entirely."""
        prediction = {
            "game_id": "game_14",
            "game_date": "2025-01-15",
            "home_win_prob": 0.6,
            "predicted_winner": "TOR",
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": None,
            "away_score": None,
        }
        result = _compute_score(prediction, actual, ModelType.GAME_WINNER)
        assert result is None

    def test_partial_none_score_skipped(self):
        """If only one score is None, still skip."""
        prediction = {
            "game_id": "game_14b",
            "game_date": "2025-01-15",
            "home_win_prob": 0.6,
            "predicted_winner": "TOR",
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 3,
            "away_score": None,
        }
        result = _compute_score(prediction, actual, ModelType.GAME_WINNER)
        assert result is None

    def test_missing_predicted_spread_defaults(self):
        prediction = {
            "game_id": "game_15",
            "game_date": "2025-01-15",
            # No predicted_spread key
        }
        actual = {
            "home_team_abbrev": "TOR",
            "away_team_abbrev": "BOS",
            "home_score": 3,
            "away_score": 2,
        }
        result = _compute_score(prediction, actual, ModelType.SPREAD)
        assert result["predicted_spread"] == 0.0
        assert result["spread_error"] == 1.0  # |0 - 1|
