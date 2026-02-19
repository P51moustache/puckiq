"""
Totals (over/under) prediction model.

WHY POISSON FOR HOCKEY GOALS? (tutorial)

  The Poisson distribution models "number of rare events in a fixed period."
  Hockey goals fit this perfectly: a team scores ~3 goals per game, and each
  goal is a relatively rare event during 60 minutes of play.

  The Poisson model gives us something LightGBM can't: a full probability
  distribution. Instead of just "expected 5.2 goals," we get:
    P(0 goals) = 0.5%, P(1) = 2.8%, P(2) = 7.3%, ... P(7) = 10.4%, ...

  This is crucial for over/under betting: if the line is 5.5 goals, we can
  compute P(total > 5.5) = sum of P(6) + P(7) + ... directly.

WHY ENSEMBLE TWO MODELS?

  The Poisson GLM is grounded in statistical theory but assumes a simple
  log-linear relationship between features and goal rates. LightGBM captures
  non-linear patterns (e.g., "this team scores more when playing at altitude")
  but doesn't give us a distribution.

  By averaging both predictions (50/50 default weight), we get:
  - Better point estimates than either model alone (ensemble effect)
  - A probability distribution from the Poisson component
  - Robustness: if one model has a bad night, the other stabilizes the prediction
"""

import logging
from typing import Any

import lightgbm as lgb
import numpy as np
import pandas as pd
from scipy.stats import poisson
from sklearn.metrics import mean_absolute_error, mean_squared_error
from statsmodels.genmod.families import Poisson as PoissonFamily
from statsmodels.genmod.generalized_linear_model import GLM

from ml.config import (
    LGBM_REGRESSOR_DEFAULTS,
    TOTALS_LGBM_WEIGHT,
    TOTALS_POISSON_WEIGHT,
)
from ml.models.base import BaseLGBMModel

logger = logging.getLogger(__name__)

MAX_GOALS = 12  # Max total goals to model in the distribution


class PoissonComponent:
    """Poisson GLM for predicting total goals."""

    def __init__(self) -> None:
        self.model: Any = None

    def train(
        self,
        features_df: pd.DataFrame,
        targets: pd.Series,
        eval_set: tuple[pd.DataFrame, pd.Series] | None = None,
        sample_weight: pd.Series | np.ndarray | None = None,
    ) -> dict[str, float]:
        """Fit a Poisson GLM. eval_set is accepted for interface compatibility but
        not used — statsmodels GLM doesn't support early stopping."""
        X = features_df.values.astype(float)
        y = targets.values.astype(float)

        # Add constant for intercept
        X_with_const = np.column_stack([np.ones(len(X)), X])
        fit_kwargs: dict[str, Any] = {}
        if sample_weight is not None:
            fit_kwargs["freq_weights"] = np.asarray(sample_weight, dtype=float)[:len(X)]
        self.model = GLM(y, X_with_const, family=PoissonFamily()).fit(**fit_kwargs)

        preds = self.model.predict(X_with_const)
        metrics = {
            "poisson_mae": float(mean_absolute_error(y, preds)),
        }
        logger.info("PoissonComponent trained: %s", metrics)
        return metrics

    def predict(self, features_df: pd.DataFrame) -> np.ndarray:
        """Return expected total goals for each game."""
        if self.model is None:
            raise RuntimeError("PoissonComponent not trained")
        X = features_df.values.astype(float)
        X_with_const = np.column_stack([np.ones(len(X)), X])
        return self.model.predict(X_with_const)

    def predict_distribution(self, features_df: pd.DataFrame) -> np.ndarray:
        """
        Return P(total_goals = k) for k in [0..MAX_GOALS] for each game.

        Returns:
            2-D array of shape (n_games, MAX_GOALS+1).
        """
        lambdas = self.predict(features_df)
        dist = np.zeros((len(lambdas), MAX_GOALS + 1))
        for i, lam in enumerate(lambdas):
            for k in range(MAX_GOALS + 1):
                dist[i, k] = poisson.pmf(k, lam)
        return dist


class LGBMComponent(BaseLGBMModel):
    """LightGBM regression for predicting total goals."""

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        super().__init__(LGBM_REGRESSOR_DEFAULTS, params)

    def _create_model(self) -> lgb.LGBMRegressor:
        return lgb.LGBMRegressor(**self.params)

    def _compute_train_metrics(self, X: np.ndarray, y: np.ndarray) -> dict[str, float]:
        preds = self.model.predict(X)
        return {
            "lgbm_mae": float(mean_absolute_error(y, preds)),
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


class TotalsModel:
    """
    Ensemble model for total goals prediction.

    Combines Poisson GLM and LightGBM regression with configurable weights.
    """

    def __init__(
        self,
        poisson_weight: float = TOTALS_POISSON_WEIGHT,
        lgbm_weight: float = TOTALS_LGBM_WEIGHT,
    ) -> None:
        self.poisson = PoissonComponent()
        self.lgbm = LGBMComponent()
        self.poisson_weight = poisson_weight
        self.lgbm_weight = lgbm_weight
        assert abs(self.poisson_weight + self.lgbm_weight - 1.0) < 1e-6, (
            f"Ensemble weights must sum to 1.0, got {self.poisson_weight + self.lgbm_weight}"
        )

    def train(
        self,
        features_df: pd.DataFrame,
        targets: pd.Series,
        eval_set: tuple[pd.DataFrame, pd.Series] | None = None,
        sample_weight: pd.Series | np.ndarray | None = None,
    ) -> dict[str, float]:
        """Train both sub-models on the same data."""
        p_metrics = self.poisson.train(features_df, targets, eval_set=eval_set,
                                        sample_weight=sample_weight)
        l_metrics = self.lgbm.train(features_df, targets, eval_set=eval_set,
                                     sample_weight=sample_weight)

        # Ensemble on training data
        preds = self.predict(features_df)
        metrics = {
            **p_metrics,
            **l_metrics,
            "ensemble_mae": float(mean_absolute_error(targets.values, preds)),
            "ensemble_rmse": float(np.sqrt(mean_squared_error(targets.values, preds))),
        }
        logger.info("TotalsModel trained: %s", metrics)
        return metrics

    def predict(self, features_df: pd.DataFrame) -> np.ndarray:
        """
        Return weighted-average total goals prediction.

        Ensemble: poisson_weight * poisson_pred + lgbm_weight * lgbm_pred
        """
        p_pred = self.poisson.predict(features_df)
        l_pred = self.lgbm.predict(features_df)
        return self.poisson_weight * p_pred + self.lgbm_weight * l_pred

    def predict_distribution(self, features_df: pd.DataFrame) -> np.ndarray:
        """
        Return Poisson probability distribution over [0..MAX_GOALS].

        The distribution comes from the Poisson component only,
        since LightGBM does not produce distributional predictions.
        """
        return self.poisson.predict_distribution(features_df)

    def get_feature_importance(self) -> dict[str, float]:
        """Return feature importance from the LightGBM component.

        The Poisson GLM doesn't expose importances in the same format,
        so we use the LightGBM sub-model's importances as a proxy for
        the whole ensemble.
        """
        return self.lgbm.get_feature_importance()

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
