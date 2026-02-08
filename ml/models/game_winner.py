"""
Game winner prediction model — LightGBM binary classifier.

Predicts P(home_win) for each game. Target: 1 if home team wins, 0 otherwise.
"""

import logging
from typing import Any

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss

from ml.config import LGBM_CLASSIFIER_DEFAULTS

logger = logging.getLogger(__name__)


class GameWinnerModel:
    """LightGBM binary classifier for predicting game winners."""

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        self.params = {**LGBM_CLASSIFIER_DEFAULTS, **(params or {})}
        self.model: lgb.LGBMClassifier | None = None
        self.feature_names: list[str] = []

    def train(
        self,
        features_df: pd.DataFrame,
        targets: pd.Series,
        eval_set: tuple[pd.DataFrame, pd.Series] | None = None,
    ) -> dict[str, float]:
        """
        Train the LightGBM classifier.

        Args:
            features_df: Feature matrix (one row per game).
            targets: Binary target (1 = home win, 0 = away win).
            eval_set: Optional (X_val, y_val) for early stopping.

        Returns:
            Training metrics dict.
        """
        self.feature_names = list(features_df.columns)
        X = features_df.values
        y = targets.values

        self.model = lgb.LGBMClassifier(**self.params)

        fit_kwargs: dict[str, Any] = {}
        if eval_set is not None:
            X_val, y_val = eval_set
            fit_kwargs["eval_set"] = [(X_val.values, y_val.values)]
            fit_kwargs["callbacks"] = [lgb.early_stopping(20, verbose=False)]

        self.model.fit(X, y, **fit_kwargs)

        train_probs = self.model.predict_proba(X)[:, 1]
        train_preds = self.model.predict(X)

        metrics = {
            "train_accuracy": float(accuracy_score(y, train_preds)),
            "train_brier": float(brier_score_loss(y, train_probs)),
            "train_log_loss": float(log_loss(y, train_probs)),
        }
        logger.info("GameWinnerModel trained: %s", metrics)
        return metrics

    def predict(self, features_df: pd.DataFrame) -> np.ndarray:
        """
        Return P(home_win) for each game.

        Args:
            features_df: Feature matrix with same columns as training.

        Returns:
            1-D array of probabilities.
        """
        if self.model is None:
            raise RuntimeError("Model not trained — call train() first")
        return self.model.predict_proba(features_df.values)[:, 1]

    def predict_class(self, features_df: pd.DataFrame) -> np.ndarray:
        """Return binary predictions (0 or 1)."""
        if self.model is None:
            raise RuntimeError("Model not trained — call train() first")
        return self.model.predict(features_df.values)

    def evaluate(
        self, features_df: pd.DataFrame, targets: pd.Series
    ) -> dict[str, float]:
        """Return accuracy, Brier score, and log loss on the given data."""
        probs = self.predict(features_df)
        preds = self.predict_class(features_df)
        return {
            "accuracy": float(accuracy_score(targets.values, preds)),
            "brier_score": float(brier_score_loss(targets.values, probs)),
            "log_loss": float(log_loss(targets.values, probs)),
            "n_games": len(targets),
        }

    def get_feature_importance(self) -> dict[str, float]:
        """Return feature importance sorted descending."""
        if self.model is None:
            return {}
        importances = self.model.feature_importances_
        pairs = sorted(
            zip(self.feature_names, importances),
            key=lambda x: x[1],
            reverse=True,
        )
        return dict(pairs)
