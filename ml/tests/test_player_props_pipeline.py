"""
Tests for the player props model pipeline integration.

Covers:
- Feature registry includes player_props model features
- compute_player_features() with synthetic data
- PlayerPropsModel train/predict cycle
- get_model_features returns expected features
"""

import numpy as np
import pandas as pd
import pytest

from ml.features.compute import compute_player_features
from ml.features.registry import generate_synthetic_features, get_model_features
from ml.models.player_props import PlayerPropsModel, get_player_features


# ---------------------------------------------------------------------------
# Registry tests
# ---------------------------------------------------------------------------


def test_player_props_features_in_registry():
    """player_props should be defined in model_features."""
    features = get_model_features("player_props")
    assert len(features) == 5
    assert "player_gpg" in features
    assert "player_toi" in features
    assert "player_shot_pct" in features
    assert "opponent_ga_per_game" in features
    assert "is_home" in features


def test_get_player_features_uses_registry():
    """get_player_features() should return the same list as get_model_features."""
    from_registry = get_model_features("player_props")
    from_helper = get_player_features()
    assert from_registry == from_helper


def test_synthetic_features_player_props():
    """generate_synthetic_features should work for player_props."""
    df = generate_synthetic_features(n=50, model_type="player_props", seed=99)
    assert len(df) == 50
    assert "player_gpg" in df.columns
    assert "player_toi" in df.columns
    assert "player_shot_pct" in df.columns
    assert "opponent_ga_per_game" in df.columns
    assert "is_home" in df.columns
    # is_home should be binary
    assert set(df["is_home"].unique()).issubset({0.0, 1.0})


# ---------------------------------------------------------------------------
# compute_player_features tests
# ---------------------------------------------------------------------------


def _make_player_game_df(n=20):
    """Create a synthetic player-game DataFrame."""
    rng = np.random.default_rng(42)
    return pd.DataFrame({
        "player_id": rng.integers(1000, 9999, n),
        "game_id": rng.integers(2025020001, 2025021000, n),
        "team_abbrev": rng.choice(["TOR", "BOS", "MTL"], n),
        "opponent_abbrev": rng.choice(["NYR", "CHI", "DET"], n),
        "home_road": rng.choice(["H", "R"], n),
    })


def _make_season_stats_df(player_ids):
    """Create synthetic season stats for the given player IDs."""
    rng = np.random.default_rng(42)
    n = len(player_ids)
    return pd.DataFrame({
        "player_id": player_ids,
        "team_abbrev": rng.choice(["TOR", "BOS", "MTL"], n),
        "goals_per_game": rng.uniform(0.05, 0.50, n),
        "avg_toi_per_game": rng.uniform(8.0, 22.0, n),
        "shooting_pctg": rng.uniform(3.0, 20.0, n),
    })


def _make_standings_df():
    """Create synthetic standings for opponent teams."""
    return pd.DataFrame({
        "team_abbrev": ["NYR", "CHI", "DET"],
        "goals_against": [120, 150, 140],
        "games_played": [40, 40, 40],
    })


def test_compute_player_features_basic():
    """compute_player_features should return correct columns."""
    pg_df = _make_player_game_df(10)
    season_df = _make_season_stats_df(pg_df["player_id"].unique())
    standings_df = _make_standings_df()

    result = compute_player_features(pg_df, season_df, standings_df)

    assert len(result) == 10
    assert "player_gpg" in result.columns
    assert "player_toi" in result.columns
    assert "player_shot_pct" in result.columns
    assert "opponent_ga_per_game" in result.columns
    assert "is_home" in result.columns
    assert "player_id" in result.columns
    assert "game_id" in result.columns


def test_compute_player_features_home_flag():
    """is_home should be 1.0 for home players and 0.0 for away."""
    pg_df = pd.DataFrame({
        "player_id": [1, 2],
        "game_id": [100, 100],
        "team_abbrev": ["TOR", "BOS"],
        "opponent_abbrev": ["BOS", "TOR"],
        "home_road": ["H", "R"],
    })
    season_df = pd.DataFrame({
        "player_id": [1, 2],
        "team_abbrev": ["TOR", "BOS"],
        "goals_per_game": [0.3, 0.2],
        "avg_toi_per_game": [18.0, 15.0],
        "shooting_pctg": [12.0, 10.0],
    })

    result = compute_player_features(pg_df, season_df)
    assert result.iloc[0]["is_home"] == 1.0
    assert result.iloc[1]["is_home"] == 0.0


def test_compute_player_features_empty_inputs():
    """Should handle empty DataFrames gracefully."""
    empty_pg = pd.DataFrame(columns=["player_id", "game_id", "team_abbrev", "opponent_abbrev", "home_road"])
    empty_season = pd.DataFrame(columns=["player_id", "team_abbrev", "goals_per_game", "avg_toi_per_game", "shooting_pctg"])

    result = compute_player_features(empty_pg, empty_season)
    assert len(result) == 0


def test_compute_player_features_missing_season_stats():
    """Players without season stats should get NaN for those features."""
    pg_df = pd.DataFrame({
        "player_id": [999],
        "game_id": [100],
        "team_abbrev": ["TOR"],
        "opponent_abbrev": ["BOS"],
        "home_road": ["H"],
    })
    # Empty season stats — no match for player 999
    season_df = pd.DataFrame({
        "player_id": [1],
        "team_abbrev": ["MTL"],
        "goals_per_game": [0.3],
        "avg_toi_per_game": [18.0],
        "shooting_pctg": [12.0],
    })

    result = compute_player_features(pg_df, season_df)
    assert len(result) == 1
    assert np.isnan(result.iloc[0]["player_gpg"])
    assert np.isnan(result.iloc[0]["player_toi"])


# ---------------------------------------------------------------------------
# PlayerPropsModel train/predict tests
# ---------------------------------------------------------------------------


def test_player_props_model_train_predict():
    """PlayerPropsModel should train and produce predictions."""
    features_df = generate_synthetic_features(n=200, model_type="player_props", seed=42)
    rng = np.random.default_rng(42)

    goals = pd.Series(rng.poisson(0.3, 200))
    assists = pd.Series(rng.poisson(0.4, 200))
    points = pd.Series(rng.poisson(0.7, 200))

    model = PlayerPropsModel()
    train_metrics = model.train(features_df, goals, assists, points)

    assert "goals" in train_metrics
    assert "assists" in train_metrics
    assert "points" in train_metrics
    assert train_metrics["goals"]["mae"] >= 0
    assert train_metrics["assists"]["mae"] >= 0

    preds = model.predict(features_df)
    assert "goals" in preds
    assert "assists" in preds
    assert "points" in preds
    assert len(preds["goals"]) == 200
    assert all(p >= 0 for p in preds["goals"])


def test_player_props_model_evaluate():
    """PlayerPropsModel.evaluate should return MAE for each prop."""
    features_df = generate_synthetic_features(n=200, model_type="player_props", seed=42)
    rng = np.random.default_rng(42)

    goals = pd.Series(rng.poisson(0.3, 200))
    assists = pd.Series(rng.poisson(0.4, 200))
    points = pd.Series(rng.poisson(0.7, 200))

    model = PlayerPropsModel()
    model.train(features_df[:150], goals[:150], assists[:150], points[:150])

    val_metrics = model.evaluate(features_df[150:], goals[150:], assists[150:], points[150:])
    assert "goals" in val_metrics
    assert "mae" in val_metrics["goals"]
    assert "n_samples" in val_metrics["goals"]
    assert val_metrics["goals"]["n_samples"] == 50


def test_player_props_model_predict_distribution():
    """PlayerPropsModel should return probability distributions."""
    features_df = generate_synthetic_features(n=100, model_type="player_props", seed=42)
    rng = np.random.default_rng(42)

    goals = pd.Series(rng.poisson(0.3, 100))
    assists = pd.Series(rng.poisson(0.4, 100))
    points = pd.Series(rng.poisson(0.7, 100))

    model = PlayerPropsModel()
    model.train(features_df, goals, assists, points)

    dist = model.predict_distribution(features_df[:5])
    assert "goals" in dist
    assert dist["goals"].shape[0] == 5
    assert dist["goals"].shape[1] == 6  # MAX_COUNT + 1 = 6
    # Probabilities should sum to ~1 per row
    row_sums = dist["goals"].sum(axis=1)
    np.testing.assert_allclose(row_sums, 1.0, atol=0.01)
