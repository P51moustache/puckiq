from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from ml.evaluation.cohort import build_version_scores
from ml.pipeline.monthly_eval import _evaluate_game_winner


def game(id=1, **changes):
    return dict(id=id, game_date="2026-10-10", season=20262027, game_type=2,
                game_state="OFF", start_time_utc="2026-10-10T23:00:00Z",
                home_team_abbrev="TOR", away_team_abbrev="BOS", home_score=1,
                away_score=4, **changes)


def prediction(id=1, **changes):
    row = dict(game_id=id, game_date="2026-10-10", model_type="game_winner",
               model_version="v2", home_win_prob=.2, data_quality="fresh",
               predicted_at="2026-10-10T12:00:00Z")
    return row | changes


def test_cohort_excludes_wrong_versions_periods_preseason_and_postgame_forecasts():
    games = [game(i) for i in range(1, 7)]
    games[3]["game_type"] = 1
    rows = [prediction(), prediction(2, model_version="v1"),
            prediction(3, game_date="2026-09-10"), prediction(4),
            prediction(5, predicted_at="2026-10-11T01:00:00Z"),
            prediction(6, predicted_at=None)]
    scores = build_version_scores(rows, games, "game_winner", "v2", "2026-10-01", "2026-11-01")
    assert scores["game_id"].tolist() == [1]
    assert scores.iloc[0]["was_correct"]
    assert scores.iloc[0]["actual_spread"] == -3


def test_calibration_uses_home_win_outcome_and_same_game_home_baseline():
    scores = pd.DataFrame([dict(game_id=1, game_date="2026-10-10", home_win_prob=.2,
                                actual_spread=-3, was_correct=True)])
    with patch("ml.pipeline.monthly_eval._load_model_metadata_history", return_value=[]):
        report = _evaluate_game_winner(MagicMock(), scores, "v2", "2026-11-01")
    populated = [b for b in report["calibration_buckets"] if b["count"]]
    assert populated[0]["actual_avg"] == 0
    assert report["vs_naive_baseline"] == 1
    assert report["vs_simple_baseline"] is None
    assert report["vs_rule_based"] is None
    assert report["train_val_gap_history"][-1]["ece"] == pytest.approx(.2)


def test_invalid_or_stale_forecasts_cannot_become_evidence():
    for value in [float("nan"), None, -1, 1.1]:
        assert build_version_scores([prediction(home_win_prob=value)], [game()],
                                    "game_winner", "v2", "2026-10-01", "2026-11-01").empty
    assert build_version_scores([prediction(data_quality="stale")], [game()],
                                "game_winner", "v2", "2026-10-01", "2026-11-01").empty
