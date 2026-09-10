from datetime import datetime, timezone

import pytest

from ml.season import resolve_season, training_seasons
from ml.features.compute import FeatureCache
from unittest.mock import MagicMock, patch
import pandas as pd
from ml.pipeline.daily_run import _run


@pytest.mark.parametrize("date,expected", [
    ("2026-06-30T23:59:59+00:00", 20252026),
    ("2026-07-01T00:00:00+00:00", 20262027),
    ("2026-10-07T18:00:00+00:00", 20262027),
    ("2026-06-30T18:00:00-07:00", 20262027),
])
def test_july_utc_rollover(date, expected):
    assert resolve_season(datetime.fromisoformat(date)) == expected


def test_explicit_historical_season_and_training_window():
    assert resolve_season(datetime(2026, 10, 7, tzinfo=timezone.utc), "20232024") == 20232024
    assert training_seasons(20262027) == [20242025, 20252026, 20262027]


@pytest.mark.parametrize("value", ["2026", "20262028", "garbage", "", "20262027.0"])
def test_invalid_override_fails_instead_of_silently_using_today(value):
    with pytest.raises(ValueError):
        resolve_season(override=value)


def test_missing_season_does_not_fall_back_to_another_period():
    cache = FeatureCache()
    cache.goalie_stats_by_team["TOR"] = [{"season": 20262027, "save_pctg": .9}]
    cache.team_stat_categories[("TOR", "summary")] = {"goalsFor": 300}
    assert cache.get_goalie_stats("TOR", 20252026) == []
    assert cache.get_team_stat_category("TOR", "summary", 20252026) is None


def test_standings_and_recent_inputs_do_not_blend_prior_season_or_preseason():
    cache = FeatureCache()
    cache.standings_by_team["TOR"] = [dict(season=20252026, snapshot_date="2026-06-15", points=110)]
    cache.recent_games_by_team["TOR"] = [
        dict(id=1, season=20262027, game_type=1, game_date="2026-10-01"),
        dict(id=2, season=20252026, game_type=2, game_date="2026-04-10"),
    ]
    assert cache.get_standings("TOR", "2026-10-06", season=20262027) is None
    assert cache.get_recent_games("TOR", "2026-10-07", season=20262027) == []


def test_opening_night_reads_target_season_and_excludes_preseason(monkeypatch):
    monkeypatch.delenv("PUCKIQ_ML_SEASON", raising=False)
    games = pd.DataFrame([
        dict(id=1, season=20262027, game_type=2, game_state="FUT", game_date="2026-10-07"),
        dict(id=2, season=20262027, game_type=1, game_state="FUT", game_date="2026-10-07"),
        dict(id=3, season=20252026, game_type=2, game_state="FUT", game_date="2026-10-07"),
    ])
    client = MagicMock()
    with (
        patch("ml.pipeline.daily_run.datetime") as clock,
        patch("ml.pipeline.daily_run.create_supabase_client", return_value=client),
        patch("ml.pipeline.daily_run.check_data_freshness", return_value=True),
        patch("ml.pipeline.daily_run.read_games", return_value=games) as read,
        patch("ml.pipeline.daily_run.FeatureCache.build") as cache,
        patch("ml.pipeline.daily_run.compute_all_features", return_value=pd.DataFrame([{}])),
        patch("ml.pipeline.daily_run._predict_game_winners", return_value=None) as predict,
        patch("ml.pipeline.daily_run._predict_spreads"),
        patch("ml.pipeline.daily_run._predict_totals"),
        patch("ml.pipeline.daily_run._predict_player_props", return_value=None),
        patch("ml.pipeline.daily_run.score_yesterdays_predictions", return_value=0),
        patch("ml.pipeline.daily_run._ping_healthcheck"),
    ):
        clock.now.return_value = datetime(2026, 10, 7, 18, tzinfo=timezone.utc)
        _run()
    assert read.call_args.args[1] == 20262027
    assert read.call_args.kwargs["game_types"] == [2, 3]
    assert predict.call_args.args[2]["id"].tolist() == [1]
    assert cache.call_args.kwargs["seasons"] == [20262027]
