"""
Shared fixtures for PuckIQ ML pipeline tests.

All fixtures generate synthetic data so tests run offline without Supabase.
Feature columns are auto-generated from features.yaml — no manual updates
needed when features are added or removed.
"""

import pytest
import numpy as np
import pandas as pd

from ml.features.registry import generate_synthetic_features, get_model_features


@pytest.fixture
def synthetic_game_features():
    """Generate synthetic game features for testing.

    Returns a DataFrame with 200 rows and columns matching the game_winner
    model's feature set from features.yaml. Auto-discovers features.
    """
    return generate_synthetic_features(n=200, model_type="game_winner", seed=42)


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
    """Feature matrix with all game_winner features, indexed by game_id.

    Auto-discovers features from features.yaml.
    """
    n = len(synthetic_games_df)
    df = generate_synthetic_features(n=n, model_type="game_winner", seed=42)
    df.index = synthetic_games_df["id"]
    return df
