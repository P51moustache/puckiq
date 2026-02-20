"""
Game winner prediction model — LightGBM + Logistic Regression ensemble.

Predicts P(home_win) for each game. Target: 1 if home team wins, 0 otherwise.

WHY ENSEMBLE?

  LightGBM captures non-linear feature interactions but can overfit on small
  datasets (~900 games/season). Logistic regression provides a well-calibrated,
  low-variance complement with only ~N_features parameters vs LightGBM's
  hundreds of leaf values.

  Blending 70/30 (LGBM/LR) smooths out LightGBM's noisy probability estimates,
  following the same pattern as TotalsModel's Poisson+LGBM ensemble.
"""

import logging
from typing import Any

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss

from ml.config import GW_LGBM_WEIGHT, GW_LR_WEIGHT, LGBM_CLASSIFIER_DEFAULTS
from ml.models.base import BaseLGBMModel

logger = logging.getLogger(__name__)


class GameWinnerModel(BaseLGBMModel):
    """Ensemble of LightGBM classifier + Logistic Regression for game winner prediction."""

    def __init__(
        self,
        params: dict[str, Any] | None = None,
        lgbm_weight: float = GW_LGBM_WEIGHT,
        lr_weight: float = GW_LR_WEIGHT,
    ) -> None:
        super().__init__(LGBM_CLASSIFIER_DEFAULTS, params)
        self.lgbm_weight = lgbm_weight
        self.lr_weight = lr_weight
        self.lr_model: LogisticRegression | None = None

    def _create_model(self) -> lgb.LGBMClassifier:
        return lgb.LGBMClassifier(**self.params)

    def train(
        self,
        features_df: pd.DataFrame,
        targets: pd.Series,
        eval_set: tuple[pd.DataFrame, pd.Series] | None = None,
        sample_weight: pd.Series | np.ndarray | None = None,
    ) -> dict[str, float]:
        """Train both LightGBM and Logistic Regression, return ensemble metrics."""
        self.feature_names = list(features_df.columns)
        X = features_df.values
        y = targets.values

        # --- LightGBM component ---
        self.model = self._create_model()
        fit_kwargs: dict[str, Any] = {}
        if eval_set is not None:
            X_val, y_val = eval_set
            fit_kwargs["eval_set"] = [(X_val.values, y_val.values)]
            fit_kwargs["callbacks"] = [lgb.early_stopping(10, verbose=False)]
        if sample_weight is not None:
            w = np.asarray(sample_weight)
            fit_kwargs["sample_weight"] = w[:len(X)]
        self.model.fit(X, y, **fit_kwargs)

        # --- Logistic Regression component ---
        X_lr = np.nan_to_num(X, nan=0.0)
        self.lr_model = LogisticRegression(C=1.0, max_iter=5000, solver="lbfgs")
        sw = np.asarray(sample_weight)[:len(y)] if sample_weight is not None else None
        self.lr_model.fit(X_lr, y, sample_weight=sw)

        # Compute ensemble train metrics
        metrics = self._compute_train_metrics(X, y)
        logger.info("%s trained: %s", self.__class__.__name__, metrics)
        return metrics

    def _compute_train_metrics(self, X: np.ndarray, y: np.ndarray) -> dict[str, float]:
        probs = self._ensemble_proba(X)
        preds = (probs >= 0.5).astype(int)
        return {
            "accuracy": float(accuracy_score(y, preds)),
            "brier_score": float(brier_score_loss(y, probs)),
            "log_loss": float(log_loss(y, probs)),
        }

    def _ensemble_proba(self, X: np.ndarray) -> np.ndarray:
        """Blend LightGBM and LR probabilities."""
        lgbm_probs = self.model.predict_proba(X)[:, 1]
        if self.lr_model is not None:
            X_lr = np.nan_to_num(X, nan=0.0)
            lr_probs = self.lr_model.predict_proba(X_lr)[:, 1]
            return self.lgbm_weight * lgbm_probs + self.lr_weight * lr_probs
        return lgbm_probs

    def predict(self, features_df: pd.DataFrame) -> np.ndarray:
        """Return P(home_win) for each game (ensemble blend)."""
        if self.model is None:
            raise RuntimeError("Model not trained — call train() first")
        return self._ensemble_proba(features_df.values)

    def predict_class(self, features_df: pd.DataFrame) -> np.ndarray:
        """Return binary predictions (0 or 1)."""
        if self.model is None:
            raise RuntimeError("Model not trained — call train() first")
        probs = self.predict(features_df)
        return (probs >= 0.5).astype(int)

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
