"""
Shared fixtures for PuckIQ ML pipeline tests.

All fixtures generate synthetic data so tests run offline without Supabase.
"""

import pytest
import numpy as np
import pandas as pd


@pytest.fixture
def synthetic_game_features():
    """Generate synthetic game features for testing.

    Returns a DataFrame with 200 rows and 18 feature columns that mirror
    the real feature set used by the game_winner, spread, and totals models.
    """
    np.random.seed(42)
    n = 200
    return pd.DataFrame({
        "home_point_pctg": np.random.uniform(0.3, 0.8, n),
        "away_point_pctg": np.random.uniform(0.3, 0.8, n),
        "point_pctg_diff": np.random.uniform(-0.4, 0.4, n),
        "home_goal_diff": np.random.uniform(-30, 30, n),
        "away_goal_diff": np.random.uniform(-30, 30, n),
        "home_home_wins": np.random.randint(5, 25, n).astype(float),
        "away_road_wins": np.random.randint(3, 20, n).astype(float),
        "home_goals_for_l10": np.random.uniform(2.0, 4.5, n),
        "away_goals_for_l10": np.random.uniform(2.0, 4.5, n),
        "home_goals_against_l10": np.random.uniform(2.0, 4.0, n),
        "away_goals_against_l10": np.random.uniform(2.0, 4.0, n),
        "home_win_pct_l10": np.random.uniform(0.2, 0.9, n),
        "away_win_pct_l10": np.random.uniform(0.2, 0.9, n),
        "home_is_back_to_back": np.random.choice([0, 1], n, p=[0.8, 0.2]).astype(float),
        "away_is_back_to_back": np.random.choice([0, 1], n, p=[0.8, 0.2]).astype(float),
        "rest_advantage": np.random.choice([-1, 0, 1, 2], n).astype(float),
        "home_starter_save_pctg": np.random.uniform(0.88, 0.94, n),
        "away_starter_save_pctg": np.random.uniform(0.88, 0.94, n),
    })


@pytest.fixture
def synthetic_targets_binary(synthetic_game_features):
    """Binary targets (1 = home win, 0 = away win) with slight home advantage."""
    np.random.seed(42)
    return pd.Series(
        np.random.choice([0, 1], len(synthetic_game_features), p=[0.45, 0.55]),
        name="home_win",
    )


@pytest.fixture
def synthetic_targets_spread(synthetic_game_features):
    """Continuous spread targets (home_score - away_score)."""
    np.random.seed(42)
    return pd.Series(
        np.random.normal(0.2, 2.5, len(synthetic_game_features)),
        name="spread",
    )


@pytest.fixture
def synthetic_targets_total(synthetic_game_features):
    """Count targets (total goals per game), Poisson-distributed."""
    np.random.seed(42)
    return pd.Series(
        np.random.poisson(5.5, len(synthetic_game_features)),
        name="total_goals",
    )


@pytest.fixture
def synthetic_games_df():
    """Synthetic completed games DataFrame with scores."""
    np.random.seed(42)
    n = 100
    home_scores = np.random.poisson(3, n)
    away_scores = np.random.poisson(2.7, n)
    return pd.DataFrame({
        "id": [f"game_{i}" for i in range(n)],
        "home_team_abbrev": np.random.choice(["TOR", "BOS", "MTL", "NYR"], n),
        "away_team_abbrev": np.random.choice(["VAN", "EDM", "CGY", "WPG"], n),
        "home_score": home_scores,
        "away_score": away_scores,
        "game_state": "OFF",
        "game_date": pd.date_range("2025-10-10", periods=n, freq="D").strftime("%Y-%m-%d"),
    })


@pytest.fixture
def synthetic_features_with_pctg(synthetic_games_df):
    """Feature matrix with point percentages, indexed by game_id."""
    np.random.seed(42)
    n = len(synthetic_games_df)
    return pd.DataFrame({
        "home_point_pctg": np.random.uniform(0.3, 0.8, n),
        "away_point_pctg": np.random.uniform(0.3, 0.8, n),
        "point_pctg_diff": np.random.uniform(-0.4, 0.4, n),
        "home_goal_diff": np.random.uniform(-30, 30, n),
        "away_goal_diff": np.random.uniform(-30, 30, n),
        "rest_advantage": np.random.choice([-1, 0, 1, 2], n).astype(float),
        "home_starter_save_pctg": np.random.uniform(0.88, 0.94, n),
        "away_starter_save_pctg": np.random.uniform(0.88, 0.94, n),
    }, index=synthetic_games_df["id"])
