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
from ml.models.base import BaseLGBMModel

logger = logging.getLogger(__name__)


class GameWinnerModel(BaseLGBMModel):
    """LightGBM binary classifier for predicting game winners."""

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        super().__init__(LGBM_CLASSIFIER_DEFAULTS, params)

    def _create_model(self) -> lgb.LGBMClassifier:
        return lgb.LGBMClassifier(**self.params)

    def _compute_train_metrics(self, X: np.ndarray, y: np.ndarray) -> dict[str, float]:
        train_probs = self.model.predict_proba(X)[:, 1]
        train_preds = self.model.predict(X)
        return {
            "train_accuracy": float(accuracy_score(y, train_preds)),
            "train_brier": float(brier_score_loss(y, train_probs)),
            "train_log_loss": float(log_loss(y, train_probs)),
        }

    def predict(self, features_df: pd.DataFrame) -> np.ndarray:
        """Return P(home_win) for each game."""
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
