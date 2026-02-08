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

logger = logging.getLogger(__name__)


class SpreadModel:
    """LightGBM regression model for predicting game spread."""

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        self.params = {**LGBM_REGRESSOR_DEFAULTS, **(params or {})}
        self.model: lgb.LGBMRegressor | None = None
        self.feature_names: list[str] = []

    def train(
        self,
        features_df: pd.DataFrame,
        targets: pd.Series,
        eval_set: tuple[pd.DataFrame, pd.Series] | None = None,
    ) -> dict[str, float]:
        """
        Train the LightGBM regressor.

        Args:
            features_df: Feature matrix.
            targets: Continuous target (home_score - away_score).
            eval_set: Optional (X_val, y_val) for early stopping.

        Returns:
            Training metrics dict.
        """
        self.feature_names = list(features_df.columns)
        X = features_df.values
        y = targets.values

        self.model = lgb.LGBMRegressor(**self.params)

        fit_kwargs: dict[str, Any] = {}
        if eval_set is not None:
            X_val, y_val = eval_set
            fit_kwargs["eval_set"] = [(X_val.values, y_val.values)]
            fit_kwargs["callbacks"] = [lgb.early_stopping(20, verbose=False)]

        self.model.fit(X, y, **fit_kwargs)

        train_preds = self.model.predict(X)
        metrics = {
            "train_mae": float(mean_absolute_error(y, train_preds)),
            "train_rmse": float(np.sqrt(mean_squared_error(y, train_preds))),
        }
        logger.info("SpreadModel trained: %s", metrics)
        return metrics

    def predict(self, features_df: pd.DataFrame) -> np.ndarray:
        """
        Predict the spread (home_score - away_score) for each game.

        Returns:
            1-D array of predicted spreads.
        """
        if self.model is None:
            raise RuntimeError("Model not trained — call train() first")
        return self.model.predict(features_df.values)

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
