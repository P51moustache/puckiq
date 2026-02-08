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
    ) -> dict[str, float]:
        """Fit a Poisson GLM. eval_set is accepted for interface compatibility but
        not used — statsmodels GLM doesn't support early stopping."""
        X = features_df.values.astype(float)
        y = targets.values.astype(float)

        # Add constant for intercept
        X_with_const = np.column_stack([np.ones(len(X)), X])
        self.model = GLM(y, X_with_const, family=PoissonFamily()).fit()

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


class LGBMComponent:
    """LightGBM regression for predicting total goals."""

    def __init__(self, params: dict[str, Any] | None = None) -> None:
        self.params = {**LGBM_REGRESSOR_DEFAULTS, **(params or {})}
        self.model: lgb.LGBMRegressor | None = None

    def train(
        self,
        features_df: pd.DataFrame,
        targets: pd.Series,
        eval_set: tuple[pd.DataFrame, pd.Series] | None = None,
    ) -> dict[str, float]:
        """Fit a LightGBM regressor with optional early stopping."""
        self.model = lgb.LGBMRegressor(**self.params)

        fit_kwargs: dict[str, Any] = {}
        if eval_set is not None:
            X_val, y_val = eval_set
            fit_kwargs["eval_set"] = [(X_val.values, y_val.values)]
            fit_kwargs["callbacks"] = [lgb.early_stopping(20, verbose=False)]

        self.model.fit(features_df.values, targets.values, **fit_kwargs)
        preds = self.model.predict(features_df.values)
        metrics = {
            "lgbm_mae": float(mean_absolute_error(targets.values, preds)),
        }
        logger.info("LGBMComponent (totals) trained: %s", metrics)
        return metrics

    def predict(self, features_df: pd.DataFrame) -> np.ndarray:
        """Return predicted total goals."""
        if self.model is None:
            raise RuntimeError("LGBMComponent not trained")
        return self.model.predict(features_df.values)


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

    def train(
        self,
        features_df: pd.DataFrame,
        targets: pd.Series,
        eval_set: tuple[pd.DataFrame, pd.Series] | None = None,
    ) -> dict[str, float]:
        """Train both sub-models on the same data."""
        p_metrics = self.poisson.train(features_df, targets, eval_set=eval_set)
        l_metrics = self.lgbm.train(features_df, targets, eval_set=eval_set)

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
