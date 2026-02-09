"""
Base model class for PuckIQ ML models.

Extracts shared train/predict/evaluate/feature_importance logic into a
single base class. Subclasses override _create_model(), _compute_train_metrics(),
and evaluate() for their specific model type.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any

import lightgbm as lgb
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class BaseLGBMModel(ABC):
    """Abstract base for LightGBM-backed models."""

    def __init__(self, default_params: dict[str, Any], params: dict[str, Any] | None = None) -> None:
        self.params = {**default_params, **(params or {})}
        self.model: lgb.LGBMClassifier | lgb.LGBMRegressor | None = None
        self.feature_names: list[str] = []

    @abstractmethod
    def _create_model(self) -> lgb.LGBMClassifier | lgb.LGBMRegressor:
        """Create the underlying LightGBM model instance."""
        ...

    @abstractmethod
    def _compute_train_metrics(self, X: np.ndarray, y: np.ndarray) -> dict[str, float]:
        """Compute training metrics after fit."""
        ...

    @abstractmethod
    def evaluate(self, features_df: pd.DataFrame, targets: pd.Series) -> dict[str, float]:
        """Evaluate on the given data."""
        ...

    def train(
        self,
        features_df: pd.DataFrame,
        targets: pd.Series,
        eval_set: tuple[pd.DataFrame, pd.Series] | None = None,
    ) -> dict[str, float]:
        """Train the model with optional early stopping."""
        self.feature_names = list(features_df.columns)
        X = features_df.values
        y = targets.values

        self.model = self._create_model()

        fit_kwargs: dict[str, Any] = {}
        if eval_set is not None:
            X_val, y_val = eval_set
            fit_kwargs["eval_set"] = [(X_val.values, y_val.values)]
            fit_kwargs["callbacks"] = [lgb.early_stopping(20, verbose=False)]

        self.model.fit(X, y, **fit_kwargs)

        metrics = self._compute_train_metrics(X, y)
        logger.info("%s trained: %s", self.__class__.__name__, metrics)
        return metrics

    def predict(self, features_df: pd.DataFrame) -> np.ndarray:
        """Return predictions. Subclasses may override for probability output."""
        if self.model is None:
            raise RuntimeError(f"{self.__class__.__name__} not trained — call train() first")
        return self.model.predict(features_df.values)

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
