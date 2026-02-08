"""
Baseline models for comparison.

Every ML model must beat these baselines to be considered useful.
Three baselines of increasing sophistication:
  1. NaiveBaseline — always picks home team
  2. FavoriteBaseline — picks team with higher point percentage
  3. SimpleLogisticBaseline — logistic regression with 5 features
"""

import logging
from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss

logger = logging.getLogger(__name__)


class NaiveBaseline:
    """Always predicts the home team wins. The simplest possible baseline."""

    def evaluate(self, games_df: pd.DataFrame) -> dict[str, float]:
        """
        Evaluate home-team-always-wins on completed games.

        Args:
            games_df: Must have home_score, away_score columns.

        Returns:
            Dict with accuracy and brier_score.
        """
        actuals = (games_df["home_score"] > games_df["away_score"]).astype(int)
        preds = np.ones(len(actuals))
        probs = np.ones(len(actuals))

        return {
            "accuracy": float(accuracy_score(actuals, preds)),
            "brier_score": float(brier_score_loss(actuals, probs)),
            "n_games": len(actuals),
        }


class FavoriteBaseline:
    """Picks the team with the higher season point percentage."""

    def evaluate(
        self, games_df: pd.DataFrame, features_df: pd.DataFrame
    ) -> dict[str, float]:
        """
        Evaluate favorites-always-win on completed games.

        Args:
            games_df: Must have home_score, away_score.
            features_df: Must have home_point_pctg, away_point_pctg (indexed by game_id).

        Returns:
            Dict with accuracy and brier_score.
        """
        actuals = (games_df["home_score"] > games_df["away_score"]).astype(int)

        # Predict home wins when home_point_pctg >= away_point_pctg
        home_pctg = pd.to_numeric(features_df["home_point_pctg"], errors="coerce").fillna(0.5).values
        away_pctg = pd.to_numeric(features_df["away_point_pctg"], errors="coerce").fillna(0.5).values
        preds = (home_pctg >= away_pctg).astype(int)

        # Probability = normalized point% (simple)
        total_pctg = home_pctg + away_pctg
        total_pctg = np.where(total_pctg == 0, 1.0, total_pctg)
        probs = home_pctg / total_pctg
        probs = np.clip(probs, 0.01, 0.99)  # Avoid extreme 0/1 for Brier

        return {
            "accuracy": float(accuracy_score(actuals, preds)),
            "brier_score": float(brier_score_loss(actuals, probs)),
            "n_games": len(actuals),
        }


class SimpleLogisticBaseline:
    """
    Logistic regression with 5 core features.

    Features: point_pctg_diff, goal_diff_diff, rest_advantage,
              home_starter_save_pctg, away_starter_save_pctg.
    """

    FEATURES = [
        "point_pctg_diff",
        "home_goal_diff",
        "away_goal_diff",
        "rest_advantage",
        "home_starter_save_pctg",
    ]

    def __init__(self) -> None:
        self.model = LogisticRegression(max_iter=1000, solver="lbfgs")
        self._fitted = False

    def fit(self, features_df: pd.DataFrame, targets: pd.Series) -> None:
        """Train logistic regression on the given features."""
        X = features_df[self.FEATURES].fillna(0).values
        self.model.fit(X, targets.values)
        self._fitted = True

    def predict(self, features_df: pd.DataFrame) -> np.ndarray:
        """Return predicted class (0 or 1)."""
        X = features_df[self.FEATURES].fillna(0).values
        return self.model.predict(X)

    def predict_proba(self, features_df: pd.DataFrame) -> np.ndarray:
        """Return P(home_win) for each game."""
        X = features_df[self.FEATURES].fillna(0).values
        return self.model.predict_proba(X)[:, 1]

    def evaluate(
        self, features_df: pd.DataFrame, targets: pd.Series
    ) -> dict[str, float]:
        """Return accuracy and Brier score on the given data."""
        preds = self.predict(features_df)
        probs = self.predict_proba(features_df)
        return {
            "accuracy": float(accuracy_score(targets, preds)),
            "brier_score": float(brier_score_loss(targets, probs)),
            "n_games": len(targets),
        }


def evaluate_baselines(
    games_df: pd.DataFrame, features_df: pd.DataFrame
) -> dict[str, dict[str, float]]:
    """
    Run all three baselines and return their metrics.

    Args:
        games_df: Completed games with home_score, away_score.
        features_df: Feature matrix indexed by game_id.

    Returns:
        Dict mapping baseline name -> metrics dict.
    """
    targets = (games_df["home_score"] > games_df["away_score"]).astype(int)

    results: dict[str, Any] = {}

    # 1. Naive
    naive = NaiveBaseline()
    results["naive_home"] = naive.evaluate(games_df)

    # 2. Favorite
    favorite = FavoriteBaseline()
    results["favorite"] = favorite.evaluate(games_df, features_df)

    # 3. Logistic
    logistic = SimpleLogisticBaseline()
    # Use first 70% for train, last 30% for eval
    split = int(len(games_df) * 0.7)
    if split > 20:
        logistic.fit(features_df.iloc[:split], targets.iloc[:split])
        results["logistic"] = logistic.evaluate(features_df.iloc[split:], targets.iloc[split:])
    else:
        logger.warning("Not enough games (%d) to evaluate logistic baseline", len(games_df))
        results["logistic"] = {"accuracy": 0.0, "brier_score": 1.0, "n_games": 0}

    logger.info("Baseline results: %s", {k: f"{v['accuracy']:.3f}" for k, v in results.items()})
    return results
