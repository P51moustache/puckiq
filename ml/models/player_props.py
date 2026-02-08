"""
Player props prediction model — Poisson GLM.

Predicts expected goals, assists, and points per game for individual players.
Provides both point estimates and probability distributions.
"""

import logging
from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import poisson
from sklearn.metrics import mean_absolute_error
from statsmodels.genmod.families import Poisson as PoissonFamily
from statsmodels.genmod.generalized_linear_model import GLM

logger = logging.getLogger(__name__)

# Features used for player props
PLAYER_FEATURES = [
    "player_gpg",
    "player_toi",
    "player_shot_pct",
    "opponent_ga_per_game",
    "is_home",
]

MAX_COUNT = 5  # Max goals/assists to model in distribution


class PlayerPropSubmodel:
    """Poisson GLM for a single player prop (goals, assists, or points)."""

    def __init__(self, prop_name: str) -> None:
        self.prop_name = prop_name
        self.model: Any = None

    def train(
        self, features_df: pd.DataFrame, targets: pd.Series
    ) -> dict[str, float]:
        """
        Fit a Poisson GLM on player-game data.

        Args:
            features_df: Player feature matrix (one row per player-game).
            targets: Integer count (goals, assists, or points).

        Returns:
            Training metrics.
        """
        X = features_df.values.astype(float)
        y = targets.values.astype(float)

        X_with_const = np.column_stack([np.ones(len(X)), X])
        self.model = GLM(y, X_with_const, family=PoissonFamily()).fit()

        preds = self.model.predict(X_with_const)
        mae = float(mean_absolute_error(y, preds))
        logger.info("PlayerPropSubmodel(%s) trained: mae=%.4f", self.prop_name, mae)
        return {"mae": mae}

    def predict(self, features_df: pd.DataFrame) -> np.ndarray:
        """Return expected value (lambda) for each player-game."""
        if self.model is None:
            raise RuntimeError(f"PlayerPropSubmodel({self.prop_name}) not trained")
        X = features_df.values.astype(float)
        X_with_const = np.column_stack([np.ones(len(X)), X])
        return self.model.predict(X_with_const)

    def predict_distribution(self, features_df: pd.DataFrame) -> np.ndarray:
        """
        Return P(count = k) for k in [0..MAX_COUNT] for each player-game.

        Returns:
            2-D array of shape (n_rows, MAX_COUNT+1).
        """
        lambdas = self.predict(features_df)
        dist = np.zeros((len(lambdas), MAX_COUNT + 1))
        for i, lam in enumerate(lambdas):
            for k in range(MAX_COUNT + 1):
                dist[i, k] = poisson.pmf(k, lam)
        return dist


class PlayerPropsModel:
    """
    Ensemble of three Poisson GLMs for player props: goals, assists, points.
    """

    def __init__(self) -> None:
        self.goals_model = PlayerPropSubmodel("goals")
        self.assists_model = PlayerPropSubmodel("assists")
        self.points_model = PlayerPropSubmodel("points")

    def train(
        self,
        features_df: pd.DataFrame,
        goals: pd.Series,
        assists: pd.Series,
        points: pd.Series,
    ) -> dict[str, dict[str, float]]:
        """
        Train all three sub-models.

        Args:
            features_df: Player feature matrix with PLAYER_FEATURES columns.
            goals: Goals per game.
            assists: Assists per game.
            points: Points per game.

        Returns:
            Dict mapping prop name -> metrics.
        """
        return {
            "goals": self.goals_model.train(features_df, goals),
            "assists": self.assists_model.train(features_df, assists),
            "points": self.points_model.train(features_df, points),
        }

    def predict(
        self, features_df: pd.DataFrame
    ) -> dict[str, np.ndarray]:
        """
        Return expected values for all three props.

        Returns:
            Dict with keys 'goals', 'assists', 'points' -> 1-D arrays.
        """
        return {
            "goals": self.goals_model.predict(features_df),
            "assists": self.assists_model.predict(features_df),
            "points": self.points_model.predict(features_df),
        }

    def predict_distribution(
        self, features_df: pd.DataFrame
    ) -> dict[str, np.ndarray]:
        """
        Return probability distributions for all three props.

        Returns:
            Dict with keys 'goals', 'assists', 'points' -> 2-D arrays.
        """
        return {
            "goals": self.goals_model.predict_distribution(features_df),
            "assists": self.assists_model.predict_distribution(features_df),
            "points": self.points_model.predict_distribution(features_df),
        }

    def evaluate(
        self,
        features_df: pd.DataFrame,
        goals: pd.Series,
        assists: pd.Series,
        points: pd.Series,
    ) -> dict[str, dict[str, float]]:
        """Return MAE for each prop on the given data."""
        g_pred = self.goals_model.predict(features_df)
        a_pred = self.assists_model.predict(features_df)
        p_pred = self.points_model.predict(features_df)
        return {
            "goals": {
                "mae": float(mean_absolute_error(goals.values, g_pred)),
                "n_samples": len(goals),
            },
            "assists": {
                "mae": float(mean_absolute_error(assists.values, a_pred)),
                "n_samples": len(assists),
            },
            "points": {
                "mae": float(mean_absolute_error(points.values, p_pred)),
                "n_samples": len(points),
            },
        }
