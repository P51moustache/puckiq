"""
Spread prediction model — LightGBM regression.

Predicts the point spread: home_score - away_score.
Positive values mean home team wins by that margin.
"""

import logging
from typing import Any

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

from ml.config import LGBM_REGRESSOR_DEFAULTS
from ml.models.base import BaseLGBMModel

logger = logging.getLogger(__name__)


class SpreadModel(BaseLGBMModel):
    """LightGBM regression model for predicting game spread."""

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        super().__init__(LGBM_REGRESSOR_DEFAULTS, params)

    def _create_model(self) -> lgb.LGBMRegressor:
        return lgb.LGBMRegressor(**self.params)

    def _compute_train_metrics(self, X: np.ndarray, y: np.ndarray) -> dict[str, float]:
        train_preds = self.model.predict(X)
        return {
            "train_mae": float(mean_absolute_error(y, train_preds)),
            "train_rmse": float(np.sqrt(mean_squared_error(y, train_preds))),
        }

    def evaluate(
        self, features_df: pd.DataFrame, targets: pd.Series
    ) -> dict[str, float]:
        """Return MAE and RMSE on the given data."""
        preds = self.predict(features_df)
        return {
            "mae": float(mean_absolute_error(targets.values, preds)),
            "rmse": float(np.sqrt(mean_squared_error(targets.values, preds))),
            "n_games": len(targets),
        }
